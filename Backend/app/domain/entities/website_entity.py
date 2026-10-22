"""Website identity and persisted verification state; no proof is issued here."""
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import uuid4

from app.domain.error.exceptions import ValidationException
from app.domain.website import canonical_hostname

WEBSITE_RESERVATION_LIFETIME = timedelta(hours=24)
WebsiteChallengeStatus = Literal["not-issued", "pending", "expired", "verified", "released"]


@dataclass(frozen=True)
class WebsiteEntity:
    id: str
    owner_id: str
    hostname: str
    scheme: str
    created_at: datetime
    updated_at: datetime
    reservation_expires_at: datetime
    challenge_digest: bytes | None = field(default=None, repr=False)
    challenge_issued_at: datetime | None = None
    challenge_expires_at: datetime | None = None
    verified_at: datetime | None = None
    released_at: datetime | None = None

    def __post_init__(self) -> None:
        if not self.id or not self.id.strip() or not self.owner_id or not self.owner_id.strip():
            raise ValidationException("Website and owner identifiers are required")
        if self.hostname != canonical_hostname(self.hostname):
            raise ValidationException("Website hostname must be canonical", field="hostname")
        if self.scheme not in {"http", "https"}:
            raise ValidationException("Website scheme must be HTTP or HTTPS", field="scheme")
        for instant in (self.created_at, self.updated_at, self.reservation_expires_at,
                        self.challenge_issued_at, self.challenge_expires_at,
                        self.verified_at, self.released_at):
            if instant is not None:
                self._validate_instant(instant)
        if self.updated_at < self.created_at:
            raise ValidationException("Website update precedes creation")
        if self.challenge_digest is None:
            if (self.challenge_issued_at is not None or self.challenge_expires_at is not None
                    or self.verified_at is not None
                    or self.reservation_expires_at != self.created_at + WEBSITE_RESERVATION_LIFETIME):
                raise ValidationException("Invalid unissued website challenge state")
        else:
            if (not isinstance(self.challenge_digest, bytes) or len(self.challenge_digest) != 32
                    or self.challenge_issued_at is None or self.challenge_expires_at is None
                    or not self.created_at <= self.challenge_issued_at <= self.updated_at
                    or self.challenge_expires_at != self.challenge_issued_at + WEBSITE_RESERVATION_LIFETIME
                    or self.reservation_expires_at != self.challenge_expires_at):
                raise ValidationException("Invalid website challenge state")
            if self.verified_at is not None and not (
                self.challenge_issued_at <= self.verified_at < self.challenge_expires_at
                and self.verified_at <= self.updated_at
            ):
                raise ValidationException("Invalid website verification timestamp")
        if self.released_at is not None and not self.created_at <= self.released_at <= self.updated_at:
            raise ValidationException("Invalid website release timestamp")

    @classmethod
    def create(cls, owner_id: str, hostname: str, *, scheme: str = "https",
               now: datetime | None = None) -> "WebsiteEntity":
        instant = now if now is not None else datetime.now(UTC)
        cls._validate_instant(instant)
        instant = instant.astimezone(UTC)
        return cls(id=str(uuid4()), owner_id=owner_id, hostname=canonical_hostname(hostname),
                   scheme=scheme, created_at=instant, updated_at=instant,
                   reservation_expires_at=instant + WEBSITE_RESERVATION_LIFETIME)

    def challenge_status(self, now: datetime) -> WebsiteChallengeStatus:
        self._validate_instant(now)
        if self.released_at is not None:
            return "released"
        if self.verified_at is not None:
            return "verified"
        if now >= self.reservation_expires_at:
            return "expired"
        return "pending" if self.challenge_digest is not None else "not-issued"

    @staticmethod
    def _validate_instant(value: datetime) -> None:
        if not isinstance(value, datetime) or value.utcoffset() is None:
            raise ValidationException("Website timestamps must be timezone-aware")
