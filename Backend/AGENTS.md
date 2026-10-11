# Backend engineering guide

## 1. Scope, sources, and implementation status

This file governs work in `Backend/`. Run backend commands from this directory.
Follow explicit user instructions and confirmed requirements; preserve unrelated
work. Read applicable instructions before editing. Never commit automatically.

Use the code and tests to establish current behavior, and consult these documents
for product intent:

- `README.md`, `pyproject.toml`, `pdm.lock`, `Makefile`, `.env.example`,
  `app/`, `statics/`, `scripts/`, and `tests/`.
- `../docs/Datano_proposal.md`: proposed scope, architecture, ownership verification,
  analytics integrity, integrations, and security requirements.
- `../docs/Datano_MVP.md`: product scenarios and data-model proposals; distinguish
  earlier detailed models from the later minimal-model guidance.
- `../docs/datano-ux-pages-.md`: Persian product journeys and current UI scope.
- `../Frontend/orval.config.ts`, `../Frontend/lib/fetcher.ts`, and
  `../Frontend/AGENTS.md`: API consumption and frontend engineering conventions.
  The frontend cookbook is `../Frontend/docs/cookbook/component-development-framework.md`.

Do not resolve conflicting product documents by inventing rules. Identify the
conflict, apply confirmed scope where available, and obtain clarification before
implementing behavior that depends on an unresolved decision. Existing template
endpoints are not evidence that every operation belongs in the future product UI.

The proposal explicitly requires stakeholder confirmation for major technology
departures, including the custom dashboard and database/backend changes. A target
stack listed below does not itself authorize implementing those departures.

| Area | Implemented now | Documented future direction |
| --- | --- | --- |
| Runtime | Python 3.12, FastAPI, PDM | Modular monolith preserving clean architecture |
| Storage | Process-local user, role, refresh-token dictionaries; JSON permission/policy catalogs | PostgreSQL, SQLAlchemy 2, Alembic |
| Identity | Username/password login, bearer JWT access tokens, HTTP-only refresh cookie, role permissions | Secure session authentication and Google OAuth integration |
| Product domain | Users, roles, permissions, policy records | Website ownership, integrations, analytics data, rule-based recommendations |
| Background work | No task queue or scheduler | Celery and Redis for authorized background workflows |
| Tests | Pytest entity/repository units and HTTP integrations | Broader backend coverage and product browser journeys |

PostgreSQL models, migrations, Redis caching, Celery tasks, Google adapters,
website ownership checks, analytics ingestion, and recommendation generation
are not implemented. Policy evaluation is a placeholder, not a functioning ABAC
engine or recommendation engine. Public signup, password recovery, and website
APIs are not present. Do not describe proposals as shipped capabilities.

The proposed minimal product entities are User, Website, Integration,
AnalyticsData, and Recommendation. Add supporting abstractions only when an
authorized feature needs them. Do not transplant a speculative schema or
introduce a new `src/modules` structure into the existing `app/` layout by default.

## 2. Runtime, dependencies, configuration, and commands

### Supported environment

`pyproject.toml` requires Python `==3.12.*` and uses PDM with
`distribution = false`. Use the project environment through `pdm run`; a globally
installed package or a different Python minor version is not equivalent validation.

The reviewed lockfile resolves these key packages:

| Package | Locked version |
| --- | --- |
| FastAPI | 0.115.6 |
| Uvicorn | 0.38.0 |
| Pydantic | 2.12.5 |
| pydantic-settings | 2.12.0 |
| python-jose | 3.5.0 |
| bcrypt | 5.0.0 |
| Loguru | 0.7.3 |
| fastapi-pagination | 0.15.3 |
| Pytest | 9.0.1 |
| pytest-asyncio | 1.3.0 |
| pytest-cov | 7.0.0 |
| HTTPX | 0.28.1 |

Distinguish declared version ranges from these resolved versions. Preserve PDM
and `pdm.lock`; update dependency declarations and the lockfile together only
when dependency changes belong to the task. The dev dependencies appear in both
an optional extra and a dependency group, with different pytest-cov lower bounds.
Do not silently reorganize them as unrelated cleanup.

Prefer existing libraries and interfaces. Justify a new dependency by a concrete
need, compatibility with Python 3.12, operational cost, and maintenance/security
impact. Do not install databases, tooling, or provider SDKs for a documentation-only
task.

### Existing commands

Run from `Backend/`:

```bash
pdm install
pdm run uvicorn app.main:app --reload
pdm run pytest
pdm run pytest -v
pdm run pytest tests/unit/
pdm run pytest tests/integration/
pdm run pytest -k "test_login"
pdm run pytest --cov=.
pdm run python -m py_compile app/main.py
pdm list
pdm run python scripts/seed_in_memory.py
```

