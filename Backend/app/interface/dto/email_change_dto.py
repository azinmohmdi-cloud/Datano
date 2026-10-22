from pydantic import BaseModel, ConfigDict, SecretStr, field_validator

from app.application.use_cases.auth.email_change import email_change_target


class EmailChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: SecretStr

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: SecretStr) -> SecretStr:
        return SecretStr(email_change_target(value.get_secret_value()))


class EmailChangeCode(EmailChangeRequest):
    code: SecretStr
