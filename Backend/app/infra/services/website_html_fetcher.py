"""Bounded HTML receipt: validate every DNS answer, then connect to a pinned IP."""
import asyncio
from dataclasses import dataclass, field
import ipaddress
import math
import re
import socket
import ssl
from typing import Protocol
from urllib.parse import quote, urljoin, urlsplit, urlunsplit

import httpcore

from app.application.use_cases.website.html import HTMLFetchError, HTMLFetchFailure, IWebsiteHTMLFetcher, WebsiteHTML
from app.domain.error.exceptions import ValidationException
from app.domain.website import WebsiteAddress, parse_website_url


# Conservative exclusions for special-use protocol/tunnel ranges whose stdlib
# classification differs across supported Python 3.12 patch releases.
_IPV4_SPECIAL = tuple(ipaddress.IPv4Network(value) for value in
    ("192.0.0.0/24", "192.88.99.0/24", "168.63.129.16/32"))
_IPV6_SPECIAL = tuple(ipaddress.IPv6Network(value) for value in
    ("2001::/23", "3ffe::/16", "3fff::/20"))
_IPV6_UNICAST = ipaddress.IPv6Network("2000::/3")


@dataclass(frozen=True)
class HTMLFetchLimits:
    total_seconds: float = 10
    dns_seconds: float = 3
    connect_seconds: float = 3
    read_seconds: float = 3
    max_bytes: int = 1024 * 1024

    def __post_init__(self) -> None:
        for value, maximum in ((self.total_seconds, 30), (self.dns_seconds, 10),
                               (self.connect_seconds, 10), (self.read_seconds, 10)):
            if isinstance(value, bool) or not math.isfinite(value) or not 0 < value <= maximum:
                raise ValueError("Invalid HTML fetch timeout")
        if type(self.max_bytes) is not int or not 0 < self.max_bytes <= 5 * 1024 * 1024:
            raise ValueError("Invalid HTML fetch size")


class AddressResolver(Protocol):
    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]: ...


class SystemAddressResolver:
    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        # Absolute DNS name prevents local search-suffix expansion. No AI_ADDRCONFIG
        # filter: validate both A and AAAA results, including mixed public/private.
        answers = await asyncio.get_running_loop().getaddrinfo(
            hostname + ".", port, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP)
        return tuple(answer[4][0] for answer in answers)


def public_address(value: str) -> str:
    rejected = False
    try:
        address = ipaddress.ip_address(value)
        rejected = (not address.is_global or address.is_multicast or address.is_reserved
            or address.is_unspecified or address.is_loopback or address.is_link_local)
        if isinstance(address, ipaddress.IPv6Address):
            # Only native global unicast. Block scoped/mapped/translation/tunnel
            # forms instead of trusting an embedded IPv4 destination.
            rejected = rejected or (address not in _IPV6_UNICAST or any(address in prefix for prefix in _IPV6_SPECIAL)
                or address.scope_id is not None or address.ipv4_mapped is not None
                or address.sixtofour is not None or address.teredo is not None)
        else:
            rejected = rejected or any(address in prefix for prefix in _IPV4_SPECIAL)
    except ValueError:
        rejected = True
    if rejected:
        raise HTMLFetchError(HTMLFetchFailure.UNSAFE_ADDRESS)
    return str(address)


@dataclass
class _FetchState:
    redirects: int = 0
    visited: set[str] = field(default_factory=set)


