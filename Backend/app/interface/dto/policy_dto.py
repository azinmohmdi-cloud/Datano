from datetime import datetime

from pydantic import BaseModel


class PolicyBase(BaseModel):
    """Base Policy model with common fields."""

    title: str
    description: str


class Policy(PolicyBase):
    """Public Policy model without sensitive data"""

    id: str
    created_at: datetime
    updated_at: datetime
