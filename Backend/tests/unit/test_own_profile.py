from dataclasses import asdict
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.user.update_own_profile import UpdateOwnProfileRequest, UpdateOwnProfileUseCase
from app.domain.entities import UserEntity
from app.domain.error.exceptions import CredentialsValidationException, ValidationException
from app.infra.repositories.in_memory.user_repository import InMemoryUserRepository


@pytest.fixture
async def profile():
    user=UserEntity.create(first_name='Original',last_name='Owner',email='profile@example.test',
        username='profile-owner',hashed_password='test-only-profile-hash')
    user.activate()
    repository=InMemoryUserRepository()
    await repository.create(user)
    return user,repository,UpdateOwnProfileUseCase(repository)


@pytest.mark.parametrize('changes',[
    {'first_name':'نام تازه','last_name':''}, {'first_name':'','last_name':'نام تازه'},
    {'first_name':' \u2003\t\n '}, {'last_name':'\ud800'}, {'last_name':'bad\x00name'},
    {'first_name':42}, {},
])
async def test_failed_validation_never_changes_shared_entity_or_timestamp(profile,changes):
    user,repository,usecase=profile
    before=asdict(user)
    repository.update_profile_names=AsyncMock(wraps=repository.update_profile_names)
    with pytest.raises(ValidationException):
        await usecase.execute(user.id,UpdateOwnProfileRequest(**changes))
    assert asdict(user) == before
    assert asdict(await repository.get_by_id(user.id)) == before
    repository.update_profile_names.assert_not_awaited()


@pytest.mark.parametrize('changes',[
    {'first_name':'  آوا\u200cآذری  '}, {'last_name':'Cafe\u0301'},
    {'first_name':'ن'*4096,'last_name':'李 😀'},
])
async def test_valid_patch_preserves_spelling_and_all_uneditable_fields(profile,changes):
    user,repository,usecase=profile
    before=asdict(user)
    updated=await usecase.execute(user.id,UpdateOwnProfileRequest(**changes))
    assert updated.updated_at >= user.updated_at
    for name,value in before.items():
        if name != 'updated_at':
            assert getattr(updated,name) == changes.get(name,value)
    assert updated is not user and asdict(user) == before


@pytest.mark.parametrize('state',['missing','inactive','lost-write'])
async def test_unavailable_account_is_not_reactivated_or_created(profile,state):
    user,repository,usecase=profile
    if state == 'inactive': user.deactivate()
    if state == 'missing': await repository.delete(user.id)
    if state == 'lost-write': repository.update_profile_names=AsyncMock(return_value=None)
    before=asdict(user)
    with pytest.raises(CredentialsValidationException):
        await usecase.execute(user.id,UpdateOwnProfileRequest(first_name='Denied'))
    assert asdict(user) == before


async def test_write_failure_does_not_mutate_shared_read_object(profile):
    user,repository,usecase=profile
    before=asdict(user)
    repository.update_profile_names=AsyncMock(side_effect=RuntimeError('Injected write failure'))
    with pytest.raises(RuntimeError):
        await usecase.execute(user.id,UpdateOwnProfileRequest(first_name='Must not persist'))
    assert asdict(user) == before


@pytest.mark.parametrize('state',['missing','inactive'])
async def test_memory_names_write_requires_existing_active_account(profile,state):
    user,repository,_=profile
    if state == 'missing': await repository.delete(user.id)
    else: user.deactivate()
    assert await repository.update_profile_names(user.id,first_name='Denied',last_name=None,updated_at=user.updated_at) is None


def test_domain_rejects_second_invalid_name_before_mutating_first_name():
    user=UserEntity.create(first_name='Original',last_name='Owner',email='profile@example.test',
        username='profile-owner',hashed_password='test-only-hash')
    before=asdict(user)
    with pytest.raises(ValidationException):
        user.update_profile_names(first_name='Must not persist',last_name=' ')
    assert asdict(user) == before