Makefile equivalents include `make install`, `make dev`, `make run`,
`make test`, `make test-verbose`, `make test-cov`, `make lint`, `make check`,
and `make seed`. `make serve` aliases development startup.

- Bare Uvicorn above defaults to port **8000**. `make dev` uses reload,
  `0.0.0.0`, and `PORT=8000`; `make dev PORT=8004` explicitly overrides the port.
- `make run` omits reload but is not a complete production deployment process.
  The direct execution branch in `app/main.py` specifies port **8004**; importing
  `app.main:app` does not execute that branch.
- `make lint` compiles only `app/main.py`. It is neither a formatter, a lint suite,
  nor a type checker. No such tools or CI quality gates are currently configured.
- Coverage tooling exists; no approved percentage threshold exists.
- Do not run cleanup targets on unrelated work or present `make check` as testing.

### Settings and seed behavior

`app/infra/core/config.py` creates the global pydantic-settings configuration.
It reads `.env` relative to the working directory. Verify `.env.example` when
setting up locally; do not commit secrets.

Existing settings are `SECRET_KEY`, `ALGORITHM`,
`ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`,
`DEFAULT_PAGINATION_LIMIT`, `PERMISSIONS_PATH`, and `POLICIES_PATH`.
Defaults include HS256, 30-minute access tokens, seven-day refresh tokens, and
a pagination setting of 10. This pagination setting does not govern every
endpoint: list use-case defaults and FastAPI pagination parameters differ.

The fixed signing-key fallback is development scaffolding. Require explicit,
secure secrets when implementing production configuration. The standalone
`app/config_validator.py` is not invoked by application startup; do not claim
that its checks protect the running application.

FastAPI lifespan calls `app/infra/core/seed.py` automatically. It creates the
development `Admin` role, assigns `super:user`, and creates/activates
`admin` / `admin@example.com` with password `Secret123`. These are local test
fixtures, not production credentials. The seed exits when any role already
exists; it is not a general reconciliation or migration mechanism.

Users, roles, and refresh tokens are process-local singletons. A separate
`make seed` process loses its dictionaries at exit and cannot populate another
running server. Restarting or using multiple workers produces separate state.

## 3. Architecture, clean code, and type safety

### Existing project map

| Path | Responsibility |
| --- | --- |
| `app/main.py` | FastAPI construction, lifespan, middleware, handlers, pagination, router registration |
| `app/domain/entities/` | Entity factories, validation, state transitions, timestamps |
| `app/domain/error/` | Domain exception classes and existing HTTP exception handlers |
| `app/application/use_cases/` | One operation per module; typed input/output and orchestration |
| `app/application/use_cases/auth/interfaces.py` | Password and token service contracts |
| `app/interface/repository/` | Abstract repository contracts |
| `app/interface/dto/` | Pydantic HTTP/input/output models and response envelope helpers |
| `app/interface/mappers/` | Entity/DTO conversion |
| `app/interface/controller/` | FastAPI routes, dependency use, HTTP response/cookie handling |
| `app/interface/dependencies/` | Composition of repositories, services, and use cases |
| `app/infra/repositories/in_memory/` | Dictionary adapters and shared registry |
| `app/infra/repositories/json/` | Permission/policy catalog readers |
| `app/infra/services/` | Bcrypt and JOSE implementations |
| `app/infra/utils/` | Password/JWT/refresh utilities, pagination, authorization enums |
| `app/infra/core/` | Settings, logging, CORS, seed |
| `statics/` | JSON permission and policy catalogs |
| `scripts/` | In-memory seed and authorization catalog management |
| `tests/` | Shared fixtures, units, HTTP integrations |

Preserve the concrete conventions:

1. Controllers translate DTOs to use-case requests, invoke a use case, map results,
   and apply HTTP concerns. Put business decisions in entities or use cases.
2. Use cases depend on entity behavior and repository/service contracts. Auth
   use cases already inject password and token services; follow that separation
   for future external adapters.
3. Repository implementations own storage behavior, not request authentication
   or response rendering. Wire implementations through existing dependency modules.
4. Use explicit entity-to-public-DTO mapping. Do not expose password hashes,
   token repositories, provider credentials, or persistence objects.
5. Follow nearby names and imports: `*Entity`, `*UseCase`,
   `*Request`/`*Response`, `I*Repository`, and `app.*` absolute imports.
   Keep related operations in existing feature directories and export through
   their established `__init__.py` modules where needed.

