"""Private operator entry point; no HTTP provisioning or SMTP network activity."""
import asyncio
import os
from pathlib import Path
import subprocess
import sys

from sqlalchemy import text

from tests.integration.test_admin_grants import authority_account
from tests.postgres import isolated_postgres_url, persistent_database


async def test_private_cli_provisions_existing_eligible_account_and_revokes_sessions(
        persistent_database, isolated_postgres_url, authority_account, tmp_path):
    private = tmp_path / 'private.env'
    private.write_text('DATABASE_URL=' + isolated_postgres_url.render_as_string(hide_password=False)
        + '\nADMIN_EMAIL_ALLOWLIST=["authority@example.test"]\n')
    private.chmod(0o600)
    from app.infra.repositories.postgres.session_repository import SQLSessionRepository
    async with persistent_database.transaction() as session:
        await SQLSessionRepository(session).create(b'a'*32, authority_account.id,
            remember_me=False,idle_seconds=1800,absolute_seconds=43200)
    def run(*args):
        # Do not inherit developer settings or accidentally target an app DB.
        environment={k:v for k,v in os.environ.items() if k in {'PATH','SYSTEMROOT','PYTHONPATH'}}
        return subprocess.run([sys.executable,'-m','scripts.provision_admin','--env-file',str(private),
            '--user-id',authority_account.id,*args],cwd=Path(__file__).resolve().parents[2],
            env=environment,capture_output=True,text=True,timeout=20)
    denied=await asyncio.to_thread(run)
    assert denied.returncode == 2
    async with persistent_database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM admin_grants')) == 0
    success=await asyncio.to_thread(run,'--provision')
    assert success.returncode == 0, success.stdout + success.stderr
    assert 'revoked' in success.stdout
    for secret in (authority_account.id,authority_account.email,private.read_text(),isolated_postgres_url.password):
        assert secret not in success.stdout + success.stderr
    async with persistent_database.transaction() as session:
        assert await session.scalar(text("SELECT method FROM admin_grants WHERE user_id=:id"),{'id':authority_account.id}) == 'provisioning'
        assert await session.scalar(text('SELECT count(*) FROM auth_sessions WHERE revoked_at IS NULL')) == 0
    private.write_text('ADMIN_EMAIL_ALLOWLIST=private-invalid-content\n')
    failure=await asyncio.to_thread(run,'--provision')
    assert failure.returncode == 2 and 'private-invalid-content' not in failure.stdout + failure.stderr
