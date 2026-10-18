# BE-005 — canonical email identity and password hash migration

Validated locally on **2026-10-18**. Dependency BE-004 is complete. Scope is
canonical email identity, optional product username, Unicode password policy,
Argon2id and verified bcrypt migration. No Frontend file or approved design was
changed; no subsequent backlog task was implemented. No Git mutation occurred.

## Implemented behavior and decisions

| Acceptance criterion | Implementation and evidence |
| --- | --- |
| Unique trimmed/lowercase email key | Python `email.strip().lower()` in both lookups and SQL create/update; stored `email_key` has unique, NOT NULL and nonempty constraints. Real PostgreSQL backfill, collision rollback, update, duplicate and Unicode tests pass. Dots and `+` tags remain significant. |
| Username not required by product | `UserCreate`, `UserLogin` and public `User` mark username optional/deprecated. Creation generates an internal random username when omitted; email login works without knowing it. Existing legacy JWT/username compatibility remains explicit. |
| Argon2id and approved Unicode policy | New secrets contain 15–128 Unicode codepoints, strict UTF-8, with no trimming, normalization, composition rule or truncation. Argon2id v19 uses 19456 KiB, t=2, p=1, salt=16 bytes and hash=32 bytes. Persian, ZWNJ, spaces, combining forms, emoji and both length boundaries are exercised. |
| Tested bcrypt compatibility without new truncation | Exact full UTF-8 verification at/below 72 bytes; successful active-account login upgrades the hash atomically. Existing short secrets remain valid. Over-72-byte input gets explicit `PASSWORD_RESET_REQUIRED` (401), never prefix verification. Wrong/inactive/malformed credentials do not store upgrades. |

The email backfill freezes Python's strip/lower rule inside revision
`0003_email_identity`; it does not import mutable application helpers. PostgreSQL
locale-dependent `lower`/`btrim` is not an equivalent Unicode implementation.
Display spelling, IDs, timestamps, roles, assignments and credential hashes are
preserved. The revision takes an exclusive users-table lock and runs inside
PostgreSQL transactional DDL. Canonical collisions and empty keys abort without
merging/deleting any account, leaving the revision at `0002_users_roles`.
Resolving ownership conflicts requires a private operator review and an approved
data correction. No real account was changed to make a migration pass.

The backfill deliberately requires an online connection. Offline rendering of
the BE-003 baseline still works; offline upgrade through the new data-dependent
revision raises an actionable error before adding the column. Downgrade of just
0003 removes only its derived column/constraints; a real downgrade/re-upgrade
preservation test passes. ORM metadata matches the actual head schema.

New password hashes and successful format upgrades use the central
`Argon2PasswordService`. The old `BcryptPasswordService` import remains a deprecated
compatibility name; it never generates bcrypt. Hash/verify CPU work in use cases
runs through `asyncio.to_thread`, without moving a database session to a worker.
Argon2id upgrades retain every stronger existing parameter instead of replacing
them with lower defaults. Legacy verified secrets bypass the new creation-length
rule only for format migration.

The repository contract now has `replace_password_hash(id, expected, replacement)`.
The SQL adapter issues a conditional update and never commits independently or
changes profile timestamps. On a lost comparison, authentication reloads and
verifies the current hash; it rejects a changed secret, deleted account or inactive
account. A competing same-secret upgrade can succeed. Real overlapping SQL
transactions prove that a stale upgrade cannot overwrite a committed password
change; failure later in the transaction rolls back the upgrade.

Password DTOs use `SecretStr`; input ports/domain hash representations suppress
credential reprs. Credential-route structural 422 responses preserve FastAPI's
`detail` structure but omit input/context values that can contain an entire
password-bearing body. Public user responses omit passwords, hashes and keys.

## Environment and dependencies

- Python **3.12.14**, PDM **2.29.2**; project `.venv` and separate `.tools/pdm`.
- Added only `argon2-cffi` **25.1.0** and `argon2-cffi-bindings` **26.1.0**;
  all **52** pre-existing locked package versions were retained. Transitive CFFI
  marker metadata changed as resolved by PDM. `pdm lock --check` passed.
- Existing SQLAlchemy **2.0.55**, Alembic **1.20.0**, psycopg **3.3.6** and bcrypt
  **5.0.0** were retained.