This is an architectural direction, not a claim of perfect framework isolation:
domain exceptions import FastAPI status codes, domain error handlers serve HTTP,
and list use cases/repositories use FastAPI pagination types. JWT utilities also
use an interface DTO. Avoid expanding these couplings; an authorized extraction
must preserve behavior and tests rather than force a broad rewrite.

### Actionable implementation standards

- Type public function boundaries, repository methods, service contracts, and
  use-case inputs/results. Prefer established dataclasses and Pydantic DTOs over
  unstructured dictionaries at internal boundaries.
- Use the existing frozen request/response dataclass convention for use cases.
  Never mutate frozen requests; normalize into local variables.
- Narrow and validate untrusted JSON/provider values before using them. Avoid
  unexplained `Any`, broad suppressions, unchecked casts, and weakening validation
  to make a test pass.
- Preserve DTO optionality and omitted-versus-explicit-value semantics. In
  particular, use `is not None` where `False`, zero, or an empty list is meaningful.
  Do not implement updates by blindly assigning arbitrary request attributes.
- Keep factories and domain methods as the place for entity invariants. Validate
  all changes before mutating shared stored objects; a rejected update must not
  partially change state.
- Use UTC-aware instants for backend timestamps, following existing entity
  factories. Keep display localization out of storage and token logic.
- Use explicit exceptions and small cohesive functions. Avoid duplicate business
  logic, global mutable request context, mutable function defaults in new code,
  and speculative abstraction.
- Preserve nearby formatting and naming. No formatter or static type-checker
  configuration currently establishes an alternative project-wide style.

Current user factories generate string UUIDs, require username length 3–50,
password length at least eight, and a simple email structure; new users are
inactive until activated. Role names must contain non-whitespace characters and
are limited to 100; validation does not trim the stored name.
Uniqueness checks currently compare exact email/username/name values. Do not
invent normalization, stronger password rules, registration activation, or
case-insensitive identity semantics without confirmed requirements.

Known gap: `UpdateRoleUseCase` assigns to its frozen request when
`permission_ids=[]`, which can raise `FrozenInstanceError`. When working on role
updates, first reproduce this behavior with a failing test, then fix the
implementation within scope. Do not reproduce this pattern elsewhere.

## 4. API design and frontend contracts

`app/interface/controller/api.py` composes routers under `/api`.
The current OpenAPI title/version are starter metadata, `FastAPI Server` /
`1.0.0`; there is no `/api/v1` route prefix. Default documentation endpoints are
`/docs`, `/redoc`, and `/openapi.json`.

| Existing endpoints | Current purpose |
| --- | --- |
| `GET /api/ping` | Envelope with message `pong` and null payload |
| `POST /api/auth/login` | Username/password authentication and refresh cookie |
| `POST /api/auth/refresh` | Access-token renewal from refresh cookie |
| `POST /api/auth/logout` | Refresh-token revocation and cookie removal |
| `GET /api/auth/me` | Authenticated public user |
| `GET /api/auth/permissions` | Permission catalog, guarded by `Permissions_Read` |
| `GET`, `POST /api/users/` | User list/create, guarded by the corresponding permission |
| `GET`, `PUT`, `DELETE /api/users/{user_id}` | User retrieve/update/delete |
| `POST`, `DELETE /api/users/{user_id}/roles/{role_id}` | Assign/remove role |
| `GET`, `POST /api/roles/` | Role list/create |
| `GET`, `PUT`, `DELETE /api/roles/{role_id}` | Role retrieve/update/delete |
| `POST`, `DELETE /api/roles/{role_id}/permissions/{permission_id}` | Assign/remove permission |

Check the controller's exact authorization enum for each route; naming similarity
is not sufficient evidence of permission coverage. Preserve collection trailing
slashes and path parameter contracts when touching existing routes.

`app/interface/dto/responses.py` defines
`StandardResponse[T]`: `success`, `message`, and `payload`. Use the existing
`success()`/`failure()` helpers and typed response models for existing contracts.
Lists place a pagination object inside `payload`, with `items`, `total`,
`page`, `size`, and `pages`. Current create and delete endpoints use HTTP 200;
deletion returns the deleted entity. Existing PUT DTOs allow partial fields.
Do not silently switch these to 201/204/PATCH or flatten response envelopes.

Domain failures are mapped to their configured statuses and error payloads.
FastAPI's request-validation and other framework errors are not all normalized
into this envelope. Document and test an intentional error-contract change
instead of claiming universal consistency.

For API changes:

- Declare and validate request/response models, authorization, failure cases,
  pagination, and nullability. Keep stable operation semantics; explicitly report
  breaking changes and coordinate consumers within authorized scope.
- Validate IDs against current contracts; existing HTTP IDs are strings, not a
  guarantee that all incoming IDs are UUID-validated.
