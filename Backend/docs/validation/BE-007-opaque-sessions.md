# BE-007 — revocable opaque session store

Validated locally on **2026-10-18**. The prerequisite BE-005 and preceding
BE-006 are complete; the initial working tree was clean. Scope is the storage
and application primitive for opaque sessions. No existing HTTP contract,
Frontend page/design, permission catalog or unrelated task was changed.

## Outcome and acceptance

| Acceptance | Implemented and verified |
| --- | --- |
| Digest-only storage | A fresh 256-bit identifier is generated with `secrets.token_urlsafe(32)`. Only its 32-byte SHA-256 digest enters the repository and PostgreSQL. The table has no plaintext token/identifier column. A digest's hex representation cannot be used as a credential. |
| Normal lifetime | Inactivity **1800 seconds / 30 minutes**, absolute **43200 seconds / 12 hours**, matching the approved MVP. |
| Remember-me lifetime | Inactivity **604800 seconds / 7 days**, absolute **2592000 seconds / 30 days**, matching the approved MVP. |
| Exact expiry and absolute cap | Both profiles accept immediately before expiry and reject at/after it. Activity slides inactivity expiry to `min(now + issued_idle_timeout, original_absolute_expiry)` without extending the absolute cap. Expired or revoked records cannot be revived. |
| Revocation | Current-session revocation is idempotent. Account-scoped bulk revocation preserves other accounts' sessions. Both persist in PostgreSQL and participate in the caller's transaction. |

`SessionService` depends on `ISessionRepository` and `ISessionTokens`, preserving
the existing application/interface/infrastructure layers. `IssuedSession` carries
the raw identifier only back to its caller; persisted `SessionRecord` metadata
has only the digest, account ID, profile, idle timeout, creation/last-seen/expiry
times and optional revocation time. Raw tokens and digests are excluded from
dataclass repr. No email, role/permission snapshot, IP, device information or
request body is stored with a session. Public DTOs are unchanged.

Identifiers are exact case-sensitive URL-safe strings with 43 characters. Null,
empty, short, long, Unicode, JWT-like, oversized and whitespace-bearing inputs
are rejected before storage access. There is no token normalization or caller-
chosen identifier issuance. A broken token generator fails without publishing
its output. A digest collision yields a sanitized conflict and cannot overwrite
an existing session; missing identities cannot receive sessions.

## Time, transactions and concurrency

Normal execution uses PostgreSQL `clock_timestamp()`, sampled **after** acquiring
locks. Transaction-start time would be stale after a lock wait. Tests inject an
aware UTC clock to verify exact microsecond boundaries without sleeps. Backward
readings fail validation without decreasing last-seen time. Revocation remains
possible during clock rollback by retaining at least the stored last-seen time.
Naive clocks are rejected.

Every operation uses the supplied SQLAlchemy `AsyncSession`; repositories flush
but never commit. Account-row locks precede session-row locks consistently.
This serializes issuance, validation/touch and individual/bulk revocation for one
account until the caller commits. A waiting resolution sees a committed
revocation and uses the clock after waiting, preventing revival. Bulk revocation
also waits for in-flight issuance and includes it when ordered after issuance.
An issuance ordered after bulk revocation can create a new session. Independent
transactions/sessions and event barriers exercise these interleavings.

`resolve(token, touch=False)` checks validity without extending inactivity.
`revoke(token)` reports whether it changed a record, while `revoke_all(user_id)`
reports the number newly revoked. Unknown tokens return no record/false; missing
accounts have zero sessions to revoke. No repository-local dictionary/cache is
used. Real rollback tests cover issuance, activity, individual and bulk
revocation. A fresh Python process with a new database pool can resolve a
committed token; credentials are passed through stdin rather than process
arguments or stdout.

The four settings in `.env.example` are `SESSION_IDLE_SECONDS`,
`SESSION_ABSOLUTE_SECONDS`, `REMEMBER_SESSION_IDLE_SECONDS` and
`REMEMBER_SESSION_ABSOLUTE_SECONDS`. Values must be positive integer seconds
within the supported integer range, with idle <= absolute in both profiles.
Startup validates the pair constraints before opening a database pool. Each
new session snapshots its timeout and expiries; later policy changes affect
new sessions and cannot silently extend or shorten existing records.

Account locking is a correctness choice, not a throughput guarantee. Keep
transactions short and avoid external I/O while holding them. No load benchmark
was performed. A valid record is not an authorization decision: current user
activation and effective roles/permissions must be checked by the later HTTP
authentication/authorization work.

## Migration and startup

Revision **`0005_opaque_sessions`**, following `0004_registration_attempts`, adds
only `auth_sessions` and its account index. The digest is the primary key;
checks require a 32-byte value, positive idle timeout, ordered creation/last-seen/
idle/absolute timestamps and a valid optional revocation time. A non-null user
foreign key prevents orphan sessions and cascades account deletion to sessions.
Real PostgreSQL rejects malformed digest/lifetime/revocation data and orphan
references. The existing ORM/head metadata consistency test passes.

Tests upgrade from an empty schema and from 0004, replay the revision, downgrade
to 0004 and upgrade again. Existing identity rows, hashes, registration counters
and an unrelated probe table are preserved. The historical BE-006 migration
test is pinned to its own revision 0004 rather than the moving head, without
weakening its preservation assertions.

The application checks the required session columns at startup and refuses a
0004 schema with the existing `run alembic upgrade head` guidance. It still
never runs migrations or `create_all` automatically. Before serving the new code
against an intended development database, run from `Backend/`:

```sh
pdm run alembic upgrade head
pdm run alembic current
```

No real application/production database was migrated. Downgrading only to 0004
removes opaque sessions, invalidating them, and preserves identities/counters.
Use matching application code for an intentional rollback. Historical destructive
identity downgrades are unchanged and were exercised only in disposable schemas.

