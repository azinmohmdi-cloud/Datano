"""Private operator provisioning, never exposed by the application HTTP API."""
from __future__ import annotations

import argparse
import asyncio
from pathlib import Path
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.infra.core.config import Config


async def provision(settings: Config, user_id: str) -> bool:
    from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
    from app.infra.database.connection import Database
    from app.infra.repositories.postgres.admin_proof_repository import PostgresAdminProofRepository
    value = settings.admin_email_allowlist
    policy = AdminEmailPolicy.parse(value.get_secret_value() if value else None)
    database = Database.from_config(settings)
    try:
        return await PostgresAdminProofRepository(database, policy).provision(user_id)
    finally:
        await database.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Provision one existing eligible active administrator")
    parser.add_argument('--env-file', type=Path, required=True, help='Private Git-ignored server settings')
    parser.add_argument('--user-id', required=True, help='Existing server-owned user ID')
    parser.add_argument('--provision', action='store_true', help='Explicitly grant authority and revoke all existing sessions')
    args = parser.parse_args(argv)
    if not args.provision or not args.env_file.is_file():
        print('Provisioning requires a private settings file and explicit --provision', file=sys.stderr)
        return 2
    # Even malformed configuration, import failures, DSNs and driver errors must
    # not escape as terminal tracebacks containing private operator inputs.
    try:
        from app.infra.core.config import Config
        settings = Config(_env_file=args.env_file)
        granted = asyncio.run(provision(settings, args.user_id))
    except Exception:
        print('Administrator provisioning failed; check private configuration and database health', file=sys.stderr)
        return 2
    if not granted:
        print('Administrator provisioning denied; existing active account, private eligibility and active Admin role required', file=sys.stderr)
        return 3
    print('Administrator authority provisioned; all prior sessions revoked; sign in again')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
