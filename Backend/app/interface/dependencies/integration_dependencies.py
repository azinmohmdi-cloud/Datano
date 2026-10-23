from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.integration.credentials import ICredentialCipher
from app.infra.repositories.postgres.integration_repository import SQLIntegrationRepository
from app.infra.services.integration_credentials import AESCredentialCipher
from app.interface.dependencies.database_dependencies import get_database_session
from app.interface.repository.integration_repository_interface import IIntegrationRepository


def get_integration_cipher(request: Request) -> ICredentialCipher:
    return AESCredentialCipher.from_config(request.app.state.settings)


def get_integration_repository(session: AsyncSession = Depends(get_database_session),
    cipher: ICredentialCipher = Depends(get_integration_cipher)) -> IIntegrationRepository:
    return SQLIntegrationRepository(session, cipher)
