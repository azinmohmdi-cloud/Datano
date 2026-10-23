"""Integration identity is independent of provider credentials and analytics rows."""
from dataclasses import dataclass, replace
from datetime import UTC, datetime
import json
from typing import Literal
from uuid import uuid4

from app.domain.error.exceptions import ValidationException

IntegrationSource = Literal["ga4", "gsc", "ads"]


def validate_source(source: str) -> None:
    if source not in ("ga4", "gsc", "ads"):
        raise ValidationException("Invalid integration source")


def validate_identifier(value: str, *, max_bytes: int = 128) -> None:
    try:
        valid = (isinstance(value, str) and bool(value.strip()) and len(value.encode("utf-8")) <= max_bytes
                 and not any(ord(character) < 32 or ord(character) == 127 for character in value))
    except UnicodeEncodeError:
        valid = False
    if not valid:
        raise ValidationException("Invalid integration identifier")


@dataclass(frozen=True)
class IntegrationEntity:
    id: str
    owner_id: str
    website_id: str
    source: IntegrationSource
    property_id: str
    created_at: datetime
    updated_at: datetime
    revision: int = 1
    retired_at: datetime | None = None

    def __post_init__(self) -> None:
        for value in (self.id, self.owner_id, self.website_id):
            validate_identifier(value)
        validate_identifier(self.property_id, max_bytes=2048)
        validate_source(self.source)
        self._instant(self.created_at)
        self._instant(self.updated_at)
        if self.retired_at is not None:
            self._instant(self.retired_at)
        if (self.updated_at < self.created_at or type(self.revision) is not int or not 1 <= self.revision <= 2147483647
                or self.retired_at is not None and self.retired_at != self.updated_at):
            raise ValidationException("Invalid integration persistence state")

    @staticmethod
    def _instant(instant: datetime) -> None:
        if not isinstance(instant, datetime) or instant.utcoffset() is None:
            raise ValidationException("Integration timestamps must be timezone-aware")

    @classmethod
    def create(cls, owner_id: str, website_id: str, source: IntegrationSource, property_id: str, *, now: datetime) -> "IntegrationEntity":
        cls._instant(now)
        instant = now.astimezone(UTC)
        return cls(str(uuid4()), owner_id, website_id, source, property_id, instant, instant)

    def renew(self, *, now: datetime) -> "IntegrationEntity":
        self._instant(now)
        if self.retired_at is not None or now < self.updated_at:
            raise ValidationException("Integration is no longer current")
        return replace(self, updated_at=now.astimezone(UTC), revision=self.revision + 1)

    def retire(self, *, now: datetime) -> "IntegrationEntity":
        renewed = self.renew(now=now)
        return replace(renewed, retired_at=renewed.updated_at)

    def credential_context(self) -> bytes:
        return json.dumps(["datano:integration-credential:v1", self.id, self.owner_id, self.website_id,
                           self.source, self.property_id, self.revision], ensure_ascii=False, separators=(",", ":")).encode("utf-8")
