from typing import Self

from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from pydantic.json_schema import SkipJsonSchema


class OwnProfileUpdate(BaseModel):
    """Omitted names are preserved; explicit null and account-control fields fail."""
    model_config = ConfigDict(extra="forbid", strict=True, json_schema_extra={"minProperties": 1})

    first_name: str | SkipJsonSchema[None] = None
    last_name: str | SkipJsonSchema[None] = None

    @field_validator("first_name", "last_name")
    @classmethod
    def supplied_name_is_not_null(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Supplied name must be a string")
        return value

    @model_validator(mode="after")
    def contains_a_name(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one name is required")
        return self