- Keep authentication and ownership checks server-side. Never trust frontend
  visibility or a request-supplied user/website owner as authorization.
- Exercise successful, invalid, missing, duplicate, and forbidden requests, and
  verify both HTTP status and serialized payload. Ensure public user responses
  never include `hashed_password`.
- Review the actual OpenAPI output when a schema or route changes. Endpoint
  comments are not authoritative if response models and code disagree.

Frontend Orval uses `OPENAPI_JSON_URL` and generates clients/hooks/models under
`../Frontend/lib/api/v1/`. Its existing generation script is
`pnpm api:generate`, run from `../Frontend/` with a reachable schema; do not
hand-edit generated files or regenerate into another repository without scope.
The fetcher returns the complete response body, including the envelope.

The frontend reads `NEXT_PUBLIC_API_URL_V1`; its example environment file instead
uses `NEXT_PUBLIC_API_URL`. Browser credential handling, auth interceptors, and
automatic refresh are not implemented there. Do not claim an end-to-end working
auth client. Frontend invoice and local user examples are mocks, not backend
contracts. Preserve these distinctions when documenting integration.

## 5. Persistence, database design, and migrations

### Current adapters and their limits

`app/infra/repositories/in_memory/registry.py` shares user, role, and refresh-token
repositories within a process. Repository methods are async interfaces around
dictionary operations, not durable or transactional storage.

- Stored entities can be shared mutable references. Preserve atomic behavior
  under failed validation rather than relying on a later `update()` call.
- User role IDs are held separately; mapped role shells are not authoritative
  role records. Authorization re-fetches actual roles.
- User deletion does not revoke all refresh tokens, and role deletion does not
  reconcile all user assignments. Do not claim cascade semantics.
- Email/username/name/token lookups scan collections. Lists currently construct
  or traverse data before slicing, and an empty page reports `pages=1`.
- JSON repositories synchronously read files within async methods. Missing files
  or invalid JSON can yield empty catalogs; this is not a robust startup integrity
  check. Do not use this fallback as evidence that configuration is healthy.

Preserve adapter contracts in focused fixes. Test missing records, duplicates,
relationship behavior, update atomicity, and page boundaries. Do not add a cache
or database to hide an existing correctness defect.

### When authorized to implement PostgreSQL

PostgreSQL, SQLAlchemy 2, and Alembic are proposed infrastructure, not installed
capabilities. There are no current ORM models, database connection settings,
migration files, or runnable Alembic workflow. Establish these within the
authorized implementation and document real setup commands; never report
hypothetical migrations as executed.

- Keep ORM models and sessions in infrastructure; maintain existing repository
  interfaces and map persistence records to domain entities.
- Define transaction boundaries around complete use-case operations. Roll back
  failed writes and avoid partial user/role/permission or ingestion state.
- Enforce confirmed uniqueness and referential integrity in the database as well
  as application validation. Translate known constraint failures into the
  established domain exceptions; do not leak SQL/driver details.
- Choose and document relationship deletion, tenant scoping, nullability, and
  identifier behavior from confirmed requirements. Do not assume cascades,
  soft deletion, email normalization, or a universal tenant schema.
