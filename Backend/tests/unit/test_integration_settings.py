import base64
from types import SimpleNamespace

import pytest

from app.application.use_cases.integration.credentials import OAuthCredential
from app.infra.core.config import Config
from app.infra.services.integration_credentials import AESCredentialCipher
from app.interface.dependencies.integration_dependencies import get_integration_cipher, get_integration_repository
from app.interface.repository.integration_repository_interface import IIntegrationRepository

KEY = base64.urlsafe_b64encode(b"k" * 32).decode("ascii")


@pytest.mark.parametrize("value", [None, "", "private-invalid-key", "x" * 44,
    base64.urlsafe_b64encode(b"x" * 16).decode("ascii"), KEY.rstrip("="), KEY[:-2] + "l="])
def test_missing_and_invalid_configuration_fails_without_echo(value):
    settings = Config(_env_file=None, INTEGRATION_CREDENTIAL_KEY=value)
    with pytest.raises(ValueError) as error: AESCredentialCipher.from_config(settings)
    assert str(error.value).startswith("INTEGRATION_CREDENTIAL_KEY must be")
    assert "private-invalid-key" not in str(error.value)


def test_key_is_private_and_dependency_uses_configured_cipher():
    settings = Config(_env_file=None, INTEGRATION_CREDENTIAL_KEY=KEY)
    assert KEY not in repr(settings) and "integration_credential_key" not in settings.model_dump()
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=settings)))
    first = get_integration_cipher(request)
    other = AESCredentialCipher.from_config(settings)
    encrypted = first.encrypt(OAuthCredential("test-only-secret"), b"context")
    assert other.decrypt(encrypted, b"context").refresh_token == "test-only-secret"
    assert KEY not in repr(first)
    repo = get_integration_repository(object(), first)
    assert isinstance(repo, IIntegrationRepository)


def test_no_jwt_or_csrf_key_fallback(monkeypatch):
    monkeypatch.delenv("INTEGRATION_CREDENTIAL_KEY", raising=False)
    settings = Config(_env_file=None, SECRET_KEY=KEY, CSRF_SECRET_KEY=KEY)
    with pytest.raises(ValueError): AESCredentialCipher.from_config(settings)
