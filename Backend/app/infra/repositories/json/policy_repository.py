"""Implementation of the policy repository using JSON files.
This reads policies from the JSON file instead of a database.
"""

import json
from datetime import datetime
from typing import List, Optional

from app.domain.entities import PolicyEntity
from app.infra.core.config import config
from app.interface.repository.policy_repository_interface import (
    IPolicyRepository,
)


class JSONPolicyRepository(IPolicyRepository):
    """Implementation of policy repository operations using JSON file."""

    def __init__(self):
        self.policies_path = config.policies_path

    async def get_by_id(self, policy_id: str) -> Optional[PolicyEntity]:
        """Get a policy by ID from the JSON file."""
        policies = await self._load_policies()
        for policy_data in policies:
            if policy_data["id"] == policy_id:
                return self._create_policy_entity(policy_data)

    async def get_by_title(self, title: str) -> Optional[PolicyEntity]:
        """Get a policy by title from the JSON file."""
        policies = await self._load_policies()
        for policy_data in policies:
            if policy_data["title"] == title:
                return self._create_policy_entity(policy_data)

    async def get_all(self) -> List[PolicyEntity]:
        """Get all policies from the JSON file."""
        policies = await self._load_policies()
        return [self._create_policy_entity(policy_data) for policy_data in policies]

    async def search_by_title(self, title_query: str) -> List[PolicyEntity]:
        """Search policies by title from the JSON file."""
        policies = await self._load_policies()
        matching_policies = [
            policy_data
            for policy_data in policies
            if title_query.lower() in policy_data["title"].lower()
        ]
        return [
            self._create_policy_entity(policy_data) for policy_data in matching_policies
        ]

    async def _load_policies(self) -> List[dict]:
        """Load policies from the JSON file."""
        try:
            with open(self.policies_path, "r") as f:
                return json.load(f)
        except FileNotFoundError:
            return []
        except json.JSONDecodeError:
            return []

    def _create_policy_entity(self, policy_data: dict) -> PolicyEntity:
        """Create a PolicyEntity from JSON data."""

        # Parse datetime strings (handle 'Z' suffix for UTC)
        created_at = datetime.fromisoformat(
            policy_data["created_at"].replace("Z", "+00:00")
        )
        updated_at = datetime.fromisoformat(
            policy_data["updated_at"].replace("Z", "+00:00")
        )

        return PolicyEntity(
            id=policy_data["id"],
            title=policy_data["title"],
            description=policy_data["description"],
            created_at=created_at,
            updated_at=updated_at,
        )
