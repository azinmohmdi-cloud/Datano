"""Hostname and homepage URL identity; no DNS lookup or HTML request."""
from dataclasses import dataclass
import re

import idna

from app.domain.error.exceptions import ValidationException


def canonical_hostname(value: str) -> str:
    """UTS #46 nontransitional IDNA, without merging www or child hostnames."""
    message = "Invalid website hostname"
    if not isinstance(value, str) or not value or any(
        char.isspace() or ord(char) < 32 or char in "\\/:@%?#[]" for char in value
    ):
        raise ValidationException(message, field="hostname")
    try:
        hostname = idna.encode(value, uts46=True, std3_rules=True, transitional=False).decode("ascii").removesuffix(".")
    except (idna.IDNAError, UnicodeError):
        raise ValidationException(message, field="hostname") from None
    labels = hostname.split(".")
    if (len(hostname) > 253 or len(labels) < 2
            or labels[-1] in {"localhost", "local"}
            or re.fullmatch(r"(?:[0-9]+|0x[0-9a-f]+)", labels[-1])):
        raise ValidationException(message, field="hostname")
    return hostname


@dataclass(frozen=True)
class WebsiteAddress:
    hostname: str
    scheme: str

    @property
    def url(self) -> str:
        return f"{self.scheme}://{self.hostname}/"


def parse_website_url(value: str) -> WebsiteAddress:
    """Reject prohibited original syntax before any URL/IDNA normalization.

    Only the root slash is optional. In particular, /a/.. and even empty query
    or fragment markers must not disappear through a permissive URL parser.
    Matching default ports are syntax aliases, never custom fetch destinations.
    """
    message = "Invalid website URL"
    if not isinstance(value, str):
        raise ValidationException(message, field="url")
    raw = value.strip()
    if any(char.isspace() or ord(char) < 32 or ord(char) == 127 or char == "\\" for char in raw):
        raise ValidationException(message, field="url")
    match = re.fullmatch(r"(https?)://([^/?#]+)(/?)", raw, re.IGNORECASE)
    if match is None:
        raise ValidationException(message, field="url")
    scheme, authority, _ = match.groups()
    scheme = scheme.lower()
    hostname, separator, port = authority.partition(":")
    if separator and (not port.isascii() or not port.isdecimal()
                      or port.lstrip("0") != {"http": "80", "https": "443"}[scheme]):
        raise ValidationException(message, field="url")
    try:
        hostname = canonical_hostname(hostname)
    except ValidationException:
        raise ValidationException(message, field="url") from None
    return WebsiteAddress(hostname=hostname, scheme=scheme)
