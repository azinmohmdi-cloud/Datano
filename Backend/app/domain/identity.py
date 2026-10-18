"""Shared identity keys. Passwords deliberately have no normalization function."""


def canonical_email(email: str) -> str:
    """Only Unicode strip/lower; preserve dots, plus tags and provider identity."""
    return email.strip().lower()
