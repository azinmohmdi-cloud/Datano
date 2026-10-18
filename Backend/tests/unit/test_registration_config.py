import pytest
from pydantic import ValidationError

from app.infra.core.config import Config


@pytest.mark.parametrize("name", ["REGISTRATION_IP_LIMIT","REGISTRATION_WINDOW_SECONDS","REGISTRATION_MAX_BODY_BYTES"])
@pytest.mark.parametrize("value", [0,-1])
def test_registration_controls_cannot_be_disabled_with_nonpositive_settings(name, value):
    with pytest.raises(ValidationError):
        Config(_env_file=None, **{name:value})


def test_registration_limit_settings_are_explicit_and_configurable():
    settings = Config(_env_file=None, REGISTRATION_IP_LIMIT=2, REGISTRATION_WINDOW_SECONDS=30, REGISTRATION_MAX_BODY_BYTES=4096)
    assert (settings.registration_ip_limit,settings.registration_window_seconds,settings.registration_max_body_bytes) == (2,30,4096)
