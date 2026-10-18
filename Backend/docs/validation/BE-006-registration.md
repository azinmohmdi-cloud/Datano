# BE-006 — active public User registration

Validated locally on **2026-10-18**. BE-005 is complete; the initial working tree
was clean. Scope is public registration, active ordinary User assignment and
registration-specific abuse controls. No Frontend, approved page design,
permission catalog, session implementation or unrelated backlog task changed.

## Outcome and contract

**`POST /api/auth/register`** accepts only `first_name`, `last_name`, `email` and
`password`, without bearer authentication, an existing cookie or administrative
permission. Success returns **201** with the existing `{success, message,
payload}` envelope and public user DTO. The account is active and assigned the
backend-selected `User` role. No token/cookie/session is issued by registration.

| Acceptance | Implemented and verified |
| --- | --- |
| Public registration | OpenAPI has no security requirement; an unauthenticated real PostgreSQL HTTP request succeeds. Existing protected `POST /api/users/` stays protected and inactive. |
| Active ordinary User | Password creation reuses BE-005 Argon2id/Unicode policy; creation, activation and exactly one User assignment share the existing request transaction. A fresh app lifetime can authenticate the new account; its token cannot list administrative users. |
| Reject caller-selected privileges | `extra=forbid` rejects role/roles/role IDs, permission IDs, activation, username, account ID and password hash inputs with 422. No account is persisted by those requests. No email selects Admin. |
| Duplicate/invalid/abusive requests tested | Canonical duplicates return 409, including concurrent attempts with one winner. Invalid names/email/passwords return 422. Shared PostgreSQL limits precede JSON parsing and hashing, survive fresh app lifetimes, ignore forged forwarding headers and fail closed on storage errors. |

`RegisterUserUseCase` delegates creation to the existing `CreateUserUseCase`;
there is no duplicate hashing/identity implementation. Names require non-whitespace
content, preserving the approved form's lack of an invented name-length rule.
Email and password rules are the existing BE-005 rules. Public conflict errors
do not echo account identifiers. Unknown request fields are rejected rather than
mass-assigned. Missing or inactive default User role yields 503 without creating
an account; registration never provisions or re-enables roles.

The existing repository dependencies give creation, activation and assignment
one SQLAlchemy session/transaction. A forced failure **after assignment** rolls
back both the account and relationship. Canonical duplicate registration races
produce exactly one account with one User assignment. Registration needs no
email verification for ordinary activation, as approved in MVP; administrator
email proof remains BE-014. Confirmation remains the approved form's exact
client-side comparison; the wire contract sends one password field.

## Registration abuse controls and migration

These are new, configurable **technical defaults**, not account quotas or
OWASP-prescribed numbers:

| Environment setting | Default |
| --- | --- |
| `REGISTRATION_IP_LIMIT` | 5 attempts per peer/window |
| `REGISTRATION_WINDOW_SECONDS` | 600 seconds |
| `REGISTRATION_MAX_BODY_BYTES` | 8192 bytes for the complete body |

Nonpositive configuration is rejected; the attempt limit must fit the PostgreSQL
integer counter. All workers must share configuration and storage. Fixed UTC
windows use the **database clock** in normal operation. Each attempt atomically
inserts/increments a per-peer/window counter, saturating at limit+1. Twelve
concurrent transactions at limit five admit exactly five. Equivalent IPv6 and
IPv4-mapped spellings share a bucket; different peers remain independent.
Absent/unparseable peers share one restrictive bucket.

A registration-only `APIRoute` guard consumes the quota before parsing a body,
resolving account dependencies or hashing a password. Its short transaction
commits separately from the account transaction: invalid input, malformed JSON,
duplicate accounts, oversized bodies and subsequent rollback cannot refund an
attempt. Denied requests return **429**, `RATE_LIMITED`, and matching retry seconds
in `Retry-After` and `payload.details.retry_after`. Denials do not extend expiry.
The counter resets at the exact fixed-window boundary. Tests asserting time
boundaries inject a fixed clock while retaining real PostgreSQL operations;
ordinary HTTP tests also exercise the default database clock.

The guard checks declared length and the actual stream before buffering beyond
the limit. Exactly 8192 bytes is accepted; 8193 bytes returns **413**, including
without Content-Length/chunked input. Structural 422 errors omit input/context
data that can echo credentials. Redaction uses the canonical matched route,
including a real prefixed proxy `root_path`. Password DTOs remain `SecretStr`.

