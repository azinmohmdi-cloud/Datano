"""Real loopback HTTP/TLS wire tests; production public-IP policy is never relaxed."""
import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
import ssl

import httpcore
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

from app.application.use_cases.website.html import HTMLFetchError, HTMLFetchFailure
from app.domain.website import WebsiteAddress
from app.infra.services.website_html_fetcher import HTMLFetchLimits, SafeWebsiteHTMLFetcher


@pytest.fixture
def certificate(tmp_path):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "example.test")])
    now = datetime.now(UTC)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(x509.random_serial_number()).not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=1)).add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("example.test")]), critical=False).sign(key, hashes.SHA256()))
    cert_file, key_file = tmp_path / "test-cert.pem", tmp_path / "test-key.pem"
    cert_file.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_file.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    key_file.chmod(0o600)
    server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); server_context.load_cert_chain(cert_file, key_file)
    client_context = ssl.create_default_context(cafile=str(cert_file))
    return server_context, client_context


class Resolver:
    def __init__(self, answers=("8.8.8.8",)):
        self.answers = answers
        self.calls = []

    async def resolve(self, hostname, port):
        self.calls.append((hostname, port))
        return self.answers


class LoopbackBackend(httpcore.AnyIOBackend):
    """Test-only routing below the policy: retain requested pinned destination/SNI."""
    def __init__(self, port):
        self.port = port
        self.targets = []

    async def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):
        self.targets.append((host, port))
        assert host == "8.8.8.8" and port in {80, 443}
        return await super().connect_tcp("127.0.0.1", self.port, timeout, local_address, socket_options)


@asynccontextmanager
async def peer(responses, *, tls=None, stall=False):
    requests, tasks = [], set()
    disconnected = asyncio.Event()

    async def handle(reader, writer):
        task = asyncio.current_task(); tasks.add(task)
        try:
            if stall:
                await reader.read()  # TLS handshake or response read must time out.
            else:
                request = await reader.readuntil(b"\r\n\r\n")
                requests.append(request)
                response = responses[min(len(requests) - 1, len(responses) - 1)]
                writer.write(response); await writer.drain()
                await reader.read()  # Observe the client closing on success/failure.
            disconnected.set()
        except (ConnectionError, asyncio.IncompleteReadError):
            disconnected.set()
        finally:
            writer.close()
            try: await writer.wait_closed()
            except (ConnectionError, ssl.SSLError): pass
            tasks.discard(task)

    server = await asyncio.start_server(handle, "127.0.0.1", 0, ssl=tls)
    try:
        yield server.sockets[0].getsockname()[1], requests, disconnected
    finally:
        server.close(); await server.wait_closed()
        for task in list(tasks): task.cancel()
        if tasks: await asyncio.gather(*tasks, return_exceptions=True)


