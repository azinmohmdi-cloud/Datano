# BE-003 — PostgreSQL, SQLAlchemy and Alembic foundation

Recorded on 2026-10-17. BE-002 was checked complete in the backlog and the
working tree was clean before this task. The existing Python 3.12.14/PDM 2.29.2
environment was reused. Scope is database infrastructure and migration tooling;
the existing in-memory repositories, seed, API contracts and frontend remain
unchanged. No user/role or analytics persistence model was introduced.

## Implementation and decisions

- `Database` owns an async SQLAlchemy engine/session factory. Every transaction
  context gets a separate session and commits on success, rolls back on raised
  errors/cancellation, and closes the session. Explicit `dispose()` releases the
  owner's pool. SQL parameters are hidden, connections use pre-ping and a
  five-second connection timeout. There is no global database instance or
  implicit connection at import time.
- `DATABASE_URL` is optional `SecretStr` configuration so the current in-memory
  application keeps starting. Database construction/migrations require an
  explicit `postgresql+psycopg` URL with a host and database. Invalid configuration
  errors do not echo the URL/password. URL objects preserve encoded credentials.
- Shared declarative metadata defines stable constraint naming without tables.
  Alembic supports async CLI execution, offline SQL and programmatic migrations
  through a supplied SQLAlchemy connection. CLI engines use `NullPool` and are
  disposed in `finally`; credentials are not interpolated into the INI file.
- Revision `0001_database_baseline` intentionally has no domain DDL. A real
  empty PostgreSQL schema gains only `alembic_version` with this revision marker.
  Downgrade to `base` removes the marker, leaving the empty version table, and
  never drops unrelated tables. This proves the migration pipeline, not future
  user/role or analytics schemas. No startup migration or `create_all` was added.
- PDM added SQLAlchemy 2.0.55, Alembic 1.20.0, psycopg/psycopg-binary 3.3.6,
  greenlet 3.5.6, Mako 1.4.3 and MarkupSafe 3.0.4. The lock also records tzdata
  2026.5 for Windows. `--update-reuse` preserved every retained package version.
  The resolver removed the old orphan `passlib`/`passlib[bcrypt]` lock records;
  passlib was not declared or imported by the application/tests. No manifest
  dependency or password implementation was removed or replaced.

