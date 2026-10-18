import pytest

from app.domain.entities import UserEntity
from app.domain.error.exceptions import ConflictException
from app.infra.repositories.in_memory.user_repository import InMemoryUserRepository
from app.interface.dto import User, UserCreate, UserLogin


def person(email, username="fixture"):
    return UserEntity.create(first_name="Test", last_name="Identity", email=email,
        username=username, hashed_password="already-hashed")


def test_username_is_not_required_in_product_contracts():
    assert not UserCreate.model_fields["username"].is_required()
    assert not UserLogin.model_fields["username"].is_required()
    assert not User.model_fields["username"].is_required()
    request = UserCreate(first_name="Test", last_name="User", email="test@example.test", password="Long password 123!")
    assert request.username is None


@pytest.mark.parametrize("email", ["  First.Last+tag@EXAMPLE.TEST  ", "\u00a0First.Last+tag@EXAMPLE.TEST\u2003", "\tFirst.Last+tag@EXAMPLE.TEST\n"])
async def test_email_key_is_trimmed_lowercase_and_keeps_display_case(email):
    repo = InMemoryUserRepository()
    entity = person(email)
    assert entity.email == "First.Last+tag@EXAMPLE.TEST"
    await repo.create(entity)
    assert await repo.get_by_email(" first.last+tag@example.test ") == entity
    assert await repo.get_by_email("firstlast+tag@example.test") is None
    assert await repo.get_by_email("first.last@example.test") is None


async def test_case_and_whitespace_variants_conflict_through_use_case():
    from app.application.use_cases.user import CreateUserRequest, CreateUserUseCase
    from app.infra.services.password_service import BcryptPasswordService
    repo = InMemoryUserRepository()
    use_case = CreateUserUseCase(repo, BcryptPasswordService())
    await use_case.execute(CreateUserRequest(first_name="First",last_name="User",email="First@EXAMPLE.TEST",username="first",password="Long password 123!"))
    with pytest.raises(ConflictException):
        await use_case.execute(CreateUserRequest(first_name="Second",last_name="User",email=" first@example.test ",username="second",password="Long password 123!"))