- Real PostgreSQL **17.11**, temporary container `datano-be005-postgres`, loopback
  port 55433, tmpfs database storage and `--rm`. The exact preserved image was
  `postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
- Credentials and URL stayed in mode-0600 files under `/private/tmp/datano-be005`.
  Tests used the existing dedicated `datano_test*` database guard and per-test
  schemas. No SQLite fallback, application database or external email was used.

## Executed TDD and verification

Commands ran from `Backend/` through PDM with private test configuration. The
local wrapper `.venv/bin/python /private/tmp/datano-be005/run-tests.py` loads only
the dedicated test URL and invokes `.tools/pdm/bin/pdm run pytest` with its supplied
arguments. Cache/log directories were outside the repository. Reproduce using
the README setup and an exported private `DATANO_TEST_DATABASE_URL`.

| Check | Actual result |
| --- | --- |
| Existing baseline, `pdm run pytest --ignore=tests/unit/test_identity_passwords.py` before implementation | **146 passed**, 35.185s |
| Password Red, `tests/unit/test_identity_passwords.py` | 24 failed / 3 passed; missing Argon2id/policy/migration and malformed-hash behavior |
| Email Red, `tests/unit/test_email_identity.py` | 5 failed; required username and missing canonical lookup/conflict |
| Authentication Red, `tests/unit/test_password_authentication.py` | 4 failed / 2 passed; missing email argument, persisted upgrade and race handling |
| Initial identity Green, the three unit files above | **38 passed**, 1.698s |
| Migration Red, `tests/integration/test_email_identity_migration.py` | 6 failed; missing key/backfill/constraints and collision guard |
| Migration Green, email migration plus existing persistence migrations | **20 passed**, 2.130s |
| HTTP characterization/Red, `tests/integration/test_email_password_http.py` | 14 passed / 2 failed; password echoed in structural validation and missing write-only schema metadata |
| HTTP Green | **16 passed**, 1.911s; no warnings |
| First complete suite | **209 passed**, 19.636s |
| Final suite with follow-up defensive cases and branch coverage | **219 passed**, 21.586s; **0 failures, 0 errors, 0 skips**, no warnings |
| `pdm lock --check` | Passed; package comparison confirmed no existing version changed |
| `make lint` | Passed; this target only compiles `app/main.py`, not comprehensive lint/type checking |
| `git diff --check` | Passed |

The final command was:

```sh
pdm run pytest --cov=app --cov=migrations --cov-branch \
  --cov-report=term-missing \
  --cov-report=json:/private/tmp/datano-be005/coverage-final.json \
  --junitxml=/private/tmp/datano-be005/full-final.xml