class SafeWebsiteHTMLFetcher(IWebsiteHTMLFetcher):
    def __init__(self, *, limits: HTMLFetchLimits | None = None, resolver: AddressResolver | None = None,
                 network_backend: httpcore.AsyncNetworkBackend | None = None,
                 ssl_context: ssl.SSLContext | None = None) -> None:
        self._limits = limits if limits is not None else HTMLFetchLimits()
        self._resolver = resolver if resolver is not None else SystemAddressResolver()
        self._network_backend = network_backend
        self._ssl_context = ssl_context if ssl_context is not None else ssl.create_default_context()
        if (not self._ssl_context.check_hostname or self._ssl_context.verify_mode != ssl.CERT_REQUIRED
                or self._ssl_context.minimum_version < ssl.TLSVersion.TLSv1_2):
            raise ValueError("Verified TLS 1.2 or later is required")

    async def fetch(self, address: WebsiteAddress) -> WebsiteHTML:
        invalid = False
        try:
            parsed = parse_website_url(address.url)
            invalid = parsed != address
        except (ValidationException, AttributeError, TypeError):
            invalid = True
        if invalid:
            raise HTMLFetchError(HTMLFetchFailure.INVALID_TARGET)
        failure: HTMLFetchFailure
        try:
            # One deadline includes DNS, all redirects, TLS, receipt and HTTP fallback.
            async with asyncio.timeout(self._limits.total_seconds):
                state = _FetchState()
                try:
                    return await self._chain(f"https://{address.hostname}/", address.hostname, state)
                except HTMLFetchError as error:
                    # Never downgrade an HTTPS registration, or bypass a security
                    # rejection. Explicit HTTP registrations alone get this fallback.
                    if address.scheme != "http" or error.reason != HTMLFetchFailure.NETWORK:
                        raise
                return await self._chain(f"http://{address.hostname}/", address.hostname, state)
        except TimeoutError:
            failure = HTMLFetchFailure.TIMEOUT
        except httpcore.TimeoutException:
            failure = HTMLFetchFailure.TIMEOUT
        except (httpcore.NetworkError, OSError):
            failure = HTMLFetchFailure.NETWORK
        except httpcore.ProtocolError:
            failure = HTMLFetchFailure.PROTOCOL
        # Provider exceptions are deliberately detached, including __context__.
        raise HTMLFetchError(failure)

    async def _pin(self, hostname: str, port: int) -> str:
        failed = False
        try:
            async with asyncio.timeout(self._limits.dns_seconds):
                answers = await self._resolver.resolve(hostname, port)
        except TimeoutError:
            raise
        except OSError:
            failed = True
        if failed:
            raise HTMLFetchError(HTMLFetchFailure.DNS)
        if not answers:
            raise HTMLFetchError(HTMLFetchFailure.DNS)
        # Check the entire set before opening any socket. One unsafe answer vetoes it.
        addresses = tuple(public_address(answer) for answer in answers)
        return addresses[0]

    async def _chain(self, url: str, hostname: str, state: _FetchState) -> WebsiteHTML:
        while True:
            if url in state.visited:
                raise HTMLFetchError(HTMLFetchFailure.REDIRECT)
            state.visited.add(url)
            scheme = urlsplit(url).scheme
            port = 443 if scheme == "https" else 80
            pinned = await self._pin(hostname, port)
            parts = urlsplit(url)
            target = (parts.path or "/") + ("?" + parts.query if parts.query else "")
            location: str | None = None
            network_failure = False
            try:
                # A new pool for every hop prevents keepalive/DNS cache reuse. The
                # literal-IP URL has no second hostname resolution at connect time.
                async with httpcore.AsyncConnectionPool(ssl_context=self._ssl_context,
                    network_backend=self._network_backend, max_connections=1, max_keepalive_connections=0,
                    retries=0, http1=True, http2=False) as pool:
                    async with pool.stream("GET", httpcore.URL(scheme=scheme.encode("ascii"),
                        host=pinned.encode("ascii"), port=port, target=target.encode("ascii")),
                        headers={"Host": hostname, "Accept": "text/html, application/xhtml+xml",
                            "Accept-Encoding": "identity", "User-Agent": "Datano-Verification/1.0", "Connection": "close"},
                        extensions={"sni_hostname": hostname, "timeout": {"connect": self._limits.connect_seconds,
                            "read": self._limits.read_seconds, "write": self._limits.connect_seconds,
                            "pool": self._limits.connect_seconds}}) as response:
                        if response.status in {301, 302, 303, 307, 308}:
                            location = self._header(response, b"location", HTMLFetchFailure.REDIRECT)
                            if not location or state.redirects >= 3:
                                raise HTMLFetchError(HTMLFetchFailure.REDIRECT)
                            location = self._redirect(url, location, hostname)
                        elif response.status != 200:
                            raise HTMLFetchError(HTMLFetchFailure.HTTP_STATUS)
                        else:
                            return await self._document(response, url)
            except (httpcore.NetworkError, OSError):
                network_failure = True
            if network_failure:
                raise HTMLFetchError(HTMLFetchFailure.NETWORK)
            # Redirect bodies are never consumed. Context managers close response
            # and socket before re-resolving and validating the next destination.
            if location is None:
                raise HTMLFetchError(HTMLFetchFailure.PROTOCOL)
            state.redirects += 1
            url = location

    @staticmethod
    def _header(response: httpcore.Response, name: bytes, reason: HTMLFetchFailure) -> str | None:
        values = [value for key, value in response.headers if key.lower() == name]
        if len(values) > 1:
            raise HTMLFetchError(reason)
        return values[0].decode("latin-1").strip() if values else None

    @staticmethod
    def _redirect(current: str, location: str, hostname: str) -> str:
        invalid = False
        try:
            if (len(location) > 2048 or not location.isascii() or location.startswith("///")
                or any(char.isspace() or ord(char) < 32 or ord(char) == 127 or char == "\\" for char in location)
                or re.search(r"%(?:0[0-9a-f]|1[0-9a-f]|7f)", location, re.IGNORECASE)):
                raise ValueError
            explicit_scheme = re.match(r"^([a-z][a-z0-9+.-]*):", location, re.IGNORECASE)
            if explicit_scheme and (not re.match(r"^https?://", location, re.IGNORECASE) or not urlsplit(location).netloc):
                raise ValueError
            resolved = urlsplit(urljoin(current, location))
            address = parse_website_url(f"{resolved.scheme}://{resolved.netloc}/")
            if address.hostname != hostname or (urlsplit(current).scheme == "https" and address.scheme != "https"):
                raise ValueError
            target = urlunsplit((address.scheme, address.hostname, quote(resolved.path or "/", safe="/%:@!$&'()*+,;=-._~"),
                quote(resolved.query, safe="/%?:@!$&'()*+,;=-._~"), ""))
        except (ValueError, ValidationException):
            invalid = True
        if invalid:
            raise HTMLFetchError(HTMLFetchFailure.REDIRECT)
        return target

    async def _document(self, response: httpcore.Response, url: str) -> WebsiteHTML:
        content_type = self._header(response, b"content-type", HTMLFetchFailure.CONTENT)
        encoding = self._header(response, b"content-encoding", HTMLFetchFailure.CONTENT)
        if (content_type is None or content_type.split(";", 1)[0].strip().lower() not in {"text/html", "application/xhtml+xml"}
                or encoding is not None and encoding.lower() != "identity"):
            raise HTMLFetchError(HTMLFetchFailure.CONTENT)
        length = self._header(response, b"content-length", HTMLFetchFailure.PROTOCOL)
        if length is not None:
            if not re.fullmatch(r"[0-9]{1,20}", length):
                raise HTMLFetchError(HTMLFetchFailure.PROTOCOL)
            if int(length) > self._limits.max_bytes:
                raise HTMLFetchError(HTMLFetchFailure.TOO_LARGE)
        body = bytearray()
        async for chunk in response.aiter_stream():
            if len(body) + len(chunk) > self._limits.max_bytes:
                raise HTMLFetchError(HTMLFetchFailure.TOO_LARGE)
            body.extend(chunk)
        return WebsiteHTML(url=url, content_type=content_type, body=bytes(body))
