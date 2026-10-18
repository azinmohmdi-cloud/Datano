from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.auth import LogoutRequest, LogoutUseCase
from app.application.use_cases.auth.session_service import SessionService


@pytest.mark.parametrize("revoked", [True, False])
async def test_logout_revokes_only_the_supplied_current_session(revoked):
    sessions = AsyncMock(spec=SessionService)
    sessions.revoke.return_value = revoked
    result = await LogoutUseCase(sessions).execute(LogoutRequest(session_token="private-session"))
    assert result.success is True
    sessions.revoke.assert_awaited_once_with("private-session")
    sessions.revoke_all.assert_not_awaited()
    sessions.issue.assert_not_awaited()
    sessions.resolve.assert_not_awaited()


async def test_absent_cookie_has_no_session_to_revoke():
    sessions = AsyncMock(spec=SessionService)
    result = await LogoutUseCase(sessions).execute(LogoutRequest())
    assert result.success is True
    sessions.revoke.assert_not_awaited()


async def test_storage_failure_is_not_reported_as_logout_success():
    sessions = AsyncMock(spec=SessionService)
    sessions.revoke.side_effect = RuntimeError("Injected session storage failure")
    with pytest.raises(RuntimeError, match="Injected session storage failure"):
        await LogoutUseCase(sessions).execute(LogoutRequest(session_token="private-session"))


def test_logout_request_representation_does_not_disclose_session():
    assert "private-session" not in repr(LogoutRequest(session_token="private-session"))
