from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.domain.error.exceptions import ServiceUnavailableException
from app.infra.core.config import Config
from app.interface.dependencies.recovery_dependencies import get_password_recovery_flow
from app.interface.recovery_route import get_recovery_limiter
from app.interface.recovery_cookie import recovery_cookie_name, write_recovery_cookie, clear_recovery_cookie
from fastapi import Response


@pytest.mark.parametrize('settings', [dict(RECOVERY_IP_LIMIT=0),dict(RECOVERY_WINDOW_SECONDS=0),
    dict(RECOVERY_MAX_BODY_BYTES=0),dict(RECOVERY_GRANT_SECONDS=0),dict(RECOVERY_GRANT_SECONDS=601)])
def test_recovery_limits_are_bounded(settings):
    with pytest.raises(ValidationError):
        Config(_env_file=None,**settings)


def test_missing_code_key_has_uniform_safe_failure():
    request=SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=Config(_env_file=None))))
    with pytest.raises(ServiceUnavailableException) as caught:
        get_password_recovery_flow(request)
    assert caught.value.__context__ is None


def test_missing_database_cannot_disable_recovery_quota():
    request=SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace()))
    with pytest.raises(ServiceUnavailableException):
        get_recovery_limiter(request)


def test_recovery_local_cookie_requires_existing_explicit_local_http_opt_in():
    request=SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=Config(_env_file=None,SESSION_ALLOW_INSECURE_LOCAL_HTTP=True))),
        url=SimpleNamespace(scheme='http',hostname='localhost'))
    assert recovery_cookie_name(request)=='datano_recovery_dev'
    response=Response()
    write_recovery_cookie(request,response,'synthetic-token',600)
    assert 'Secure' not in response.headers['set-cookie'] and 'HttpOnly' in response.headers['set-cookie']
    clear_recovery_cookie(request,response)
    assert any('Max-Age=0' in value for value in response.headers.getlist('set-cookie'))