The peer is the ASGI connection address; application code does not parse
`X-Forwarded-For`, `Forwarded` or `X-Real-IP`. The serving proxy/server must make
that address trustworthy through its explicit trusted-proxy policy. The database
holds only a SHA-256 peer token, window timestamps and a counter, never a request
body, password, email or raw address. Tokens are pseudonymous, not an anonymity
guarantee. Per attempt, at most 100 expired rows are deleted using skip-locked
selection; live windows are preserved. Inactivity can leave expired rows until
another request or authorized maintenance.

Revision **`0004_registration_attempts`** creates only `registration_attempts`,
its expiry index, composite primary key and required check constraints. Real
PostgreSQL tests verify upgrade from 0003, replay, downgrade/re-upgrade, preserved
identity data and database enforcement of positive attempts, non-null values,
peer-key length and valid expiry. The existing ORM/head metadata comparison
passes. Empty-schema upgrades remain covered by the full suite. Startup now
checks the required counter columns and fails with `run alembic upgrade head`
for an outdated schema; it never runs DDL automatically. A counter-store failure
during a request yields 503 and cannot enable unlimited registration.

Downgrading only 0004 drops counters, resetting their short-lived history, and
preserves identity data. The new app requires 0004; deliberate rollback requires
matching code. No production migration or rollback was performed. The historical
BE-005 backfill test is pinned to 0003 instead of the moving head; its preservation
assertions remain intact.

## Executed Red–Green and full validation

Environment: **Python 3.12.14**, **PDM 2.29.2**, real **PostgreSQL 17.11**. No
dependency or lockfile change was needed. Commands ran from `Backend/` through
PDM; the temporary `run-tests.py` wrapper reads a private dedicated
`DATANO_TEST_DATABASE_URL` and forwards arguments to `.tools/pdm/bin/pdm run pytest`.
Credentials/cache/logs were kept outside tracked files.

| Executed check | Actual result |
| --- | --- |
| Baseline `pdm run pytest` before implementation | **219 passed**, 20.259s |
| Registration/migration Red: `tests/integration/test_registration.py tests/integration/test_registration_migration.py` | **27 failed**, 3.013s; missing route/table, zero setup/import errors |
| Initial registration/migration Green | **27 passed**, 3.769s |
| Missing-migration startup Red | 1 expected failure: startup incorrectly succeeded at 0003 |
| Integer-ceiling counter Red | 1 expected failure: the maximum configured counter returned 503 instead of a denied decision |
| Expanded registration, limiter, migration and configuration Green | **47 passed**, 5.717s |
| First complete suite | **266 passed**, 33.700s |
| Prefixed-root-path credential Red | 1 expected failure: structural 422 echoed the synthetic password |
| Root-path redaction and exact body-boundary Green | **2 passed**, 0.918s |
| Final complete suite with controlled quota-test clocks and branch coverage | **268 passed**, about 36.27s; **0 failures, 0 errors, 0 skips**, no warnings |
| `pdm lock --check` | Passed; dependency declarations and `pdm.lock` unchanged |
| `make lint` | Passed; only its existing `app/main.py` syntax check, not comprehensive lint/type checking |
| Actual OpenAPI comparison | Only `/api/auth/register` and `UserRegistration` added; all prior paths, operations and schemas unchanged |
| `git diff --check` and local documentation links | Passed |

The final full command was:

```sh
pdm run pytest --cov=app --cov=migrations --cov-branch \
  --cov-report=term-missing \
  --cov-report=json:/private/tmp/datano-be006/coverage-final.json \
  --junitxml=/private/tmp/datano-be006/full-final.xml
```

The **49 new cases** comprise 32 HTTP cases, nine real limiter/constraint cases,
one migration preservation test and seven configuration cases. Existing identity,
bcrypt migration, roles, authorization, process-restart, transaction and fixture/
cookie-isolation regressions remain passing. Quota tests avoid wall-clock
boundary flakiness; concurrency tests use independent sessions and controlled
clocks, not sleeps or global seeded counts.

The first root-path probe used an unprefixed URL and did not reproduce the
deployment case. The recorded Red uses `/service/api/auth/register` with
`root_path=/service`, then verifies the same request after the fix. Red counts
above reflect real missing behavior, not a setup/import failure.

