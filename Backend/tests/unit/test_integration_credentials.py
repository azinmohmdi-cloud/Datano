import pytest

from app.application.use_cases.integration.credentials import MAX_REFRESH_TOKEN_BYTES, OAuthCredential
from app.domain.error.exceptions import ServiceUnavailableException, ValidationException
from app.infra.services.integration_credentials import AESCredentialCipher
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def test_stored_credential_is_not_plaintext():
    cipher = AESCredentialCipher(b"k" * 32)
    credential = OAuthCredential("test-only-refresh-token")
    encrypted = cipher.encrypt(credential, b"test-owner-site-source-property")
    assert credential.refresh_token.encode() not in encrypted
    assert cipher.decrypt(encrypted, b"test-owner-site-source-property") == credential
    assert "test-only-refresh-token" not in repr(credential)


def test_same_token_has_independent_nonces_and_preserves_exact_unicode():
    cipher = AESCredentialCipher(b"k" * 32)
    value = OAuthCredential(" توکن آزمایشی exact ")
    first, second = (cipher.encrypt(value, b"identity") for _ in range(2))
    assert first != second
    assert cipher.decrypt(first, b"identity") == value


@pytest.mark.parametrize("change", ["key", "context", "nonce", "tag", "version", "truncated"])
def test_ciphertext_tampering_and_wrong_context_fail_closed(change):
    cipher = AESCredentialCipher(b"k" * 32)
    encrypted = cipher.encrypt(OAuthCredential("test-only-secret"), b"identity")
    context = b"identity"
    if change == "key": cipher = AESCredentialCipher(b"x" * 32)
    if change == "context": context = b"another-owner-or-property"
    if change in {"nonce", "tag", "version"}:
        index = {"nonce": 1, "tag": -1, "version": 0}[change]
        mutable = bytearray(encrypted); mutable[index] ^= 1; encrypted = bytes(mutable)
    if change == "truncated": encrypted = encrypted[:15]
    with pytest.raises(ServiceUnavailableException) as error:
        cipher.decrypt(encrypted, context)
    assert str(error.value) == "Integration credential is unavailable"
    assert error.value.details == {}


@pytest.mark.parametrize("token", ["", "  ", None, 123, "x" * (MAX_REFRESH_TOKEN_BYTES + 1), "\ud800"])
def test_invalid_credentials_do_not_echo_input(token):
    with pytest.raises(ValidationException) as error:
        OAuthCredential(token)
    assert str(error.value) == "Invalid integration credential"


@pytest.mark.parametrize("context", [b"", "not-bytes", b"x" * 8193])
def test_invalid_context_is_rejected(context):
    cipher = AESCredentialCipher(b"k" * 32)
    with pytest.raises(ValidationException): cipher.encrypt(OAuthCredential("token"), context)
    with pytest.raises(ValidationException): cipher.decrypt(b"invalid", context)


@pytest.mark.parametrize("key", [b"", b"x" * 16, b"x" * 31, b"x" * 33, "not-bytes"])
def test_only_256_bit_private_keys_are_accepted(key):
    with pytest.raises(ValueError, match="INTEGRATION_CREDENTIAL_KEY"):
        AESCredentialCipher(key)


def test_maximum_token_byte_length_round_trips():
    credential = OAuthCredential("ت" * (MAX_REFRESH_TOKEN_BYTES // 2))
    cipher = AESCredentialCipher(b"k" * 32)
    assert cipher.decrypt(cipher.encrypt(credential, b"context"), b"context") == credential


@pytest.mark.parametrize("payload", [b"", b" ", b"\xff"])
def test_authenticated_but_invalid_plaintext_fails_closed(payload):
    envelope = b"\x01" + b"n" * 12 + AESGCM(b"k" * 32).encrypt(b"n" * 12, payload, b"context")
    with pytest.raises(ServiceUnavailableException): AESCredentialCipher(b"k" * 32).decrypt(envelope, b"context")