- Scope sessions to their unit of work and release resources reliably. If an
  async driver/session is adopted, do not share an `AsyncSession` across concurrent
  tasks; follow [SQLAlchemy's asyncio guidance](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html).
- Use parameterized queries/ORM expressions, bounded pagination, stable ordering,
  and indexes justified by actual access paths. Inspect query behavior for N+1
  role/permission reads and analytics workloads.
- Version schema changes with Alembic. Review generated revisions manually:
  [autogenerate is not a complete migration author](https://alembic.sqlalchemy.org/en/latest/autogenerate.html).
  Check destructive operations, data backfills, lock duration, and compatibility.
- Test upgrades from both an empty database and the supported prior schema using
  PostgreSQL. Verify data preservation and document a tested downgrade or explicit
  forward-recovery strategy where reversal is unsafe.
- Separate local test migrations from production execution. Never run a destructive
  migration, wipe a database, or deploy solely because a code task was requested.

Future analytics persistence must be idempotent for the confirmed website,
source, property, time window, metric, and dimension identity. Preserve history
and provenance; do not choose an incomplete unique key that overwrites distinct
observations.

## 6. Authentication, authorization, and security

### Current authentication behavior

Authentication uses the service interfaces in
`app/application/use_cases/auth/interfaces.py` and concrete implementations in
`app/infra/services/`.

- Login verifies username/password and active-user status, issues a JWT containing
  `sub`, `username`, `exp`, and `iat`, and stores an opaque refresh token.
  The access-token DTO is returned in `payload`; the token string is
  `payload.token`.
- The refresh cookie is named `refresh_token`, HTTP-only, SameSite Strict,
  path `/`, with configured lifetime. Its current `secure=False` is unsuitable
  for production HTTPS.
- Refresh checks the stored token, expiry/revocation/blacklisting, and active user.
  It returns a new access token without rotating the refresh token.
- Logout revokes the refresh token and clears the cookie; it does not invalidate
  already issued access JWTs. Missing cookies produce a credentials failure.
- Protected routes use `HTTPBearer(auto_error=False)` through
  `get_authorized_user()`. Authorization currently looks up the user by JWT
  username and does not cross-check `sub` against that user's ID.
- JWT verification restricts decoding to the configured algorithm, but missing
  `exp`/`iat` claims are defaulted to zero rather than explicitly required. DTO
  validation errors are not caught by its `JWTError` handler. Cover missing and
  malformed claims when hardening this path.
- Permission checks collect role permission IDs, require every requested
  permission, and allow a `super:user` bypass. They currently do not filter
  inactive roles.

These are observed behaviors, not a complete production identity design.
When changing authentication, cover identity consistency, inactive accounts and
roles, revocation/expiry, missing/malformed credentials, and ordinary users
without the requested permissions. Do not use only the seeded superuser to
validate authorization.

`EvaluatePoliciesUseCase` verifies referenced policy existence but
`_evaluate_policy()` is empty and is not invoked by the authorization dependency.
Permission records/DTOs do not provide a working policy linkage. The permissions
route's policy-expansion comment does not establish a delivered policy contract.

### Security requirements for future changes

- Keep secrets, passwords, JWTs, refresh tokens, OAuth authorization codes, and
  provider credentials out of responses, logs, committed environments, and
  frontend public variables. Use development placeholders in examples.
- Do not adopt browser-storage session tokens. Implement the documented secure
  session direction only through an authorized, tested change; do not invent a second
  parallel auth scheme or silently replace the existing JWT API.
- For production browser authentication, coordinate HTTPS cookie flags, exact
  allowed origins, credentials, CSRF protections, and deployment topology.
  SameSite alone is not proof of complete CSRF protection.
- Existing CORS permits credentialed requests from localhost/127.0.0.1 ports
  3000 and 5173, with broad methods/headers. It is development configuration;
  production origins are not configured. Do not widen credentialed CORS to
  arbitrary origins.
- Keep resource-level authorization at every read, write, export, and background
  operation. Future website analytics require authenticated ownership/verified
  access, not possession of an ID. Scope queries and cache entries to the
  authorized identity and resource.
- Parse and validate all trust-boundary values: HTTP DTOs, static catalogs,
  database records, provider responses, job inputs, and configuration. Bound
  payloads and external operations based on the authorized feature; do not
  fabricate numerical limits or business validation.
- Reject or safely handle invalid data rather than silently substituting
  plausible analytics, granting permissions, or continuing with insecure config.
- Keep password hashing behind the existing service. The helper truncates hashes'
  input to bcrypt's 72-byte boundary while verification uses full UTF-8 input.
  With locked bcrypt 5.0.0 this can reject or raise on long passwords. A fix needs
  failing tests for boundary lengths, Persian/multibyte input, and existing-hash
  compatibility; never normalize or truncate passwords as an invented policy.
- Test throttling and abuse controls when implementing exposed login, recovery,
  verification, or integration workflows. Such controls are not implemented now.
- Approved documents discuss ABAC and OWASP ASVS Level 2 as goals. Do not claim
  compliance, tenant isolation, encryption, or audit coverage without evidence.

Future HTML website-ownership verification is an SSRF boundary: validate scheme,
host, resolved addresses, and redirects; block internal/private/link-local targets
and unsafe redirect destinations; constrain time and response size; avoid a proxy
unless explicitly authorized. Re-check resolution where necessary to resist DNS
rebinding. Use [OWASP SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
and tests for malicious URLs and redirect chains. Verification must precede
access to private analytics; a frontend success indicator is insufficient.

For future Google OAuth, bind and validate state, use approved redirect URIs and
minimum required scopes, and store provider tokens encrypted with keys kept
separate from data. Never confuse Google provider tokens with Datano user
authentication. Verify the exact flow against
[Google's web-server OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server);
do not invent current scopes or callback endpoints.

## 7. Performance, caching, and background work

There is no Redis cache, database connection pool, task queue, or ingestion worker
in the current backend. Process-local dictionaries are storage scaffolding,
not a production cache.

- Measure relevant response time, query volume, CPU, and external latency before
  substantial optimization. Do not impose invented performance budgets.
- Keep async request paths free of unbounded blocking work. Current synchronous
  catalog reads and bcrypt operations require attention when changing related
  paths; use an appropriate bounded execution approach and test concurrency.
- Bound collections and response sizes through confirmed contracts. Preserve
  stable pagination ordering; avoid full-table loading when database adapters
  are introduced.
- Avoid repeated role/catalog loads and N+1 queries when evidence identifies
  them, while retaining authorization correctness.
- If caching is authorized, define ownership, key inputs, expiration, invalidation,
  and behavior on misses/failure. Include identity, website, source, property,
  time window, and relevant dimensions where applicable. Never share protected
  data across users or allow stale permissions to authorize access.
- Invalidate or version caches after relevant mutations and permission/ownership
  changes. Cache failure must not become an authorization bypass.
- For authorized Celery/Redis workflows, make retries idempotent, bound retry
  attempts, distinguish transient from permanent failures, and record progress
  without exposing credentials. Re-check authorization/integration state where
  appropriate and prevent duplicate ingestion or recommendation issuance.
- Plan transaction/job boundaries so retrying a failed task does not publish
  incomplete data. Do not hold database transactions open across slow provider
  calls unless explicitly justified.
- Keep scheduler frequency, freshness windows, retention, concurrency, and TTLs
  tied to confirmed requirements; there are no established global defaults.

## 8. External integrations and analytics integrity

GA4, Search Console, and Google Ads are planned integrations. No provider client
or production metrics ingestion exists. Implement adapters behind contracts,
inject them into use cases, and use provider fakes for routine tests.

For each authorized integration:

1. Verify endpoints, scopes, authentication, metric definitions, pagination, and
   quotas in the provider's official documentation for the selected API.
2. Preserve source/property identity, retrieval time, measurement window, and
   dimensions. Validate response shape and distinguish unavailable/partial data
   from genuine zero values.
3. Use explicit timeouts and bounded retries for transient/network/rate-limit
   failures. Avoid duplicate writes and endless retries on invalid credentials
   or revoked access; expose a safe actionable integration status.
4. Keep credentials within infrastructure and encrypted persistence. Revoke or
   stop using disconnected integrations; test expired tokens and partial failure.
5. Test contract mapping, pagination, duplicate responses, time boundaries,
   quota errors, and recovery without live provider access.

Conversions and revenue can mean different things across sources. Do not merge
unlike metrics or compute ROAS from incompatible values. Preserve original
provider values and provenance; use confirmed definitions for derived metrics.

Recommendations are proposed as versioned rule-based decisions, not machine
learning. Require sufficient valid evidence, the evaluated window, and rule
version; do not issue recommendations from missing, stale, or invalid data.
Apply confirmed eligibility and repeat/cooldown rules. Proposal examples such
as impression/CTR thresholds are illustrative, not approved hard-coded defaults.
The weekly recommendation target does not justify fabricating eligible results.

Product screens are Persian and RTL. Keep API identifiers, timestamps, numbers,
and errors structurally stable; leave Persian display formatting to consumers.
Do not silently convert persisted instants or provider windows to display dates.
Specify timezone, calendar, currency, and metric semantics only where the
confirmed feature requires them.

## 9. Error handling, logging, and operational behavior

Use existing domain exceptions for validation, missing resources, conflicts,
credentials, inactive users, and forbidden operations. Do not return success
when an operation failed or translate every exception into an undifferentiated 500.

`app/domain/error/exception_handlers.py` registers domain and generic handlers.
The generic 500 response uses a safe message; preserve that boundary. Unexpected
failures should retain diagnostic context internally, without exposing stack
traces, SQL, secrets, or provider response bodies to clients.

Logging is currently split between Loguru middleware and standard-library
logging in exception handling. `app/infra/core/logging.py` configures DEBUG stderr
and serialized files at `logs/app_{time}.log`, rotation at 500 MB, 30-day
retention, and ZIP compression. It logs method/path and response status;
Uvicorn access logging is reduced to WARNING. Importing the application can
create log artifacts.

- Follow the relevant logger's existing API; do not assume centralized tracing
  or a unified logging bridge exists.
- Record useful operation/failure context and sanitized identifiers. Redact
  authentication headers, cookies, passwords, provider tokens, and sensitive
  user/provider payloads, including exception text.
- Avoid duplicate logging at every layer. Log unexpected failures with enough
  context to investigate; map expected failures consistently.
- If adding correlation IDs, durations, metrics, or audit events, make their
  semantics and propagation explicit and test them. None constitutes an existing
  complete observability system.
- Treat security/audit events separately from ordinary request logs. Current
  log retention is not an approved analytics or audit retention policy.
- Add startup validation for new essential infrastructure/configuration and
  fail clearly on invalid setup. Do not assume JSON fallback or the unused config
  validator already provides this.

## 10. Mandatory TDD: Red–Green–Refactor

TDD is mandatory for behavioral development, including defects, new use cases,
API changes, authorization, adapters, and background/integration logic.

1. **Red:** write a focused, deterministic test for the requested behavior or
   reported defect. Run it and confirm it fails for the expected missing behavior,
   not an import error, missing dependency, or broken fixture. For a defect,
   preserve the reproduction as a regression test.
2. **Green:** implement the smallest complete change that satisfies the behavior.
   Re-run the focused tests. Do not weaken assertions or validation to pass.
3. **Refactor:** improve structure with passing tests, then run the affected
   layer's tests and the complete backend suite before completion.

For behavior-preserving refactors, establish a passing characterization baseline
and add missing coverage before restructuring; do not fabricate a failing
expectation. Documentation-only changes use content/reference/diff validation.
If runnable validation is blocked, preserve the work, state the precise blocker
and unverified behavior, and never claim the TDD cycle or suite passed.

### Existing infrastructure and isolation

`pyproject.toml` discovers `tests/`, files `test_*.py` and `*_test.py`,
classes `Test*`, and functions `test_*`, with verbose/short-traceback defaults.
`asyncio_mode="auto"` automatically handles async tests; explicit
`@pytest.mark.asyncio` is valid but not required. Follow
[pytest-asyncio's mode documentation](https://pytest-asyncio.readthedocs.io/en/stable/concepts.html);
do not introduce manual event-loop handling without a concrete need.

Existing tests:

- `tests/test_main.py`: ping.
- `tests/unit/test_domain_entities.py`: entity factories and behavior.
- `tests/unit/test_in_memory_repositories.py`: adapter CRUD and edge cases.
- `tests/integration/test_auth.py`: login and current-user token behavior.
- `tests/integration/test_users.py` and `test_roles.py`: protected CRUD/assignments.
- `tests/conftest.py`: session-scoped `test_client` and `admin_token`.

The TestClient context runs lifespan once. The application registry and client
cookie jar are shared; integration tests can contaminate each other. New tests
must create their own records and avoid mutating seeded admin data or asserting
a global total of one. Unit tests should instantiate fresh adapters.

For isolated HTTP behavior, use deliberate dependency overrides/reset/fixtures
and restore them reliably. Coordinate cookie isolation and fixture lifetime so
auth tests cannot log out or revoke credentials used by other tests. The registry
provides a reset helper, but resetting underneath a session token is unsafe.

Existing entity tests contain duplicate test method names that Python overwrites.
Existing user tests modify seed data, and some list tests rely on initial counts.
Do not infer comprehensive coverage from these files or repeat their state
dependencies. Fix test structure within the authorized scope of related work.

A closed-stream warning filter exists in conftest. Do not broaden filters to
hide failures; distinguish that known warning from genuine logging or test errors.

### Required coverage for affected behavior

- Entities/pure transformations: boundaries, invariants, timestamps, update
  atomicity, null/empty distinctions, and invalid inputs.
- Use cases: missing records, uniqueness/conflicts, dependency failures,
  assignment/removal semantics, and public output.
- Repositories: absent records, duplicate assignments, pagination boundaries,
  cleanup/relationship behavior, and future transaction/constraint handling.
- HTTP contracts: status, envelope, DTO serialization, validation, pagination,
  cookies, and authorization for an ordinary permitted user and a denied user.
- Authentication: wrong credentials, inactive users/roles, invalid/expired tokens,
  identity consistency, refresh expiry/revocation, and logout behavior.
- Security/integrations: tenant/ownership denial, malicious verification URLs,
  token secrecy, provider failures, retries, and idempotent writes.
- Catalog/generator changes: temporary files, malformed input, enum/catalog
  consistency, output paths, and timestamp correctness.
- Database changes: real PostgreSQL integration tests and migration/data-preservation
  checks; an in-memory fake alone cannot establish database correctness.
- Background work: repeat execution, partial failure, deterministic retry behavior,
  and stale authorization/integration state.

Use controlled clocks, deterministic fixture data, temporary catalogs, injected
service fakes, and isolated state. Do not depend on test order, sleeps, randomness,
live Google services, or production databases. Browser journeys are a future
product validation layer; no backend Playwright setup exists now.

## 11. Comprehensive validation after development

For executable backend changes, validation is part of completion:

1. Establish the correct Python 3.12/PDM environment and inspect the initial Git
   status. Run the focused Red test, the Green test, and affected layer tests.
2. Run `pdm run pytest` after the final change. Review failures, warnings, and
   collection; do not declare completion from a focused test alone.
3. For substantive behavioral changes, run `pdm run pytest --cov=.` or the relevant
   scoped coverage check, inspect untested affected branches, and explain gaps.
   A percentage alone is not proof of correctness; no global threshold is imposed.
4. For HTTP/DTO/auth changes, validate the actual OpenAPI schema and representative
   responses, error statuses, pagination, cookie flags, and denied access.
5. For storage/integration/job work, run the relevant real database, migration,
   adapter-contract, failure/retry, and isolation checks described above.
6. Check startup/lifespan and configuration behavior where affected. Verify
   secrets are absent from API outputs, logs, fixtures, and diffs.
7. Review all changed files and `git diff --check` from `Backend/`. Account for
   untracked files, artifacts, and unrelated changes; ensure the final diff
   matches the authorized scope.

Use `make lint` only as its limited syntax check. If a task establishes additional
tooling, document and run its actual commands. Do not claim nonexistent lint,
type-check, CI, migration, or frontend test commands succeeded.

Coordinate frontend generation/build checks when a backend contract affects the
consumer and the task permits frontend changes. A backend-only scope requires a
clear report of consumer impact, not unauthorized edits in `../Frontend/`.

For documentation-only work, verify references, commands, current versions,
Markdown structure, consistency, and file scope. Do not install dependencies,
import/start the application, generate clients, or run application tests just to
validate prose. Report skipped checks and the reason accurately.

## 12. Documentation, generated ownership, Git, and completion reports

### Documentation and catalog ownership

When scope permits, document changed contracts, environment/setup steps,
migration/recovery procedures, security assumptions, provider semantics, and
architectural decisions alongside the implementation. Preserve relevant Persian
product documentation. Keep examples executable and separate current behavior
from future design.

`statics/permissions.json` and `statics/policies.json` are current catalogs.
Runtime enums are in `app/infra/utils/auth/permission.py` and `policies.py`,
with generated-file warnings. Preserve existing identifiers and relationships
unless the authorized change explicitly revises them.

`scripts/auth_manager.py` is not safe to run blindly:

- It targets obsolete `app/utils/auth/` enum output paths rather than the runtime
  `app/infra/utils/auth/` paths.
- Its permission-policy assumptions exceed the current catalog/DTO structure.
- Current permission enums contain entries absent from the JSON catalog.
- Its timestamp generation uses local naive time labeled as UTC.

For catalog work, inspect and test the generator in temporary locations, reconcile
the intended source of truth/output paths within scope, and review generated
diffs. Never describe an unchecked CLI run as a reliable regeneration process.
Do not hand-edit generated enums as an unexplained workaround.

### Git practices

`Backend/` and `../Frontend/` are separate Git repositories. Run backend status,
diff, and any requested commit operations from `Backend/`.

- Preserve existing user changes. Do not reset, clean, overwrite, or stage
  unrelated work.
- Review scoped diffs and untracked files. Exclude secrets, local environments,
  logs, caches, coverage output, and unintended generated artifacts.
- Keep requested commits focused and cohesive. Do not invent a branch naming,
  release, merge, deployment, or CI policy.
- **Never commit automatically.** Do not stage, commit, push, or deploy merely
  because implementation is complete; require explicit authorization for those
  operations.
- Suggest exactly one accurate Conventional Commit message in the completion
  report. Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):
  `<type>(optional-scope): imperative description`. Choose a type that matches the
  actual change, such as `fix`, `feat`, `refactor`, `test`, or `docs`.
  Mark breaking changes only when real contract incompatibility exists.
  This requested suggestion does not establish an automatic commit workflow.

### Required technical completion report

Every development task must finish with a precise, reviewable summary:

1. **Outcome and changed files:** explain what changed and the concrete behavior
   or problem addressed; list the actual files.
2. **Why and key decisions:** explain architecture, contract, security, and
   persistence decisions relevant to the change, including compatibility impact.
3. **Validation:** state exact commands/checks and their results, including the
   observed Red–Green–Refactor evidence and full-suite result where applicable.
   Distinguish checks executed from checks proposed.
4. **Skipped checks and limitations:** give reasons, environment blockers,
   unresolved decisions, existing relevant gaps, and any remaining unverified
   behavior. Never imply production readiness from local tests alone.
5. **Commit suggestion:** provide one accurate Conventional Commit message and
   confirm that no commit was created unless explicitly requested.

Scale detail to the change, but retain these facts. Report failures candidly;
do not hide missing validation behind a generic statement that tests passed.
