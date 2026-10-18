# Datano backend

FastAPI 0.115.6 layered application managed by PDM, requiring Python 3.12.
Read [the shared workspace instructions](../docs/AGENTS.md) and
[the backend engineering guide](AGENTS.md) before work. The approved target
and delegated defaults are in [the MVP document](../docs/Datano_MVP.md);
[the UX specification](../docs/datano-ux-pages-.md) limits the admin product UI to viewing.

## Current implementation

- Auth, users, and roles routes under `/api`; OpenAPI at `/openapi.json`.
- Username/password login, bearer JWT access tokens, and HTTP-only refresh cookie.
- Role permission checks; JSON permission/policy catalogs. Policy evaluation is
  a placeholder, not a delivered ABAC engine.
- PostgreSQL-backed users, roles and assignments through the existing repository
  contracts, with SQLAlchemy 2 async transactions and Alembic migrations.
- Refresh-token dictionaries remain process-local pending the session tasks.
- DTO/mapping and use-case/repository separation. Domain errors still depend on
  FastAPI status values and pagination types cross layer boundaries; isolation is partial.
- Pytest entity/repository/HTTP tests, including real PostgreSQL constraints,
  rollback and application process restart checks. Legacy HTTP tests explicitly
  inject in-memory adapters with per-test clients, cookies and state.

These are template/development capabilities, not a completed marketing backend.
The approved target also includes Celery/Redis, email
login, opaque server-side sessions, and the five-domain-entity product model.
Those changes require their own authorized implementation tasks and mandatory
red–green–refactor.

## Architecture

```text
app/
  domain/                  # entities, validation, errors
  application/use_cases/   # business orchestration
  interface/               # HTTP controllers, DTOs, mappers, contracts, DI
  infra/                   # concrete repositories, services, config, utilities
    database/              # async PostgreSQL connection, transaction, ORM metadata
migrations/                # Alembic environment, revision template and history
statics/                   # JSON permission/policy catalogs
scripts/                   # catalog management and process-local seed commands
tests/                    # unit and integration tests
```

Preserve the existing `app/` layers. Product domain boundaries do not require
moving to the historical `src/modules` example. The catalog CLI has obsolete
output paths and schema assumptions; inspect the backend guide before running it.

## Development and validation

Run commands from `Backend/` with Python **3.12** (the project requires
`==3.12.*`). BE-001 was validated with Python **3.12.14** and PDM **2.29.2**.
Select an installed Python 3.12 interpreter before setup; Python 3.13 is not a
substitute. If PDM is not already available, install the tested tool version in
a separate local environment:

```sh
python3.12 -m venv .tools/pdm
.tools/pdm/bin/python -m pip install 'pdm==2.29.2'
export PATH="$PWD/.tools/pdm/bin:$PATH"
```

Keep this tool environment separate from the application's `.venv`. Both are
Git-ignored. Select Python explicitly, check the lockfile, then install the
locked default and development dependencies without resolving new versions:

```sh
pdm use --first --no-version-file python3.12
pdm lock --check
pdm sync -dG dev
pdm run python --version
```

PDM records the selected application interpreter in the ignored `.pdm-python`.
Use `pdm run` for all application commands. A lock-check failure needs investigation;
do not use `pdm update` or regenerate dependency versions merely to bypass it.
Settings can be loaded offline, but serving the app now requires `DATABASE_URL`
in the environment or private `.env` and the current Alembic revision. Configure
PostgreSQL and run `pdm run alembic upgrade head` as described below before
`make dev`. There is no silent in-memory fallback or startup schema creation.

Once installed:

Full-suite and integration commands require `DATANO_TEST_DATABASE_URL` pointing
to a dedicated real PostgreSQL database; see the setup below. Missing test
configuration fails explicitly instead of silently skipping database checks.

```sh
make dev
pdm run pytest
pdm run pytest tests/unit/
pdm run pytest tests/integration/
pdm run pytest --cov=app
make lint
```

`make dev` serves port 8000. `make dev PORT=8004` overrides it; the direct
execution branch in `app/main.py` uses 8004. `make run` starts Uvicorn without
reload; it does not establish production readiness. `make lint` only compiles
`app/main.py`, not a full lint/type-check suite.

Lifespan owns/disposes the database pool and idempotently creates missing `User`
and `Admin` role records. It preserves existing role IDs, permissions and status.
It creates **no user or password** and never grants Admin based on a supplied
email. The old fixed-password seed and `scripts/seed_in_memory.py` remain only
for explicitly isolated in-memory tests/examples; they cannot provision the
persistent app. Valid administrator provisioning/email proof is BE-014.
The default signing key, cookie flags, refresh-token memory and local CORS still
need their authorized auth/security tasks. Never commit environment secrets or
describe the current JWT flow as the finished product session architecture.

See [the BE-001 baseline report](docs/validation/BE-001-baseline.md) for the
executed setup, lock metadata correction, startup checks, test results and
remaining limitations. No application behavior or API contract changed in BE-001.

## PostgreSQL infrastructure and migrations

BE-003 locks SQLAlchemy **2.0.55**, Alembic **1.20.0** and psycopg/binary
**3.3.6**. It was tested against PostgreSQL **17.11**, not SQLite. Provide an
existing PostgreSQL server or start a local development instance with Docker.
For example, create a private environment file outside the repository containing
`POSTGRES_USER=datano`, `POSTGRES_DB=datano` and a private `POSTGRES_PASSWORD`, then:

```sh
docker run --detach --name datano-postgres \
  --env-file /absolute/path/to/private-postgres.env \
  -p 127.0.0.1:55432:5432 \
  -v datano-postgres-data:/var/lib/postgresql/data postgres:17-alpine
docker exec datano-postgres pg_isready -U datano -d datano
```

