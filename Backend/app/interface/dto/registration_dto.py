from pydantic import BaseModel, ConfigDict, SecretStr


class UserRegistration(BaseModel):
    """Public registration; role, activation and internal identity are server-owned."""
    model_config = ConfigDict(extra="forbid")

    first_name: str
    last_name: str
    email: str
    password: SecretStr
