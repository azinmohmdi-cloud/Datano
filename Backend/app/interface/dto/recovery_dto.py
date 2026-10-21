from pydantic import BaseModel, ConfigDict, SecretStr, field_validator

from app.application.use_cases.auth.email_codes import EmailCodeContext, EmailCodePurpose


class RecoveryEmail(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        return EmailCodeContext(EmailCodePurpose.PASSWORD_RECOVERY, "email-validation", value).recipient


class RecoveryCode(RecoveryEmail):
    code: SecretStr


class NewPassword(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: SecretStr
    password_confirmation: SecretStr


class RecoveryVerified(BaseModel):
    expires_in: int
    csrf_token: str
