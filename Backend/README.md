# Datano backend

FastAPI 0.115.6 layered application managed by PDM, requiring Python 3.12.
Read [the shared workspace instructions](../docs/AGENTS.md) and
[the backend engineering guide](AGENTS.md) before work. The approved target
and delegated defaults are in [the MVP document](../docs/Datano_MVP.md);
[the UX specification](../docs/datano-ux-pages-.md) limits the admin product UI to viewing.

## Current implementation

- Auth, users, and roles routes under `/api`; OpenAPI at `/openapi.json`.
- Email/password login with canonical email lookup; deprecated username login
  remains for compatibility. Bearer JWT access tokens and HTTP-only refresh cookie.
- Argon2id for new passwords and verified legacy hash upgrades; exact Unicode
  passwords and an explicit recovery response for bcrypt inputs over 72 bytes.
- Public registration creates an active ordinary `User` atomically. Registration
  attempts have PostgreSQL-backed per-peer throttling and a bounded request body.
- Role permission checks; JSON permission/policy catalogs. Policy evaluation is
  a placeholder, not a delivered ABAC engine.
- PostgreSQL-backed users, roles and assignments through the existing repository
  contracts, with SQLAlchemy 2 async transactions and Alembic migrations.
- Refresh-token dictionaries remain process-local pending the session tasks.
- A digest-only, revocable opaque-session store is available in PostgreSQL.
  Login issues its secure cookie and `/auth/me` reads current server identity.
  Legacy JWT compatibility remains temporarily until BE-009.
- DTO/mapping and use-case/repository separation. Domain errors still depend on
  FastAPI status values and pagination types cross layer boundaries; isolation is partial.
- Pytest entity/repository/HTTP tests, including real PostgreSQL constraints,
  rollback and application process restart checks. Legacy HTTP tests explicitly
  inject in-memory adapters with per-test clients, cookies and state.

