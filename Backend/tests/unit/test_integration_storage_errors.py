import traceback
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.application.use_cases.integration.credentials import OAuthCredential
from app.domain.error.exceptions import ServiceUnavailableException
from app.infra.repositories.postgres.integration_repository import SQLIntegrationRepository
from app.infra.services.integration_credentials import AESCredentialCipher


@pytest.mark.parametrize("operation", ["read", "metadata", "credential", "write"])
async def test_storage_errors_do_not_leak_driver_details_or_credentials(operation):
    session = AsyncMock()
    session.scalar.side_effect = SQLAlchemyError("test-only-private-driver-value")
    repo = SQLIntegrationRepository(session, AESCredentialCipher(b"k" * 32))
    with pytest.raises(ServiceUnavailableException) as error:
        if operation == "read": await repo.get_active("owner", "site", "gsc")
        if operation == "metadata": await repo.get_by_id("owner", "site", "integration")
        if operation == "credential": await repo.get_credential("owner", "site", "integration")
        if operation == "write": await repo.save_selection("owner", "site", "gsc", "property", OAuthCredential("test-only-token"), expected=None)
    assert str(error.value) == "Integration storage is unavailable" and error.value.details == {}
    assert "test-only-private-driver-value" not in "".join(traceback.format_exception(error.value))