The implementation follows the official
[SQLAlchemy async session/transaction API](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html),
[psycopg dialect](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#module-sqlalchemy.dialects.postgresql.psycopg),
and [Alembic async/shared-connection recipe](https://alembic.sqlalchemy.org/en/latest/cookbook.html#using-asyncio-with-alembic).

## Real PostgreSQL environment and isolation

Docker Desktop was initially stopped and was started for this validation. Only
the dedicated container `datano-be003-postgres` was created for Datano tests:

```sh
docker run --detach --rm --name datano-be003-postgres \
  --env-file /private/tmp/datano-be003/postgres.env \
  --tmpfs /var/lib/postgresql/data \
  -p 127.0.0.1:55433:5432 postgres:17-alpine
```

Observed server: **PostgreSQL 17.11**, aarch64 Linux/musl, image digest
`sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
The Docker [official PostgreSQL image](https://hub.docker.com/_/postgres)
used a new `datano_test` database on temporary RAM-backed storage. Random test
credentials were kept only in private files under `/private/tmp/datano-be003`
(directory mode 0700, files 0600), not source, command arguments or this report.

The database fixture requires `DATANO_TEST_DATABASE_URL` and a database name
starting with `datano_test`; missing or inappropriate configuration fails rather
than skips. It never falls back to the application's database. Each case creates
a new `be003_<uuid>` schema, sets only that connection's `search_path`, closes
its sessions/engines, and drops its own schema in `finally`. Test probe tables
are temporary fixture objects, not ORM metadata or migration product tables.
No production database or existing container data was migrated.

## Red → Green → Refactor and full validation

Commands ran from `Backend/`, using the locked environment. A private helper
`/private/tmp/datano-be003/run-tests.py` read the private URL file into
`DATANO_TEST_DATABASE_URL` and executed `.tools/pdm/bin/pdm run pytest` with the
supplied arguments. It also selected writable PDM cache/log directories under
`/private/tmp` and disabled PDM update checking. The database URL was never a
command-line argument. The following table shows the corresponding PDM commands.

| Check | Actual result |
| --- | --- |
| Red: `pdm run pytest tests/unit/test_database_settings.py tests/integration/test_database.py --junitxml=/private/tmp/datano-be003/red-behavior.xml` before implementing settings/transactions and before migration cases were added | 6 failures, 0 errors/skips in 0.57s: two missing-setting assertions and four unimplemented-transaction failures, using real PostgreSQL fixtures |
| Red: `pdm run pytest tests/unit/test_database_migrations.py tests/integration/test_database.py -k migration --junitxml=/private/tmp/datano-be003/migrations-red.xml` before calling `context.run_migrations()` | 4 failures, 4 deselected, 0 errors/skips in 2.17s: missing offline revision, missing real version table/marker, failed replay/downgrade checks and CLI with no applied migration |
| Green: `pdm run pytest tests/unit/test_database_settings.py tests/unit/test_database_migrations.py tests/integration/test_database.py --junitxml=/private/tmp/datano-be003/green.xml` after implementing transactions and migrations | 10 passed in 1.64s |
| Final: `pdm run pytest --cov=app --cov=migrations --cov-report=term-missing --cov-report=json:/private/tmp/datano-be003/coverage.json --junitxml=/private/tmp/datano-be003/full.xml` after adding configuration/cancellation cases | **105 passed in 28.23s**, 0 failures/errors/skips |
| `pdm lock --check` | Passed |
| Compare old/new lock versions and JUnit case identities | No retained package upgraded; all 85 previous cases preserved; 20 new cases |
| Generate a revision using the new Mako template in a temporary copy of `migrations/`, then parse/compile it | Passed; no speculative revision added to the project |
| Real PostgreSQL query after the suite | 0 `be003_%` schemas and 0 other connections to the test database |

An earlier Red attempt had four fixture setup errors because a URL helper method
was named incorrectly. That fixture error was corrected before the six-failure
behavioral Red run above; setup errors were not treated as TDD evidence.

The final cases verify successful commit from a separate reader connection;
all-or-nothing rollback after an application error, a real unique-constraint
error and cancellation; successful recovery after rollback; separate sessions
and backend connection PIDs for overlapping transactions; and session transaction
exit. Configuration checks cover absent/empty settings, wrong drivers, missing
host/database, malformed ports, secret masking and percent-encoded passwords.

Migration checks use a real empty PostgreSQL schema, repeat `upgrade head`,
downgrade to base, then re-upgrade. An unrelated table and its row survive every
step. A separate CLI subprocess reads `DATABASE_URL` from its environment,
applies the revision, and does not print the password. Offline SQL rendering
includes the version table/revision without opening a database connection.

Combined parent-process line coverage of `app` and `migrations` is **84.13%**
(1,733/2,060 statements). New `connection.py`, `base.py` and the baseline revision
have 100% line coverage. `migrations/env.py` has 74.29% parent-process coverage:
the async CLI path is exercised in a separate successful subprocess whose
coverage is not combined; defensive invalid-Alembic-attribute paths are not
tested. These are line-coverage results, not branch coverage or proof of every
failure mode. Existing unrelated coverage gaps remain outside BE-003.

## Changed files, reproduction and limits

- [Database configuration](../../app/infra/core/config.py),
  [connection/transaction owner](../../app/infra/database/connection.py),
  [ORM base](../../app/infra/database/base.py) and
  [package initializer](../../app/infra/database/__init__.py).
- [Alembic configuration](../../alembic.ini),
  [environment](../../migrations/env.py),
  [revision template](../../migrations/script.py.mako) and
  [baseline revision](../../migrations/versions/0001_database_baseline.py).
- [Manifest](../../pyproject.toml) and [lockfile](../../pdm.lock).
- [Database integration tests](../../tests/integration/test_database.py),
  [settings tests](../../tests/unit/test_database_settings.py) and
  [offline migration test](../../tests/unit/test_database_migrations.py).
- [Environment example](../../.env.example), [README](../../README.md), this
  report and only BE-003's [backlog checkbox](../../../docs/backlog.md).

The README documents ordinary local server setup, private database URLs,
upgrade/current/history/offline/downgrade commands and dedicated test database
creation. With `DATANO_TEST_DATABASE_URL` exported to a real isolated test
database, the focused and full commands above can be run directly through PDM.
Temporary JUnit/coverage files are diagnostics; this report records durable
results without test secrets. The dedicated temporary container is stopped and
removed after validation; the server must be provisioned again to rerun tests.

The existing full HTTP suite exercised lifespan and in-memory behavior with
optional database configuration. No live Uvicorn check was repeated because
application assembly did not change. Frontend builds, Orval generation, provider
tests and production deployment were not run: there is no HTTP/DTO/UI contract
change. Persistent repositories/application pool lifecycle are still BE-004;
analytics schemas remain later tasks. Pool saturation, failover and future
domain migration/data recovery are not claimed validated here.

BE-003 is complete after the final diff checks; the Epic and BE-004 remain
unchecked. No Stage, Commit, Push or branch change was performed.