These are template/development capabilities, not a completed marketing backend.
The approved target also includes Celery/Redis, full session authorization/CSRF,
email recovery, and the five-domain-entity product model.
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
pdm run alembic upgrade 0001_database_baseline --sql
```

Revision `0001_database_baseline` establishes history without domain tables.
Revision **`0002_users_roles`** adds `users`, `roles` and the `user_roles`
assignment table. `alembic upgrade head` works from an empty target or BE-003's
baseline and preserves unrelated tables/data. These first two revisions introduce
no analytics or session tables. No migration or `create_all` runs during startup.
Revision **`0003_email_identity`** adds a nonempty, non-null, unique `email_key`
and backfills existing records using Python's exact `email.strip().lower()`.
It preserves display email, account IDs, hashes, roles, assignments and timestamps.
This data-dependent revision requires an **online PostgreSQL** connection;
`upgrade head --sql` deliberately fails rather than producing an incomplete backfill.
The baseline-only offline example above remains supported. Identity ORM metadata
is registered for autogeneration; generated revisions still need review.

Revision **`0004_registration_attempts`** adds only shared, expiring registration
attempt counters and their index/check constraints. It changes no user, role,
assignment or hash data. Startup checks this required table and refuses an
outdated schema with `run alembic upgrade head`; it never migrates automatically.
Downgrading just to `0003_email_identity` drops only counters and preserves
identity data, but resets their rate-limit history. Use matching application
code when intentionally rolling back; the BE-006 app requires the new table.

Revision **`0005_opaque_sessions`** adds `auth_sessions` with a 32-byte digest
primary key, a cascading user foreign key, an account index and lifetime checks.
It changes no existing identity or registration data. The current app checks
both the counter and session tables at startup and requires `alembic upgrade head`.
Downgrading only to `0004_registration_attempts` drops opaque sessions and thereby
invalidates them; identities and registration counters are preserved. Use matching
code for deliberate rollback. No production database was migrated by BE-007.

The backfill holds an exclusive lock on `users` inside PostgreSQL transactional
DDL. Stop application writers for the migration and plan an appropriate
maintenance window for the target data size. Canonical collisions or empty keys
abort the entire revision, including its DDL and version marker. No account is
merged, deleted or selected as a winner. Before retrying, an operator must review
the conflicting accounts in a private, backed-up environment, establish ownership
and approve a data correction. This task does not modify real account data or
automatically resolve collisions. Do not bypass the guard or publish account
emails/hashes in migration logs. Downgrading just to `0002_users_roles` removes
only the derived key and its constraints; existing display identity and hashes
remain intact. Re-upgrading recalculates keys.

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
behavior. Display email, internal username and role names retain their exact-value
unique constraints. `email_key` independently enforces canonical uniqueness,
including concurrent writes. Application writes derive it in the SQL repository
on create/update; direct SQL writers must use the same Python rule. The assignment
primary key rejects duplicates, and foreign keys prevent orphan assignments.
Deleting a user or role cascades only to its assignment rows; it never deletes
the opposite parent record. Role permission IDs persist as a PostgreSQL text
array matching the existing contract; catalog validation stays in the use cases.
Lists use SQL pagination ordered by `(created_at, id)` with compatible empty-page
metadata, and roles for a user page are loaded together. Returned domain entities
are detached values, not live mutable ORM references.

Refresh-token persistence, admin
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

## Email identity and password compatibility

BE-005 keeps the existing routes, response envelopes and JWT/refresh-token
mechanism. `POST /api/auth/login` now accepts `{"email":"person@example.test",
"password":"the exact existing secret"}`. Supply exactly one of `email` or the
deprecated compatibility field `username`; both/neither return 422. Email lookup
and uniqueness use Unicode trim/lowercase only, preserving dots and `+` tags.
Display spelling retains case, with outer whitespace removed on new writes.
Historical display spelling is left untouched by migration. No Unicode
normalization or provider-specific email alias rules are applied.

`POST /api/users/` remains permission-protected and creates inactive accounts.
Its body needs first/last name, email and password; username is optional and is
generated internally when omitted. Public `User`/create/login schemas mark the
legacy username field optional/deprecated. Existing JWT claims still carry the
internal username, so callers do not need to supply one. Public registration and
activation are provided separately by BE-006 below; opaque login/current identity
are provided by BE-008, with full authorization/CSRF migration still pending. Frontend
generation/adapters are deferred to FE-029; approved UI files are unchanged.

New password creation uses **15–128 Unicode codepoints** (Python `len`), including
spaces, Persian, ZWNJ and emoji, with no composition requirement, trim,
normalization or truncation. Hashes use Argon2id, version 19, memory **19456 KiB**,
time cost **2**, parallelism **1**, a random 16-byte salt and a 32-byte hash.
`argon2-cffi` **25.1.0** and its bindings **26.1.0** are locked; existing package
versions were retained. Stronger configured parameters may be supplied through
the password service; no upgrade lowers an existing parameter. Password CPU work
runs in a thread through the use cases. Deployment capacity/rate controls remain
the responsibility of their authorized tasks; this is no production load benchmark.

On successful active-account authentication, supported bcrypt `$2a$`/`$2b$`/`$2y$`
hashes are verified against the **full exact UTF-8 input up to 72 bytes** and
upgraded to Argon2id. Existing short passwords are verified and upgraded without
applying the new 15-character minimum. Low-cost Argon2id hashes also upgrade.
Hash replacement uses an atomic compare-and-swap in the request transaction,
preserving profile timestamps and preventing overwrite of a concurrent password
change. Failed/inactive logins never store an upgrade; transaction failure rolls
it back. The old `BcryptPasswordService` import name is a deprecated compatibility
alias that also creates only Argon2id hashes.

An input over 72 UTF-8 bytes against a legacy bcrypt hash returns **401** with
`payload.error_code="PASSWORD_RESET_REQUIRED"` and
`payload.details.recovery_required=true`. It never retries a truncated prefix,
ignores an incomplete UTF-8 character or prehashes an existing credential.
Historical truncation cannot prove the discarded suffix. Such accounts require
the recovery flow in BE-013 (not implemented here); they are not silently treated
as a normal wrong-password result. Hash conversion needs a verified plaintext
secret and is therefore performed at login, never by a schema migration.

Credential DTOs use `SecretStr` internally and OpenAPI marks passwords write-only.
Credential-route structural 422 errors retain FastAPI's `detail` list but omit
input/context payloads that could echo the entire password-bearing body. No
plaintext password, hash or `email_key` is added to public user responses.

See [BE-005 validation](docs/validation/BE-005-email-passwords.md) for exact
Red/Green results, PostgreSQL migration/constraint checks, contract changes,
coverage and limitations.

## Public registration

BE-006 adds **`POST /api/auth/register`** without an administrative permission or
existing session. Its JSON body contains exactly:

```json
{
  "first_name": "Given name",
  "last_name": "Family name",
  "email": "person@example.test",
  "password": "An exact 15–128 codepoint secret"
}
```

Success returns **201** with `{success, message, payload}` and the existing public
user representation. The account is active and has only the backend-selected
`User` role. Names require non-whitespace content, without an invented field
length limit. Email identity and password policy reuse BE-005. Internal username
generation, hash creation, activation and role assignment use the existing
repositories in one request transaction. Failure rolls back the complete account
and assignment. Registration itself sets no cookie or token; session issuance is
provided separately by BE-008. Protected `POST /api/users/` behavior is unchanged.

Unknown fields are rejected with 422, including roles, permissions, username,
activation, IDs and password hashes. No address grants Admin automatically.
Canonical duplicate emails return 409, including concurrent attempts. Invalid
input returns 422 without echoing the password. Missing/inactive default `User`
role or unavailable attempt storage returns 503 and creates no account. Role
records are reconciled at startup, never created or re-enabled by registration.

Registration-only technical defaults are configurable in `.env`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `REGISTRATION_IP_LIMIT` | `5` | Attempts per peer in each fixed UTC window |
| `REGISTRATION_WINDOW_SECONDS` | `600` | Window duration in seconds |
| `REGISTRATION_MAX_BODY_BYTES` | `8192` | Entire request-body byte bound |

All must be positive; the attempt limit must also fit the PostgreSQL integer
counter. These are initial engineering defaults, not product/account quotas or
OWASP-mandated numbers. Workers must share settings and the database. A
registration-specific route guard consumes a counter before JSON parsing,
dependency resolution or password hashing. Success, validation errors, malformed
JSON, duplicate emails and oversized requests all consume attempts. Counters
commit independently of the account transaction so an error cannot refund them.
Excess requests return **429**, `payload.error_code="RATE_LIMITED"`, a
`Retry-After` header and `payload.details.retry_after` in seconds. Denials do not
extend the window. Chunked/no-length bodies are checked while reading; the exact
byte limit is accepted and a larger body returns **413**.

The peer comes only from the ASGI connection address, with equivalent IPv6 and
IPv4-mapped spellings canonicalized. Missing/unparseable peers share one
restrictive bucket. The application does not trust `X-Forwarded-For`, `Forwarded`
or `X-Real-IP` itself. An ingress proxy/server must establish a trustworthy ASGI
peer using an explicit trusted-proxy policy; deployment verification belongs to
OPS-001. The database stores a SHA-256 peer token, window timestamps and a capped
counter; no raw address, email or credential body is stored there. The peer token
is pseudonymous, not an anonymity guarantee. Each attempt removes at most 100
expired rows, skips locked rows and preserves live windows. Expired rows can
remain during inactivity until a later request or authorized maintenance.

This fixed-window per-peer control is an initial abuse barrier: shared NAT users
share a quota, boundary bursts and distributed/rotating peers need ingress/bot
controls. It is not a production load/DDoS guarantee. No Redis, CAPTCHA, global
auth throttling or unrelated endpoint limit was introduced. The approved signup
UI and its unavailable-terms gate are unchanged; public rollout/terms integration
still depends on EXT-002, FE-048 and the authorized transport/session tasks.

## Opaque session store (BE-007)

`SessionService` uses the `ISessionRepository` contract and the SQLAlchemy
`SQLSessionRepository` adapter. `issue(user_id, remember_me=...)` generates a new
256-bit identifier with `secrets.token_urlsafe(32)` and returns it only to its
caller. PostgreSQL receives only SHA-256's 32-byte digest and technical metadata.
It stores no raw identifier, email, role/permission snapshot, IP or device data.
Identifiers are exact, case-sensitive URL-safe strings; malformed input and a
hex digest cannot authenticate. Token and digest fields are excluded from repr.

| Profile | Inactivity limit | Absolute limit |
| --- | --- | --- |
| Normal | 30 minutes | 12 hours |
| Remember-me | 7 days | 30 days |

The approved MVP defaults are configurable through `SESSION_IDLE_SECONDS=1800`,
`SESSION_ABSOLUTE_SECONDS=43200`, `REMEMBER_SESSION_IDLE_SECONDS=604800` and
`REMEMBER_SESSION_ABSOLUTE_SECONDS=2592000`. All must be positive integer seconds
with idle <= absolute; invalid pairs fail startup. A session snapshots its idle
timeout and absolute expiry when issued, so a later configuration change applies
to new sessions. The PostgreSQL wall clock is sampled **after** waiting for locks.
At either exact expiry the record is invalid. Activity updates last-seen time and
slides idle expiry only up to the original absolute cap; expired/revoked records
cannot be revived. Backward clock readings fail validation without extending time.

`resolve(token, touch=False)` checks without extending inactivity. `revoke(token)`
is idempotent; `revoke_all(user_id)` invalidates that account's stored sessions.
All operations participate in the caller's transaction, with no internal commit.
Account-row locks precede session-row locks and serialize issue/touch/revoke/bulk
revocation for one account until commit. Bulk revocation covers sessions ordered
before it; a subsequent authorized issuance can create a new session. Keep these
transactions short; this correctness choice is not a throughput benchmark.

BE-008 below now consumes these providers for login and current identity. A valid
record alone is **not** an authorization decision: activation and current roles
are reloaded. General permission enforcement/CSRF and the final JWT transition
remain BE-009. Logout/recovery flows, Redis, an expiry-cleanup job and a session
retention policy are not added by these storage/login tasks.

See [BE-007 validation](docs/validation/BE-007-opaque-sessions.md) for real
PostgreSQL boundaries, concurrency, rollback, process persistence, migration
preservation and full-suite evidence.

Validate using the dedicated PostgreSQL setup above:

```sh
pdm run pytest tests/integration/test_registration.py tests/integration/test_registration_limiter.py tests/integration/test_registration_migration.py tests/unit/test_registration_config.py
pdm run pytest --cov=app --cov=migrations --cov-branch
```

Coverage explicitly traces both threads and SQLAlchemy greenlets; without that,
concurrent async SQL can leave misleading after-await gaps. No threshold or
exclusion was relaxed. See [BE-006 validation](docs/validation/BE-006-registration.md)
for actual Red/Green runs, concurrency, migration, API and full-suite results.

## Email login and current session (BE-008)

`POST /api/auth/login` accepts email, the exact existing password and optional
`remember_me` (strict JSON boolean, default false). Exactly one email or the
deprecated username compatibility field is accepted; unknown fields, including
caller-selected roles/activation, return 422. Email lookup and password/hash
compatibility reuse BE-005 rather than reimplementing identity rules.

A successful response keeps the existing envelope and temporarily retains
`payload.title`, `token`, `type` and `expires_at` for existing JWT consumers.
It adds `payload.user` (the existing public User DTO) and `payload.effective_role`
(`Admin`, `User` or null). The token field is marked deprecated in OpenAPI.
The new opaque identifier appears only in Set-Cookie, never the JSON body.
Do not persist credentials in browser storage. FE-029/030 will connect the
approved UI after BE-009 establishes the final authentication/CSRF contract.

The normal cookie is **`__Host-datano_session`**, `HttpOnly`, `Secure`,
`SameSite=Lax`, `Path=/`, without Domain. Without remember-me it has no Max-Age
or Expires. Remember-me adds Max-Age equal to the issued absolute lifetime
(default **2592000 seconds / 30 days**). PostgreSQL still enforces the idle and
absolute limits independently; a browser retaining a cookie cannot bypass them.
No activity extends the original absolute cap. Normal browser closure does not
prove server revocation.

Default development also requires HTTPS for that cookie. The explicit
`SESSION_ALLOW_INSECURE_LOCAL_HTTP=true` exception applies only to HTTP URLs with
host `localhost`, `127.0.0.1` or `::1` and uses **`datano_session_dev`** instead.
It is false by default. HTTPS and non-local URLs still use the secure cookie
even when that flag is true. Do not enable the exception for deployment or use
an untrusted proxy Host/scheme as a substitute for a local environment. The target
deployment remains browser and `/api` on one HTTPS origin; production CORS/proxy
configuration is not introduced here.

Each successful login generates a fresh server identifier and atomically revokes
the previous browser cookie's session, including account switches. Unknown or
malformed incoming identifiers cannot fix the new session. Failed authentication
sets no cookie; a failure after rotation rolls back both insertion and revocation.
Account locks are ordered by ID before session mutation, including when switching
between two accounts. Initial credential verification is read-only; password
verification/legacy hash upgrade runs again under the ordered account locks.
This prevents a pre-existing bcrypt compare-and-swap lock from reversing lock
order. Concurrent deletion, activation/password changes and same-secret rehashes
are handled using current server state. No sleep or retry loop hides a deadlock.

`GET /api/auth/me` keeps the public User fields and adds `effective_role`. It
prefers the opaque cookie, validates/touches the stored session, reloads the
account and assigned role records, and rejects inactive/deleted accounts.
Active `Admin` wins over active `User`; inactive, deleted or custom roles cannot
invent either product role. Without an active product role the value is null.
No email or client header/storage value grants Admin. Administrator provisioning
and ownership proof remain BE-014. Successful login/current-identity responses
carry `Cache-Control: no-store`.

For this explicit intermediate phase only, `/me` still accepts its existing
bearer credential **when no session cookie is present**. A present empty,
malformed, unknown, revoked or expired cookie returns 401 even with a valid
bearer; it never falls back. Other protected routes and `/auth/refresh` retain
their JWT behavior pending BE-009. The legacy refresh cookie remains for those
consumers, now follows the same Secure/local policy and has no Max-Age without
remember-me; its server expiry is still the legacy configured lifetime.
`/auth/logout` still handles that legacy cookie and does **not** yet revoke the
opaque session: the public opaque logout flow is BE-010. These intermediate
capabilities are not a complete production authentication rollout. No global
session permission migration, Origin/CSRF-token enforcement or logout/recovery
flow was implemented in BE-008.

Login uses the existing bounded credential-body guard and PostgreSQL counter
implementation with an independent `login` namespace. The historical table name
`registration_attempts` is retained; only digest/window/count data are stored.
There is no new migration, schema, dependency or Redis service. Registration
keys and defaults are unchanged. Login's configurable technical defaults are:

| Setting | Default |
| --- | --- |
| `LOGIN_IP_LIMIT` | 10 attempts per peer/window |
| `LOGIN_WINDOW_SECONDS` | 600 seconds |
| `LOGIN_MAX_BODY_BYTES` | 8192 bytes for the complete body |

Attempts are recorded before JSON parsing/password work in an independent short
transaction, so malformed credentials, failure or account rollback cannot refund
them. Quota state survives app lifetimes. HTTP 429 includes Retry-After; oversized
fixed/chunked bodies yield 413; unavailable counter storage yields 503 without
authenticating. Forwarded address headers are not trusted by application code.
This per-peer barrier shares the registration limiter's NAT/boundary/distributed
abuse limitations and does not replace trusted ingress controls.

See [BE-008 validation](docs/validation/BE-008-session-login.md) for actual TDD,
PostgreSQL concurrency/rollback evidence, API compatibility changes and full-suite
results. No Frontend file, approved page design or generated client was changed.

## Test isolation

The legacy `test_client` fixture explicitly creates a test application with
in-memory repository overrides and the isolated development seed. It clears
cookies and resets the registry before startup and after shutdown, including
when a test fails. `admin_token` and `admin_auth` belong to that same test
lifetime; do not retain them across tests or reset storage while they are in use.
It explicitly overrides the session repository and login limiter for these
legacy bearer/CRUD characterization tests; product cookie/storage/rate behavior
uses real PostgreSQL in `test_session_login.py` and `test_sessions.py`.
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
