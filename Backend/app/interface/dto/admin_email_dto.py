from pydantic import BaseModel, ConfigDict, SecretStr


class AdminEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AdminEmailCode(AdminEmailRequest):
    code: SecretStr
