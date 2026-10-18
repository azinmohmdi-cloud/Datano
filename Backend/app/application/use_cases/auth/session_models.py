"""Technical session metadata and policy; no plaintext identifier in stored records."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class SessionPolicy:
    idle_seconds: int = 1800
    absolute_seconds: int = 43200
    remember_idle_seconds: int = 604800
    remember_absolute_seconds: int = 2592000

    def __post_init__(self) -> None:
        for idle, absolute in ((self.idle_seconds, self.absolute_seconds),
                               (self.remember_idle_seconds, self.remember_absolute_seconds)):
            if (type(idle) is not int or type(absolute) is not int
                    or not 0 < idle <= absolute <= 2147483647):
                raise ValueError("Session lifetimes must be positive seconds with idle <= absolute")

    def timeouts(self, remember_me: bool) -> tuple[int, int]:
        if remember_me:
            return self.remember_idle_seconds, self.remember_absolute_seconds
        return self.idle_seconds, self.absolute_seconds


@dataclass(frozen=True)
class SessionRecord:
    digest: bytes = field(repr=False)
    user_id: str
    remember_me: bool
    idle_timeout_seconds: int
    created_at: datetime
    last_seen_at: datetime
    idle_expires_at: datetime
    absolute_expires_at: datetime
    revoked_at: datetime | None = None

    def is_valid_at(self, now: datetime) -> bool:
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("Session clock must be timezone aware")
        return (self.revoked_at is None and self.created_at <= now
                and self.last_seen_at <= now < self.idle_expires_at
                and now < self.absolute_expires_at)


@dataclass(frozen=True)
class IssuedSession:
    token: str = field(repr=False)
    record: SessionRecord
