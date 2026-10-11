"""
Password utilities for hashing and verification.
"""

import bcrypt


def hash_password(password: str) -> str:
    """
    Hash a plain text password.

    Args:
        password: Plain text password to hash (truncated to 72 bytes if necessary)

    Returns:
        Hashed password string
    """
    # bcrypt has a 72-byte password length limit
    # Truncate to 72 bytes to avoid ValueError, preserving whole characters
    password_bytes = password.encode('utf-8')[:72]
    try:
        password = password_bytes.decode('utf-8')
    except UnicodeDecodeError:
        password = password_bytes.decode('utf-8', errors='ignore')

    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against its hash.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password to compare against

    Returns:
        True if passwords match, False otherwise
    """
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