```

All Red results counted above came from test bodies with zero setup/import
errors. An initial migration data-insertion helper reused one SQL parameter for
both Text and VARCHAR; separate parameters fixed that test preparation before
the recorded Red rerun. Two early negative bcrypt assertions accidentally grew
72-byte input beyond the supported boundary; changing the first character kept
the negative test within the intended boundary. A follow-up role fixture needed
`permission_ids=` rather than a positional role ID. These test mistakes were
corrected without weakening product assertions. Early Pydantic repr warnings
were resolved using `SecretStr`, not warning suppression.

Final JUnit and coverage JSON are temporary local evidence; this report records
the durable results. The complete suite retains the prior process-restart,
transaction, role, API authorization and per-test fixture/cookie isolation checks.
New real HTTP tests create a persistent user with no username, activate it only
through the existing protected administrative test flow, and authenticate after
a fresh app lifecycle using an exact 128-emoji password. A shorter prefix fails.
Legacy upgrade survival across fresh lifecycles, exact 72-byte ASCII/Persian
boundaries, over-boundary recovery responses, unchanged hashes on failed/inactive
login and secret-free representative errors are also exercised.

## Coverage and API contract

Combined statement/branch coverage of `app` and `migrations` is **82.75%**
(2080/2410 statements, 199/344 branch exits). This is not a global security or
feature-completeness claim. `domain/identity.py`, the password service and the
authentication use case have **100%** combined coverage. The SQL user repository
is **95.70%**; its remaining uncovered lines are pre-existing missing-user paths
after role assignment/removal. Revision 0003 is **95%**; the unforced branch
rethrows a non-unique unexpected database integrity failure. Existing unrelated
policy/refresh scaffolding and abstract port stubs retain coverage gaps.

Actual OpenAPI was retrieved in HTTP tests and compared against the preserved
BE-004 contract snapshot. Only **User**, **UserCreate** and **UserLogin** schemas
changed. Every path, operation and response envelope remains unchanged:

- Username is optional/nullable and deprecated in those three schemas.
- Login adds optional email; its description and runtime validation require
  exactly one email or legacy username plus the required password.
- Passwords are strings with `format=password` and `writeOnly=true`.
- No `email_key` or hash enters public schemas. The legacy token payload and
  refresh cookie remain the existing contract.

No Orval regeneration or Frontend build was run: this is a backend-only task;
consumer generation/transport is FE-029. No new route, public registration,
opaque session, CSRF or password-recovery endpoint was added.

## Final health, cleanup and limitations

After the final suite, `SELECT 1` succeeded, PostgreSQL reported **17.11**, Docker
reported the test container **healthy**, and **zero** BE-003/004-named test schemas
remained. A scan of the tracked diff and **28** recently written application log
files found no private database password; those logs also contained no tested
password marker or bcrypt/Argon2id hash marker.

Only the task-owned disposable `datano-be005-postgres` container was stopped and
automatically removed with its tmpfs data after verification. Final `docker ps -a`
was empty. The exact PostgreSQL image/digest and all six previously preserved
legacy volumes remained unchanged; no image, volume or network was deleted by
BE-005. Health was checked before intentional removal; no server is left running.

The 72-byte bcrypt limit is measured in **UTF-8 bytes**, while new password limits
are **Unicode codepoints**. Old truncation cannot be reversed or prove a lost
suffix. Over-limit legacy input explicitly requires recovery; BE-013 must deliver
that separate flow. Existing short verified secrets are not silently rejected by
the new minimum. Public signup/activation, opaque sessions, production cookie
security, CSRF, rate controls, recovery, administrator email proof and production
load/capacity validation remain their own tasks. No production migration,
deployment or real-account data repair was performed.

## Changed files

Backend source and dependency changes:

- [Authentication orchestration](../../app/application/use_cases/auth/authenticate_use_case.py),
  [password port](../../app/application/use_cases/auth/interfaces.py),
  [login](../../app/application/use_cases/auth/login_use_case.py),
  [auth inputs](../../app/application/use_cases/auth/models.py),
  [user creation](../../app/application/use_cases/user/create_use_case.py).
- [User entity](../../app/domain/entities/user_entity.py),
  [email rule](../../app/domain/identity.py),
  [recovery error](../../app/domain/error/exceptions.py),
  [credential validation errors](../../app/domain/error/exception_handlers.py).
- [ORM](../../app/infra/database/models.py),
  [migration 0003](../../migrations/versions/0003_email_identity.py),
  [SQL user adapter](../../app/infra/repositories/postgres/user_repository.py),
  [memory user adapter](../../app/infra/repositories/in_memory/user_repository.py),
  [repository port](../../app/interface/repository/user_repository_interface.py).
- [Password service](../../app/infra/services/password_service.py),
  [service exports](../../app/infra/services/__init__.py),
  [password helpers](../../app/infra/utils/password.py),
  [isolated memory seed](../../app/infra/core/seed.py).
- [Auth controller](../../app/interface/controller/auth_controller.py),
  [user controller](../../app/interface/controller/user_controller.py),
  [auth dependencies](../../app/interface/dependencies/auth_dependencies.py),
  [user dependencies](../../app/interface/dependencies/user_dependencies.py),
  [auth DTOs](../../app/interface/dto/auth_dto.py),
  [user DTOs](../../app/interface/dto/user_dto.py),
  [manifest](../../pyproject.toml), [lockfile](../../pdm.lock).

New tests:

- [Password boundaries/migration](../../tests/unit/test_identity_passwords.py),
  [email contracts](../../tests/unit/test_email_identity.py),
  [authentication races](../../tests/unit/test_password_authentication.py).
- [Email migration/data preservation](../../tests/integration/test_email_identity_migration.py),
  [credential HTTP contracts](../../tests/integration/test_email_password_http.py),
  [atomic hash persistence](../../tests/integration/test_password_hash_persistence.py).

Existing tests/support adjusted for valid **new** fixture passwords, historical
revision pinning or online-backfill characterization:

- [Shared fixtures](../../tests/conftest.py), [auth HTTP](../../tests/integration/test_auth.py),
  [user HTTP](../../tests/integration/test_users.py),
  [historical migrations](../../tests/integration/test_persistence_migrations.py),
  [restart worker](../../tests/support/persistence_worker.py),
  [fixture isolation](../../tests/test_fixture_isolation.py),
  [migration unit tests](../../tests/unit/test_database_migrations.py),
  [entities](../../tests/unit/test_domain_entities.py),
  [memory adapters](../../tests/unit/test_in_memory_repositories.py).

Documentation: [README](../../README.md), this report and only the BE-005
completion checkbox in [backlog](../../../docs/backlog.md).

## Primary references

The approved product rules are in [Datano MVP](../../../docs/Datano_MVP.md).
Argon2id's minimum m=19 MiB/t=2/p=1 and bcrypt's 72-byte boundary follow
[OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
The deployed bcrypt 5 behavior is documented by the
[bcrypt project](https://pypi.org/project/bcrypt/).
Argon2 operations and encoded parameters use the maintained
[argon2-cffi API](https://argon2-cffi.readthedocs.io/en/stable/api.html).
