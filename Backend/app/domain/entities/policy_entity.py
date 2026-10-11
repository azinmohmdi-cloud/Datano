"""
Domain Entity for Policy - contains business logic and behavior
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Optional
from uuid import uuid4


@dataclass
class PolicyEntity:
    """Domain entity for Policy with business logic."""

    id: str
    title: str
    description: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def create(
        cls,
        title: str,
        description: str,
        policy_id: Optional[str] = None,
    ) -> "PolicyEntity":
        """Create a new PolicyDomain entity."""
        policy_id = policy_id or str(uuid4())
        now = datetime.now(UTC)

        return cls(
            id=policy_id,
            title=title,
            description=description,
            created_at=now,
            updated_at=now,
        )
