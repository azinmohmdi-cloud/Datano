from datetime import UTC, datetime

from app.domain.entities import WebsiteEntity
from app.interface.dto.website_dto import Website


class WebsiteMapper:
    @staticmethod
    def to_dto(source: WebsiteEntity, *, now: datetime | None = None) -> Website:
        return Website(id=source.id, hostname=source.hostname, scheme=source.scheme,
            url=f"{source.scheme}://{source.hostname}/", is_verified=source.verified_at is not None,
            challenge_status=source.challenge_status(now if now is not None else datetime.now(UTC)),
            reservation_expires_at=source.reservation_expires_at, challenge_expires_at=source.challenge_expires_at,
            verified_at=source.verified_at, created_at=source.created_at, updated_at=source.updated_at)