## Executed validation

Environment: **Python 3.12.14**, **PDM 2.29.2**, **PostgreSQL 17.11**. No new
dependency, lockfile edit or environment re-resolution was needed. Commands ran
from `Backend/`. The private `/private/tmp/datano-be007/run-tests.py` wrapper
reads only a dedicated `datano_test` database URL, sets private PDM cache/log
paths and forwards arguments to `.tools/pdm/bin/pdm run pytest`.

| Check | Actual result |
| --- | --- |
| Baseline complete suite | **268 passed**, 31.04s |
| Initial session Red: unit + PostgreSQL integration tests | **34 failed, 1 passed**, 1.91s; expected missing behavior/table, zero setup/import errors |
| Initial session Green | **35 passed**, 2.26s |
| Configuration/startup Red | **2 failed**, 0.69s; settings absent and startup incorrectly accepted 0004 |
| Expanded Green including historical counter migration | **56 passed**, 5.37s |
| First complete suite with branch coverage | **323 passed**, 42.70s |
| Expanded defensive session cases | **65 passed**, 5.62s |
| Final complete suite with branch coverage | **333 passed**, 43.04s; **0 failures, errors or skips**, no warnings |
| `pdm lock --check` | Passed; dependency declarations and lockfile unchanged |
| `make lint PDM=.tools/pdm/bin/pdm` | Passed; only the existing `app/main.py` syntax check |
| Actual generated OpenAPI comparison | Complete equality with the pre-change snapshot, including all **13 paths** and existing schemas |
| PostgreSQL final connection/schema cleanup | `SELECT 1` succeeded; version **17.11**; **zero** test schemas remained |
| `git diff --check`, source review and local documentation links | Passed |

The final equivalent PDM command was:

```sh
pdm run pytest --cov=app --cov=migrations --cov-branch \
  --cov-report=term-missing \
  --cov-report=json:/private/tmp/datano-be007/coverage-final.json \
  --junitxml=/private/tmp/datano-be007/full-final.xml
```

The **65 new cases** comprise 28 unit and 37 integration/startup cases. Existing
registration, email/password hash migration, authorization, roles, process
restart, transaction and fixture/cookie isolation tests still pass. No test
uses seeded-admin mutation, a global initial count or an execution-order
dependency; PostgreSQL tests use separate disposable schemas.

The first coverage review identified untested collision/error and dependency
wiring paths; direct tests now cover them. Final statement/branch coverage is
**100%** for the new session policy/metadata, application service, token adapter,
SQL repository, dependency providers and revision 0005. The abstract repository
port's four `NotImplementedError` bodies remain unexecuted intentionally.
Global combined statement/branch coverage is **84.97%**: 2479/2818 statements and
257/402 branch exits. Existing legacy/policy/error-path gaps remain; no coverage
exclusion or threshold was added or weakened. Coverage is not a claim of complete
security or production readiness.

## Environment, scope and limitations

The task-owned `datano-be007-postgres` container used `--rm`, loopback port
55433 and tmpfs database storage. After the final suite it was healthy and used
the exact preserved image:

`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`

It was then intentionally stopped and automatically removed. Final `docker ps -a`
is empty; no server is left running by this task. The exact image remains, all
six previously preserved volumes remain, and the `bridge`, `host` and `none`
networks remain. No image, volume or network was deleted; no legacy volume was
mounted or modified. Private test database credentials were absent from changed
files and **24** recent application log files.

No public endpoint consumes the new dependencies yet. The existing login,
refresh cookie and JWT authorization behavior is preserved. Secure opaque cookie
issuance, normal/remember-me browser cookie lifetime, login rotation, live
account/role authorization, CSRF and JWT transition belong to BE-008/009.
Logout and password-recovery flows remain their own tasks; only the necessary
repository revocation primitives are delivered here. No Redis, cleanup worker,
retention policy, analytics schema or Frontend generation/build was introduced.
Frontend checks were unnecessary because the complete API schema is unchanged.

Only BE-007's backlog completion checkbox is updated. No stage, commit, branch
change or push was performed.

## Changed files

- [Session policy and metadata](../../app/application/use_cases/auth/session_models.py),
  [application service](../../app/application/use_cases/auth/session_service.py),
  [token port](../../app/application/use_cases/auth/interfaces.py).
- [Repository contract](../../app/interface/repository/session_repository_interface.py),
  [dependency providers](../../app/interface/dependencies/session_dependencies.py).
- [PostgreSQL adapter](../../app/infra/repositories/postgres/session_repository.py),
  [token adapter](../../app/infra/services/session_token_service.py),
  [ORM](../../app/infra/database/models.py),
  [migration](../../migrations/versions/0005_opaque_sessions.py).
- [Settings](../../app/infra/core/config.py), [startup](../../app/main.py),
  [environment template](../../.env.example).
- [Unit tests](../../tests/unit/test_opaque_sessions.py),
  [PostgreSQL/startup tests](../../tests/integration/test_sessions.py),
  [process helper](../../tests/support/session_worker.py),
  [historical migration test](../../tests/integration/test_registration_migration.py).
- [README](../../README.md), this validation report and the
  [BE-007 backlog checkbox](../../../docs/backlog.md).

## Design references

The time values come from [the approved MVP](../../../docs/Datano_MVP.md), not
from an external security recommendation. The implementation was checked against
[Python 3.12 secrets documentation](https://docs.python.org/3.12/library/secrets.html)
for explicit random-byte generation,
[OWASP session management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
for opaque identifiers and server-side idle/absolute expiry, and
[PostgreSQL 17 explicit locking documentation](https://www.postgresql.org/docs/17/explicit-locking.html)
for row-lock serialization. These references do not establish ASVS compliance.
