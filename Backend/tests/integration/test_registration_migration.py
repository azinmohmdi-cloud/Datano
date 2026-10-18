from sqlalchemy import inspect, text

from app.infra.database.connection import Database
from tests.postgres import isolated_postgres_url, migrate


async def test_registration_counter_migration_preserves_identity_data(isolated_postgres_url):
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0003_email_identity")
            await connection.execute(text("""INSERT INTO users VALUES
                ('preserved', 'First', 'Last', 'keep@example.test', 'preserved',
                 'unchanged-hash', now(), now(), true, 'keep@example.test')"""))
            before = dict((await connection.execute(text("SELECT * FROM users WHERE id='preserved'"))).mappings().one())
            await connection.run_sync(migrate, "0004_registration_attempts")
            assert "registration_attempts" in await connection.run_sync(lambda sync: inspect(sync).get_table_names())
            assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "0004_registration_attempts"
            assert dict((await connection.execute(text("SELECT * FROM users WHERE id='preserved'"))).mappings().one()) == before
            await connection.run_sync(migrate, "0004_registration_attempts")
        async with database.engine.begin() as connection:
            await connection.run_sync(lambda sync: migrate(sync, "0003_email_identity", downgrade=True))
            assert "registration_attempts" not in await connection.run_sync(lambda sync: inspect(sync).get_table_names())
            assert dict((await connection.execute(text("SELECT * FROM users WHERE id='preserved'"))).mappings().one()) == before
            await connection.run_sync(migrate, "0004_registration_attempts")
    finally:
        await database.dispose()
