import asyncio
from dataclasses import replace
import socket
import ssl
from unittest.mock import AsyncMock

import httpcore
import pytest

from app.application.use_cases.website.html import HTMLFetchError, HTMLFetchFailure
from app.infra.core.config import Config
from app.domain.website import WebsiteAddress
from app.infra.services.website_html_fetcher import HTMLFetchLimits, SafeWebsiteHTMLFetcher, SystemAddressResolver


class Resolver:
    def __init__(self, *answers: tuple[str, ...]) -> None:
        self.answers = list(answers or [("93.184.216.34",)])
        self.calls: list[tuple[str, int]] = []

    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        self.calls.append((hostname, port))
        return self.answers[min(len(self.calls) - 1, len(self.answers) - 1)]


async def test_public_homepage_is_received_as_bounded_html_without_claiming_ownership():
    resolver = Resolver()
    backend = httpcore.AsyncMockBackend([b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: 15\r\n\r\n<html>OK</html>"])
    document = await SafeWebsiteHTMLFetcher(resolver=resolver, network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert document.body == b"<html>OK</html>"
    assert document.url == "https://example.test/"
    assert document.content_type == "text/html; charset=utf-8"
    assert resolver.calls == [("example.test", 443)]
    assert not hasattr(document, "is_verified")


class Stream(httpcore.AsyncMockStream):
    def __init__(self, data: list[bytes]):
        super().__init__(data)
        self.written: list[bytes] = []
        self.closed = False
        self.tls: list[tuple[ssl.SSLContext, str | None]] = []

    async def write(self, buffer: bytes, timeout: float | None = None) -> None:
        self.written.append(buffer)

    async def aclose(self) -> None:
        self.closed = True
        await super().aclose()

    async def start_tls(self, ssl_context, server_hostname=None, timeout=None):
        self.tls.append((ssl_context, server_hostname))
        return self


class Backend(httpcore.AsyncNetworkBackend):
    def __init__(self, *responses: list[bytes] | BaseException):
        self.responses = list(responses)
        self.connections: list[tuple[str, int, float | None]] = []
        self.streams: list[Stream] = []

    async def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):
        self.connections.append((host, port, timeout))
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        stream = Stream(response)
        self.streams.append(stream)
        return stream


def html(body=b"ok", headers=b""):
    return [b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n" + headers + b"Content-Length: " + str(len(body)).encode() + b"\r\n\r\n" + body]


def redirect(location: str, status=302):
    return [f"HTTP/1.1 {status} Redirect\r\nLocation: {location}\r\nContent-Length: 999999999\r\n\r\n".encode("latin-1")]


@pytest.mark.parametrize("ip", [
    "0.0.0.0", "0.1.2.3", "10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.1.1", "192.168.1.1",
    "100.64.0.1", "100.100.100.200", "192.0.0.8", "192.0.0.9", "192.88.99.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1",
    "224.0.0.1", "239.255.255.250", "240.0.0.1", "255.255.255.255", "168.63.129.16",
    "::", "::1", "fc00::1", "fd00:ec2::254", "fe80::1", "fe80::1%eth0", "fec0::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:8.8.8.8", "64:ff9b::a00:1", "64:ff9b:1::a00:1", "2001:db8::1",
    "2002:7f00:1::", "2001:0000:4136:e378:8000:63bf:3fff:fdd2", "2001:20::1", "2001:30::1", "3ffe::1", "3fff::1", "garbage",
])
async def test_nonpublic_mapped_tunnel_and_metadata_dns_results_never_open_a_socket(ip):
    backend = Backend(html()); resolver = Resolver((ip,))
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(resolver=resolver, network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert caught.value.reason == HTMLFetchFailure.UNSAFE_ADDRESS
    assert backend.connections == []


@pytest.mark.parametrize("ip", ["8.8.8.8", "93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"])
async def test_public_ipv4_ipv6_are_pinned_and_host_tls_are_not_replaced_by_the_ip(ip):
    backend = Backend(html())
    result = await SafeWebsiteHTMLFetcher(resolver=Resolver((ip,)), network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert result.body == b"ok"
    assert backend.connections == [(ip, 443, 3)]
    context, hostname = backend.streams[0].tls[0]
    assert hostname == "example.test" and context.check_hostname and context.verify_mode == ssl.CERT_REQUIRED
    wire = b"".join(backend.streams[0].written)
    assert b"Host: example.test\r\n" in wire and b"GET / HTTP/1.1\r\n" in wire
    assert b"Accept-Encoding: identity\r\n" in wire
    assert b"Cookie:" not in wire and b"Authorization:" not in wire
    assert backend.streams[0].closed


@pytest.mark.parametrize("answers", [(), ("93.184.216.34", "127.0.0.1"), ("::1", "93.184.216.34")])
async def test_empty_or_mixed_dns_answers_fail_closed_before_connect(answers):
    backend = Backend(html())
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(resolver=Resolver(answers), network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert caught.value.reason == (HTMLFetchFailure.DNS if not answers else HTMLFetchFailure.UNSAFE_ADDRESS)
    assert not backend.connections


async def test_system_resolver_requests_all_families_and_an_absolute_name(monkeypatch):
    lookup = AsyncMock(return_value=[(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("8.8.8.8", 443)),
        (socket.AF_INET6, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("2001:4860:4860::8888", 443, 0, 0))])
    monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", lookup)
    assert await SystemAddressResolver().resolve("example.test", 443) == ("8.8.8.8", "2001:4860:4860::8888")
    lookup.assert_awaited_once_with("example.test.", 443, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP)


@pytest.mark.parametrize("location", ["/fa/", "https://EXAMPLE.TEST.:443/fa/", "//example.test/fa/", "?lang=fa", "/%D9%81%D8%A7"])
@pytest.mark.parametrize("status", [301, 302, 303, 307, 308])
async def test_same_canonical_hostname_redirects_are_manual_and_re_resolved(location, status):
    backend = Backend(redirect(location, status), html())
    resolver = Resolver(("8.8.8.8",), ("1.1.1.1",))
    result = await SafeWebsiteHTMLFetcher(resolver=resolver, network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert len(resolver.calls) == 2 and [call[0] for call in backend.connections] == ["8.8.8.8", "1.1.1.1"]
    assert result.url.startswith("https://example.test/") and result.body == b"ok"
    assert all(stream.closed for stream in backend.streams)


@pytest.mark.parametrize("location", [
    "https://www.example.test/", "https://sub.example.test/", "https://evil.test/", "//evil.test/",
    "https://example.test.evil.test/", "https://example.test@evil.test/", "https://user:secret@example.test/",
    "https://@example.test/", "https://example.test:8443/", "https://127.0.0.1/", "http://example.test/",
    "http://169.254.169.254/latest/meta-data", "file:///etc/passwd", "gopher://example.test/", "data:text/html,private",
    "https:evil.test", "https:///evil.test/", "///evil.test/", "https://example.test\\@evil.test/",
    "/%0d%0aHost:evil.test", "https://%65xample.test/", "https://example.test:/", "https://[::1]/", "/\x00bad", "/bad path", "x" * 2049,
])
async def test_malicious_redirects_do_not_make_a_second_dns_or_network_request(location):
    backend = Backend(redirect(location), html()); resolver = Resolver()
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(resolver=resolver, network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert caught.value.reason in {HTMLFetchFailure.REDIRECT, HTMLFetchFailure.PROTOCOL}
    assert len(backend.connections) == len(resolver.calls) == 1
    assert backend.streams[0].closed


async def test_dns_rebinding_on_redirect_rejects_internal_result_even_for_same_hostname():
    resolver = Resolver(("8.8.8.8",), ("169.254.169.254",))
    backend = Backend(redirect("/home"), html())
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(resolver=resolver, network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert caught.value.reason == HTMLFetchFailure.UNSAFE_ADDRESS
    assert len(resolver.calls) == 2 and len(backend.connections) == 1


async def test_exactly_three_redirects_are_allowed_but_a_fourth_or_loop_is_rejected():
    backend = Backend(redirect("/one"), redirect("/two"), redirect("/three"), html())
    assert (await SafeWebsiteHTMLFetcher(resolver=Resolver(), network_backend=backend).fetch(WebsiteAddress("example.test", "https"))).url.endswith("/three")
    for chain in [[redirect("/one"), redirect("/two"), redirect("/three"), redirect("/four")], [redirect("/#fragment")]]:
        backend = Backend(*chain); resolver = Resolver()
        with pytest.raises(HTMLFetchError) as caught:
            await SafeWebsiteHTMLFetcher(resolver=resolver, network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
        assert caught.value.reason == HTMLFetchFailure.REDIRECT
        assert len(backend.connections) <= 4 and all(stream.closed for stream in backend.streams)


@pytest.mark.parametrize("address", [WebsiteAddress("localhost", "https"), WebsiteAddress("127.0.0.1", "https"),
    WebsiteAddress("EXAMPLE.test", "https"), WebsiteAddress("example.test", "ftp"), WebsiteAddress("example.test:8443", "https"),
    WebsiteAddress("example.test/path", "https"), WebsiteAddress("user@example.test", "https")])
async def test_untrusted_or_noncanonical_address_is_rejected_without_dns(address):
    resolver = Resolver(); backend = Backend(html())
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(resolver=resolver, network_backend=backend).fetch(address)
    assert caught.value.reason == HTMLFetchFailure.INVALID_TARGET and not resolver.calls and not backend.connections


@pytest.mark.parametrize("registered_scheme", ["http", "https"])
async def test_https_is_first_and_http_fallback_requires_explicit_http_registration(registered_scheme):
    backend = Backend(httpcore.ConnectError("private-error"), html()); resolver = Resolver()
    fetcher = SafeWebsiteHTMLFetcher(resolver=resolver, network_backend=backend)
    if registered_scheme == "http":
        assert (await fetcher.fetch(WebsiteAddress("example.test", registered_scheme))).url == "http://example.test/"
        assert [call[1] for call in backend.connections] == [443, 80]
    else:
        with pytest.raises(HTMLFetchError) as caught:
            await fetcher.fetch(WebsiteAddress("example.test", registered_scheme))
        assert caught.value.reason == HTMLFetchFailure.NETWORK and len(backend.connections) == 1


async def test_explicit_http_cannot_fallback_around_an_unsafe_https_redirect():
    backend = Backend(redirect("https://evil.test/"), html())
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(resolver=Resolver(), network_backend=backend).fetch(WebsiteAddress("example.test", "http"))
    assert caught.value.reason == HTMLFetchFailure.REDIRECT and len(backend.connections) == 1


@pytest.mark.parametrize("response,reason", [
    ([b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 5\r\n\r\nhello"], HTMLFetchFailure.TOO_LARGE),
    ([b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n3\r\ndef\r\n0\r\n\r\n"], HTMLFetchFailure.TOO_LARGE),
    ([b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\nhello"], HTMLFetchFailure.TOO_LARGE),
    (html(b"ok", b"Content-Encoding: gzip\r\n"), HTMLFetchFailure.CONTENT),
    (html(b"ok", b"Content-Encoding: br\r\n"), HTMLFetchFailure.CONTENT),
    ([b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}"], HTMLFetchFailure.CONTENT),
    ([b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok"], HTMLFetchFailure.CONTENT),
    ([b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"], HTMLFetchFailure.HTTP_STATUS),
    ([b"HTTP/1.1 302 Redirect\r\nContent-Length: 0\r\n\r\n"], HTMLFetchFailure.REDIRECT),
    ([b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: invalid\r\n\r\n"], HTMLFetchFailure.PROTOCOL),
    ([b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 3\r\n\r\nx"], HTMLFetchFailure.PROTOCOL),
    ([b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Type: application/json\r\nContent-Length: 0\r\n\r\n"], HTMLFetchFailure.CONTENT),
])
async def test_hostile_or_unusable_responses_fail_and_close_the_socket(response, reason):
    backend = Backend(response)
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(limits=HTMLFetchLimits(max_bytes=4), resolver=Resolver(), network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert caught.value.reason == reason and backend.streams[0].closed


@pytest.mark.parametrize("body", [b"", b"1234"])
async def test_exact_size_boundary_and_empty_html(body):
    result = await SafeWebsiteHTMLFetcher(limits=HTMLFetchLimits(max_bytes=4), resolver=Resolver(), network_backend=Backend(html(body))).fetch(WebsiteAddress("example.test", "https"))
    assert result.body == body


@pytest.mark.parametrize("stage", ["dns", "connect", "read"])
async def test_absolute_deadline_cancels_stalled_network_work(stage):
    started = asyncio.Event(); cancelled = asyncio.Event()
    async def stall(*args, **kwargs):
        started.set()
        try: await asyncio.Event().wait()
        finally: cancelled.set()
    resolver = Resolver(); backend = Backend(html())
    if stage == "dns": resolver.resolve = stall
    elif stage == "connect": backend.connect_tcp = stall
    else:
        stream = Stream([]); stream.read = stall
        backend.connect_tcp = AsyncMock(return_value=stream)
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(limits=HTMLFetchLimits(total_seconds=0.03), resolver=resolver, network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert caught.value.reason == HTMLFetchFailure.TIMEOUT and started.is_set() and cancelled.is_set()


@pytest.mark.parametrize("field,value", [("total_seconds", 0), ("total_seconds", float("inf")), ("dns_seconds", float("nan")),
    ("connect_seconds", -1), ("read_seconds", 11), ("max_bytes", 0), ("max_bytes", True), ("max_bytes", 5242881)])
def test_unsafe_limits_are_rejected(field, value):
    with pytest.raises(ValueError): replace(HTMLFetchLimits(), **{field: value})


def test_config_and_dependency_preserve_validated_limits_and_verified_tls():
    from types import SimpleNamespace
    from app.interface.dependencies.website_dependencies import get_website_html_fetcher
    settings = Config(_env_file=None, HTML_FETCH_MAX_BYTES=1234, HTML_FETCH_DNS_SECONDS=2)
    fetcher = get_website_html_fetcher(SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=settings))))
    assert fetcher._limits == HTMLFetchLimits(max_bytes=1234, dns_seconds=2)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT); context.check_hostname = False
    with pytest.raises(ValueError): SafeWebsiteHTMLFetcher(ssl_context=context)


async def test_dns_error_has_safe_diagnostics_and_no_http_fallback_or_socket(caplog):
    resolver = Resolver(); resolver.resolve = AsyncMock(side_effect=socket.gaierror("private-dns-answer"))
    backend = Backend(html())
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(resolver=resolver, network_backend=backend).fetch(WebsiteAddress("example.test", "http"))
    assert caught.value.reason == HTMLFetchFailure.DNS and not backend.connections
    assert caught.value.__context__ is None and caught.value.__cause__ is None
    assert "private-dns-answer" not in repr(caught.value) + caplog.text


async def test_dns_has_its_own_deadline_and_external_cancellation_is_not_converted_to_success():
    started = asyncio.Event(); cancelled = asyncio.Event()
    async def stall(hostname, port):
        started.set()
        try: await asyncio.Event().wait()
        finally: cancelled.set()
    resolver = Resolver(); resolver.resolve = stall
    fetcher = SafeWebsiteHTMLFetcher(resolver=resolver, limits=HTMLFetchLimits(total_seconds=1, dns_seconds=0.02))
    with pytest.raises(HTMLFetchError) as caught:
        await asyncio.wait_for(fetcher.fetch(WebsiteAddress("example.test", "https")), 0.5)
    assert caught.value.reason == HTMLFetchFailure.TIMEOUT and cancelled.is_set()
    started.clear(); cancelled.clear()
    pending = asyncio.create_task(fetcher.fetch(WebsiteAddress("example.test", "https")))
    await started.wait(); pending.cancel()
    with pytest.raises(asyncio.CancelledError): await pending
    assert cancelled.is_set()


@pytest.mark.parametrize("headers,reason", [
    (b"Location: /one\r\nLocation: /two\r\n", HTMLFetchFailure.REDIRECT),
    (b"Location: \r\n", HTMLFetchFailure.REDIRECT),
])
async def test_ambiguous_redirect_headers_are_rejected(headers, reason):
    backend = Backend([b"HTTP/1.1 302 Found\r\n" + headers + b"Content-Length: 0\r\n\r\n"])
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(resolver=Resolver(), network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert caught.value.reason == reason and backend.streams[0].closed


async def test_full_redirect_budget_is_shared_with_explicit_http_fallback():
    backend = Backend(redirect("/one"), redirect("/two"), redirect("/three"), httpcore.ConnectError("private"), redirect("/four"))
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(resolver=Resolver(), network_backend=backend).fetch(WebsiteAddress("example.test", "http"))
    assert caught.value.reason == HTMLFetchFailure.REDIRECT
    assert [port for _, port, _ in backend.connections] == [443, 443, 443, 443, 80]


async def test_provider_network_failure_and_response_body_are_not_retained_in_error_or_repr(caplog):
    backend = Backend(httpcore.ConnectError("private-provider-detail"))
    with pytest.raises(HTMLFetchError) as caught:
        await SafeWebsiteHTMLFetcher(resolver=Resolver(), network_backend=backend).fetch(WebsiteAddress("example.test", "https"))
    assert caught.value.__context__ is None and caught.value.__cause__ is None
    assert "private-provider-detail" not in repr(caught.value) + caplog.text
    result = await SafeWebsiteHTMLFetcher(resolver=Resolver(), network_backend=Backend(html(b"private-proof"))).fetch(WebsiteAddress("example.test", "https"))
    assert "private-proof" not in repr(result) and "example.test" not in repr(result)


@pytest.mark.parametrize("settings", [{"HTML_FETCH_TOTAL_SECONDS": 0}, {"HTML_FETCH_DNS_SECONDS": float("nan")},
    {"HTML_FETCH_CONNECT_SECONDS": 11}, {"HTML_FETCH_READ_SECONDS": -1}, {"HTML_FETCH_MAX_BYTES": 5242881}])
def test_invalid_server_settings_are_rejected(settings):
    with pytest.raises(ValueError): Config(_env_file=None, **settings)
