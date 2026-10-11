"""
Configuration validation and application startup guard.
"""

import sys
from typing import List

from app.infra.core.config import Config


def validate_config(config: Config) -> List[str]:
    errors = []
    if not config.secret_key or len(config.secret_key) < 16:
        errors.append(
            "SECRET_KEY must exist and be at least 16 characters long for security"
        )
    return errors


def ensure_valid_config() -> Config:
    try:
        config = Config()
    except Exception as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)

    errors = validate_config(config)
    if errors:
        print("Configuration validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        sys.exit(1)

    return config