Wait until the server accepts connections. Set `DATABASE_URL` in the shell or
private `Backend/.env`, using the actual password (percent-encode reserved URL
characters). Its required form is:

```text
postgresql+psycopg://datano:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:55432/datano
```

The URL is represented as `SecretStr` in settings and is never stored in
`alembic.ini`. The serving app, `Database.from_config(config)` and migrations
require it. PostgreSQL
with the explicit psycopg driver, host and database is required; SQLite fallback
is not supported. Run from `Backend/` against the intended database:

```sh
pdm run alembic upgrade head
pdm run alembic current
pdm run alembic history
pdm run alembic upgrade head --sql
```

Revision `0001_database_baseline` establishes history without domain tables.
Revision **`0002_users_roles`** adds `users`, `roles` and the `user_roles`
assignment table. `alembic upgrade head` works from an empty target or BE-003's
baseline and preserves unrelated tables/data. No analytics or session tables are
introduced. No migration or `create_all` runs during application startup.
Identity ORM metadata is registered for autogeneration; generated revisions still
need review.

Downgrading to `0001_database_baseline` **drops all three identity tables and
their data**. This destructive reversal was tested only on disposable schemas;
back up and verify restoration of the target database before intentionally using
it on real records. Re-upgrading recreates the schema, not deleted records.
Prefer forward corrective migrations when retaining identity data is required.
Downgrading the baseline itself to `base` only removes its revision marker.

`app.infra.database.connection.Database` owns a lazy connection pool with
pre-ping, hidden SQL parameters and a five-second connection timeout. Each
`async with database.transaction() as session:` creates a fresh `AsyncSession`,
commits on success, rolls back on exceptions/cancellation and closes the session.
Pass that session through repositories for one operation; do not share a session
between concurrent tasks or commit independently inside participating repositories.
The application lifespan calls `dispose()` on shutdown, including startup errors.
User and role HTTP dependencies share one transaction for the complete request;
repositories flush but never commit independently. FastAPI 0.115.6 completes
this yield dependency before sending the response. Alembic uses a separate
`NullPool` engine and disposes it after execution.

IDs remain strings, so unknown non-UUID IDs return the existing missing-record
behavior. Email/username and role names have exact-value unique constraints;
email canonicalization and username migration belong to BE-005. The assignment
primary key rejects duplicates, and foreign keys prevent orphan assignments.
Deleting a user or role cascades only to its assignment rows; it never deletes
the opposite parent record. Role permission IDs persist as a PostgreSQL text
array matching the existing contract; catalog validation stays in the use cases.
Lists use SQL pagination ordered by `(created_at, id)` with compatible empty-page
metadata, and roles for a user page are loaded together. Returned domain entities
are detached values, not live mutable ORM references.

Refresh-token persistence, email login, registration/activation policy, admin
verification and analytics are later tasks. Existing in-memory user/role data is
not imported automatically into PostgreSQL. The HTTP/DTO/OpenAPI contract remains
unchanged in BE-004.

Create a separate test database, for example on this local development instance:

```sh
docker exec datano-postgres createdb -U datano datano_test
export DATANO_TEST_DATABASE_URL='postgresql+psycopg://datano:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:55432/datano_test'
pdm run pytest tests/integration/test_database.py tests/unit/test_database_settings.py tests/unit/test_database_migrations.py
pdm run pytest --cov=app --cov=migrations
```

Export the test URL in the shell; tests do not read it from `.env`. The database
name must start with `datano_test` and the role must have permission to create
schemas there. Each database test creates its own UUID-named schema, sets its
connection's `search_path`, and drops only that schema at teardown, including
after failure. Database URLs and test credentials must remain private. A
dedicated test database is required because the suite performs real writes and
DDL; it never uses `DATABASE_URL` as a test fallback. Unit tests can run without
PostgreSQL via `pdm run pytest tests/unit/`.

See [BE-003 validation](docs/validation/BE-003-postgresql.md) for executed
Red/Green checks, migration/data-preservation evidence and full-suite results.
See [BE-004 validation](docs/validation/BE-004-persistent-identities.md) for the
persistent repositories, migration constraints, real process/container restart
checks and the current full-suite result.

## Test isolation

The legacy `test_client` fixture explicitly creates a test application with
in-memory repository overrides and the isolated development seed. It clears
cookies and resets the registry before startup and after shutdown, including
when a test fails. `admin_token` and `admin_auth` belong to that same test
lifetime; do not retain them across tests or reset storage while they are in use.
The development seed supplies authentication only. User/role CRUD and assignment
tests create their own targets through `created_user` and `created_role` rather
than changing the seeded admin or selecting the first global list item.

`tests/test_fixture_isolation.py` uses pytest's bundled `pytester` plugin to
exercise the actual fixtures across test-item boundaries in temporary
subprocesses. It checks user/role/token and cookie leakage in both orders,
cleanup after an intentional failed child test, and duplicate test names.
No new test dependency or random-order plugin is required. The parent cleanup
test passes only when its child run has exactly the intentional failure and a
passing cleanup observer.

```sh
pdm run pytest tests/test_fixture_isolation.py
pdm run pytest
```

See [BE-002 validation](docs/validation/BE-002-fixture-isolation.md) for TDD
evidence, full-suite order checks and the limits of this in-memory isolation.

The BE-004 integration tests use real per-test PostgreSQL schemas and the normal
persistent application lifecycle. They provision test actors through repositories
only inside those disposable schemas. The process restart helper under
`tests/support/` contains test-only credentials and is not an administrator
provisioning command. Run the affected checks with:

```sh
pdm run pytest tests/integration/test_persistent_repositories.py tests/integration/test_persistence_migrations.py tests/integration/test_persistent_http.py
```
