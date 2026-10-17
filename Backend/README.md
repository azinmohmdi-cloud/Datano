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
- Pytest entity/repository/HTTP tests; fixtures have known shared-state limitations.

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
