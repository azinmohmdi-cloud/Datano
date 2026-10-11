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

Run commands from `Backend/` with Python 3.12 and PDM available:

```sh
pdm install
make dev
pdm run pytest
pdm run pytesttests/unit/
pdm run pytesttests/integration/
pdm run pytest --cov=.
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
