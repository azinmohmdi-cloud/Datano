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
- Process-local users, roles, and refresh-token dictionaries; no database or migrations.
- DTO/mapping and use-case/repository separation. Domain errors still depend on
  FastAPI status values and pagination types cross layer boundaries; isolation is partial.
- Pytest entity/repository/HTTP tests with per-test clients, cookies and in-memory state.

These are template/development capabilities, not a completed marketing backend.
The approved target is PostgreSQL/SQLAlchemy 2/Alembic, Celery/Redis, email login,
opaque server-side sessions, and the five-domain-entity product model. Those changes
require their own authorized implementation tasks and mandatory red–green–refactor.

## Architecture

```text
app/
  domain/                  # entities, validation, errors
  application/use_cases/   # business orchestration
  interface/               # HTTP controllers, DTOs, mappers, contracts, DI
  infra/                   # concrete repositories, services, config, utilities
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
The example `.env` is optional for this development baseline because settings
have development defaults; it does not provide production configuration.

Once installed:

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

Lifespan seeds the serving process. A separate seed command cannot populate
another process, and in-memory data is lost at restart or isolated between workers.
The development seed, default signing key, cookie flags, and local-only CORS
settings require security work before production; see the guide for exact gaps.
Never commit environment secrets or report the current auth flow as a finished
product registration/session architecture.

See [the BE-001 baseline report](docs/validation/BE-001-baseline.md) for the
executed setup, lock metadata correction, startup checks, test results and
remaining limitations. No application behavior or API contract changed in BE-001.

## Test isolation

The `test_client` fixture starts lifespan for each test with a reset in-memory
registry. It clears cookies and resets the registry after shutdown, including
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