async def test_wire_verified_tls_uses_canonical_sni_host_and_ignores_proxy_and_cookies(certificate, monkeypatch):
    server_context, client_context = certificate
    sni = []; server_context.set_servername_callback(lambda sock, name, context: sni.append(name))
    monkeypatch.setenv("HTTPS_PROXY", "http://127.0.0.1:1"); monkeypatch.setenv("ALL_PROXY", "http://127.0.0.1:1")
    responses = [b"HTTP/1.1 302 Found\r\nLocation: /fa/\r\nSet-Cookie: private-cookie=secret\r\nContent-Length: 0\r\n\r\n",
        b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: 15\r\n\r\n<html>OK</html>"]
    resolver = Resolver()
    async with peer(responses, tls=server_context) as (port, requests, disconnected):
        backend = LoopbackBackend(port)
        result = await SafeWebsiteHTMLFetcher(resolver=resolver, network_backend=backend, ssl_context=client_context).fetch(WebsiteAddress("example.test", "https"))
        await asyncio.wait_for(disconnected.wait(), 1)
    assert result.body == b"<html>OK</html>" and result.url == "https://example.test/fa/"
    assert resolver.calls == [("example.test", 443), ("example.test", 443)]
    assert backend.targets == [("8.8.8.8", 443), ("8.8.8.8", 443)] and sni == ["example.test", "example.test"]
    for request in requests:
        assert b"Host: example.test\r\n" in request
        assert b"Cookie:" not in request and b"Authorization:" not in request and b"Proxy-Authorization:" not in request
    assert requests[1].startswith(b"GET /fa/ HTTP/1.1\r\n")


@pytest.mark.parametrize("scenario", ["untrusted", "wrong_hostname"])
async def test_wire_untrusted_or_mismatched_certificate_never_sends_http(certificate, scenario):
    server_context, client_context = certificate
    async with peer([b""], tls=server_context) as (port, requests, _):
        with pytest.raises(HTMLFetchError) as caught:
            await SafeWebsiteHTMLFetcher(resolver=Resolver(), network_backend=LoopbackBackend(port),
                ssl_context=client_context if scenario == "wrong_hostname" else None).fetch(
                    WebsiteAddress("other.test" if scenario == "wrong_hostname" else "example.test", "https"))
    assert caught.value.reason == HTMLFetchFailure.NETWORK and requests == []
    assert caught.value.__context__ is None and caught.value.__cause__ is None


@pytest.mark.parametrize("stage", ["tls", "read"])
async def test_wire_stage_deadline_applies_before_total_budget(certificate, stage):
    server_context, client_context = certificate
    # A plain peer stalls TLS; a verified TLS peer stalls its HTTP response.
    async with peer([], tls=server_context if stage == "read" else None, stall=True) as (port, _, disconnected):
        fetcher = SafeWebsiteHTMLFetcher(resolver=Resolver(), network_backend=LoopbackBackend(port), ssl_context=client_context,
            limits=HTMLFetchLimits(total_seconds=2, connect_seconds=0.05, read_seconds=0.05))
        with pytest.raises(HTMLFetchError) as caught:
            await asyncio.wait_for(fetcher.fetch(WebsiteAddress("example.test", "https")), 1)
        await asyncio.wait_for(disconnected.wait(), 1)
    assert caught.value.reason == HTMLFetchFailure.TIMEOUT


@pytest.mark.parametrize("response,reason", [
    (b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n3\r\ndef\r\n0\r\n\r\n", HTMLFetchFailure.TOO_LARGE),
    (b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 999999999\r\n\r\n", HTMLFetchFailure.TOO_LARGE),
    (b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Encoding: gzip\r\nContent-Length: 999999\r\n\r\n", HTMLFetchFailure.CONTENT),
    (b"HTTP/1.1 200 OK\r\nX-Flood: " + b"x" * 140000 + b"\r\n\r\n", HTMLFetchFailure.PROTOCOL),
    (b"HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/\r\nContent-Length: 0\r\n\r\n", HTMLFetchFailure.REDIRECT),
])
async def test_wire_hostile_response_is_bounded_and_connection_closed(certificate, response, reason):
    server_context, client_context = certificate
    async with peer([response], tls=server_context) as (port, requests, disconnected):
        with pytest.raises(HTMLFetchError) as caught:
            await SafeWebsiteHTMLFetcher(resolver=Resolver(), network_backend=LoopbackBackend(port), ssl_context=client_context,
                limits=HTMLFetchLimits(max_bytes=4)).fetch(WebsiteAddress("example.test", "https"))
        await asyncio.wait_for(disconnected.wait(), 1)
    assert caught.value.reason == reason and len(requests) == 1


async def test_wire_dns_private_answer_never_reaches_loopback_fixture(certificate):
    server_context, client_context = certificate
    async with peer([b""], tls=server_context) as (port, requests, _):
        backend = LoopbackBackend(port)
        with pytest.raises(HTMLFetchError) as caught:
            await SafeWebsiteHTMLFetcher(resolver=Resolver(("127.0.0.1",)), network_backend=backend, ssl_context=client_context).fetch(WebsiteAddress("example.test", "https"))
    assert caught.value.reason == HTMLFetchFailure.UNSAFE_ADDRESS and requests == [] and backend.targets == []