Coverage initially missed executed lines after async SQL calls. A temporary
thread/greenlet diagnostic recovered those lines; `[tool.coverage.run]` now names
both concurrency mechanisms as required by coverage.py. No exclusion, threshold
or test assertion was weakened. Final combined statement/branch coverage is
**83.98%** (2278/2611 statements and 227/372 branch exits). The registration
controller, input DTO and revision 0004 have **100%** coverage; the use case is
**95.56%**, limiter **92.31%**, and route guard **91.30%**. Remaining new defensive
gaps include an impossible-in-normal-SQL update returning no account, invalid
direct-constructor/naive-clock calls, missing storage in a custom lifespan and
malformed Content-Length fallback branches. All acceptance behavior has direct
passing tests; the global percentage does not imply complete security coverage.

## Final environment, scope and limitations

After the final suite, `SELECT 1` succeeded, PostgreSQL reported **17.11**, and
**zero** test schemas remained. Docker inspection confirmed a healthy task-owned
`datano-be006-postgres` container with tmpfs storage. It was then stopped and
automatically removed with `--rm`; final `docker ps -a` was empty. No application
or database server is left running by this task.

The exact preserved image remains
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
All six previously preserved volumes remain unchanged. No image, volume or network
was deleted. A scan of changed source and **23** recently written application log
files found no private test database password or tested credential/hash marker.

Fixed-window per-peer throttling is an initial abuse barrier. Shared NAT users
share a quota; boundary bursts, rotating/distributed peers, ingress capacity and
proxy trust require deployment controls. This is not a DDoS/load benchmark.
No Redis/CAPTCHA dependency or global login/recovery limit was introduced.

No Frontend generation/build ran because this is a backend-only task. FE-029/
FE-030 must map the approved form to the real four-field contract and later
session behavior; no design change is needed here. The approved terms/version
and UI publication gate remain EXT-002/FE-048 work. No legal text, public rollout,
opaque session, CSRF, email delivery/recovery or administrator proof was added.
BE-007 was not started. Only the BE-006 completion checkbox is updated; no
stage, commit, branch change or push was performed.

## Changed files

- [Registration use case](../../app/application/use_cases/auth/register_use_case.py),
  [limiter port/result](../../app/application/use_cases/auth/interfaces.py).
- [Public controller](../../app/interface/controller/registration_controller.py),
  [router composition](../../app/interface/controller/api.py),
  [DTO](../../app/interface/dto/registration_dto.py),
  [dependency wiring](../../app/interface/dependencies/registration_dependencies.py),
  [route guard](../../app/interface/registration_route.py).
- [PostgreSQL limiter](../../app/infra/services/registration_limiter.py),
  [ORM](../../app/infra/database/models.py),
  [migration](../../migrations/versions/0004_registration_attempts.py).
- [Settings](../../app/infra/core/config.py), [environment template](../../.env.example),
  [startup](../../app/main.py), [errors](../../app/domain/error/exceptions.py),
  [handlers](../../app/domain/error/exception_handlers.py).
- [HTTP tests](../../tests/integration/test_registration.py),
  [limiter tests](../../tests/integration/test_registration_limiter.py),
  [migration tests](../../tests/integration/test_registration_migration.py),
  [configuration tests](../../tests/unit/test_registration_config.py),
  [historical backfill test pin](../../tests/integration/test_email_identity_migration.py).
- [Coverage configuration](../../pyproject.toml), [README](../../README.md), this
  report and only the BE-006 checkbox in [backlog](../../../docs/backlog.md).

## Primary references

Product behavior follows [Datano MVP](../../../docs/Datano_MVP.md) and the approved
[signup UI validation](../../../Frontend/docs/validation/FE-011-signup.md).
The route-scoped pre-processing uses the documented
[FastAPI custom APIRoute pattern](https://fastapi.tiangolo.com/how-to/custom-request-and-route/).
The shared increment uses PostgreSQL's atomic
[ON CONFLICT DO UPDATE](https://www.postgresql.org/docs/17/sql-insert.html).
Counter thresholds are project choices; the general automated account-creation
threat is described by [OWASP OAT-019](https://owasp.github.io/www-project-automated-threats-to-web-applications/assets/oats/EN/OAT-019_Account_Creation.html).
Accurate concurrent measurement follows
[coverage.py concurrency configuration](https://coverage.readthedocs.io/en/7.13.5/config.html#run-concurrency).
