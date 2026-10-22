"""Hostname identity only; URL parsing, DNS and HTML checks belong to later tasks."""
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
