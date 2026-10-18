import pytest
from pydantic import SecretStr
from sqlalchemy.engine import URL

from app.infra.core.config import Config
from app.infra.database.connection import Database, configured_database_url, validate_database_url


def test_database_url_can_be_configured_without_exposing_credentials() -> None:
    value = "postgresql+psycopg://datano:test-only-password@localhost/datano"
    settings = Config(_env_file=None, DATABASE_URL=value)
    assert isinstance(settings.database_url, SecretStr)
    assert settings.database_url.get_secret_value() == value
    assert "test-only-password" not in repr(settings)


def test_existing_in_memory_setup_does_not_require_a_database(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Config(_env_file=None)
    assert settings.database_url is None


@pytest.mark.parametrize("value", [None, ""])
def test_database_operations_require_explicit_configuration(value) -> None:
    settings = Config(_env_file=None, DATABASE_URL=value)
    with pytest.raises(ValueError, match="DATABASE_URL is required"):
        Database.from_config(settings)


@pytest.mark.parametrize("value", [
    "invalid-secret-url",
    "postgresql+psycopg://datano:private-value@localhost:invalid/datano",
    "sqlite+aiosqlite:///private-value.db",
    "postgresql://datano:private-value@localhost/datano",
    "postgresql+psycopg://datano:private-value@/datano",
    "postgresql+psycopg://datano:private-value@localhost",
])
def test_invalid_database_targets_fail_without_leaking_credentials(value: str) -> None:
    with pytest.raises(ValueError) as error:
        validate_database_url(value)
    assert "private-value" not in str(error.value)
    assert "invalid-secret-url" not in str(error.value)


def test_encoded_credentials_are_preserved_without_string_interpolation() -> None:
    expected = URL.create(
        "postgresql+psycopg", username="datano", password="test@:/%password",
        host="localhost", database="datano",
    )
    settings = Config(_env_file=None, DATABASE_URL=expected.render_as_string(hide_password=False))
    assert configured_database_url(settings) == expected
