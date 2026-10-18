import bcrypt
import pytest
from argon2 import PasswordHasher, Type, extract_parameters

from app.domain.entities import UserEntity
from app.domain.error.exceptions import DomainException, ValidationException
from app.infra.services.password_service import BcryptPasswordService
from app.infra.utils.password import hash_password, verify_password


@pytest.mark.parametrize("password", ["a" * 15, "a" * 128, "رمزعبورفارسیبلند", "😀" * 15, " " * 15, "a\u200cb" * 5])
def test_new_hash_is_argon2id_and_preserves_full_unicode(password):
    encoded = hash_password(password)
    assert encoded.startswith("$argon2id$")
    params = extract_parameters(encoded)
    assert params.type == Type.ID and params.memory_cost >= 19456
    assert params.time_cost >= 2 and params.parallelism >= 1
    assert verify_password(password, encoded)
    assert not verify_password(password + "x", encoded)


@pytest.mark.parametrize("password", ["a" * 14, "a" * 129, "😀" * 14, "\ud800" * 15])
def test_new_password_policy_rejects_invalid_lengths_or_unicode(password):
    with pytest.raises(ValidationException):
        hash_password(password)


@pytest.mark.parametrize("password", ["x" * 72 + "tail-one", "ف" * 35 + "😀" * 4])
def test_new_hash_never_authenticates_a_truncated_prefix(password):
    encoded = hash_password(password)
    assert verify_password(password, encoded)
    prefix = password.encode("utf-8")[:72].decode("utf-8", errors="ignore")
    assert not verify_password(prefix, encoded)
    assert not verify_password(prefix + "other-tail", encoded)


def test_password_spaces_and_unicode_forms_are_distinct():
    original = "  pass é ک\u200cی 12345  "
    encoded = hash_password(original)
    assert verify_password(original, encoded)
    assert not verify_password(original.strip(), encoded)
    assert not verify_password(original.replace("é", "e\u0301"), encoded)
    assert not verify_password(original.replace("\u200c", ""), encoded)


@pytest.mark.parametrize("password", ["Secret123", "a" * 72, "ف" * 36])
def test_valid_legacy_bcrypt_upgrades_without_new_password_length_restrictions(password):
    old_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=4)).decode()
    service = BcryptPasswordService()
    verified = service.verify_and_rehash(password, old_hash)
    assert verified.valid and verified.replacement_hash.startswith("$argon2id$")
    assert verify_password(password, verified.replacement_hash)
    assert service.verify_and_rehash(password, verified.replacement_hash).replacement_hash is None
    assert not service.verify_and_rehash("!" + password[1:], old_hash).valid


def test_bcrypt_over_72_bytes_requires_recovery_instead_of_truncating():
    old_hash = bcrypt.hashpw(b"a" * 72, bcrypt.gensalt(rounds=4)).decode()
    with pytest.raises(DomainException) as error:
        verify_password("a" * 72 + "different-tail", old_hash)
    assert error.value.error_code == "PASSWORD_RESET_REQUIRED"
    assert error.value.status_code == 401


@pytest.mark.parametrize("stored", ["", "not-a-hash", "$2b$broken", "$argon2id$broken", "$2b$31$short", "$2b$04$" + "." * 21 + "z" + "." * 31])
def test_malformed_hashes_fail_closed_without_driver_errors(stored):
    assert verify_password("a valid password", stored) is False


@pytest.mark.parametrize("plain,stored", [(None, "hash"), ("fixture", None), ("\ud800", "$argon2id$broken")])
def test_invalid_internal_inputs_fail_closed(plain, stored):
    assert verify_password(plain, stored) is False


@pytest.mark.parametrize("hasher", [PasswordHasher(memory_cost=1024, time_cost=1), PasswordHasher(type=Type.I)])
def test_new_hash_target_cannot_weaken_the_security_floor(hasher):
    with pytest.raises(ValueError, match="security floor"):
        BcryptPasswordService(hasher)


def test_low_cost_argon2_is_upgraded_without_downgrading_stronger_parameters():
    service = BcryptPasswordService()
    password = "legacy8"
    old_hash = PasswordHasher(memory_cost=24576, time_cost=1, parallelism=1).hash(password)
    result = service.verify_and_rehash(password, old_hash)
    assert result.valid and result.replacement_hash
    params = extract_parameters(result.replacement_hash)
    assert params.memory_cost >= 24576 and params.time_cost >= 2
    strong = PasswordHasher(memory_cost=24576, time_cost=3, parallelism=1).hash(password)
    assert service.verify_and_rehash(password, strong).replacement_hash is None


@pytest.mark.parametrize("length,valid", [(14, False), (15, True), (128, True), (129, False)])
def test_domain_password_policy_counts_unicode_codepoints(length, valid):
    if valid:
        UserEntity._validate_password("آ" * length)
    else:
        with pytest.raises(ValidationException):
            UserEntity._validate_password("آ" * length)
