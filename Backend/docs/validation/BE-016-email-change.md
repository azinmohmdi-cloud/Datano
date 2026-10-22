# BE-016 — new-mailbox-proved email changes

Date: 2026-10-22. Scope: the authenticated account's backend email-change
workflow. Dependencies BE-012, BE-015 and BE-014 are complete in Backlog.
Initial Git status was clean; existing Frontend work and reviewed UI are intact.
No dependency, lockfile, schema or migration revision change is required.

## Acceptance evidence

| Criterion | Implemented behavior and executed evidence |
| --- | --- |
| Email stays unchanged before proof | Request dispatches to the canonical new mailbox only; captured-mail HTTP tests assert original email, User role and protected-route denial before proof. Wrong code, target, account, purpose, expired code or revoked session cannot replace it. |
| Atomic uniqueness | Existing `uq_users_email_key` and `uq_users_email` arbitrate claims inside the final transaction. Real concurrent proofs by two accounts have exactly one winner and a static conflict for the loser, with every losing field/role/session unchanged. An address claimed after dispatch also returns safe HTTP `409`. |
| Reevaluate Admin | New proof is checked against the current private allowlist and active Admin role. Eligible User becomes proved Admin; proved Admin moving to an ordinary address becomes User. Raw assignments, removed eligibility, inactive/missing Admin and disabled User roles never grant authority. Old grant/assignment is removed before replacement. |
| Update session under approved policy | Every successful change creates a new opaque identifier and CSRF binding, revokes all prior account sessions, preserves remember-me and clamps absolute expiry to the preceding cap. Both session profiles, cookie attributes, old-cookie/CSRF denial and durable identity after app restart are tested. |

The MVP requires rotation on privilege changes. Rotating on every email change
and revoking other browsers is the defensive implementation choice for this
workflow; it does not extend the approved absolute lifetimes. No email or role
is taken from browser storage or selected account/role fields.

## Contract and transaction boundary

- `POST /api/auth/email-change/request`: strict write-only `{email}`, generic
  `200` envelope, `payload:null`, `Cache-Control:no-store`. Current/occupied
  targets receive the same response without delivery. An acknowledgement does
  not certify SMTP delivery.
- `POST /api/auth/email-change/verify`: strict write-only `{email,code}`. Success
  uses the existing public `SessionLogin` envelope, server effective role,
  rotated CSRF token and secure HttpOnly opaque cookie. Only canonical email
  (trim/lowercase, no alias transformations) and timestamp change in the user row.
- Opaque cookie + Origin + session-bound CSRF are mandatory. A genuine legacy
  JWT cannot replace the cookie. Body-selected user/role/activation is rejected.
  Input validation does not echo email, code or forbidden credential fields.
- Failure statuses: `401` invalid session/proof, `403` Origin/CSRF, `409` email
  unavailable at commit, `413` full-body limit, `422` strict DTO/validation,
  `429` peer quota with Retry-After and `503` unavailable infrastructure.
- Independent `email-change` peer namespace uses configurable defaults
  `EMAIL_CHANGE_IP_LIMIT=10`, `EMAIL_CHANGE_WINDOW_SECONDS=600`,
  `EMAIL_CHANGE_MAX_BODY_BYTES=8192`; shared BE-012 account limits apply as well.
  Origin/CSRF precedes quota; quota/body limits precede JSON validation.

Existing eight-ASCII-digit HMAC challenges provide single use, five attempts,
600-second expiry and 60-second resend. EMAIL_CHANGE has one scope per
account/current-email/password state, shared across browsers and all targets.
Its digest separately frames the canonical target, so a code for one destination
cannot prove another. Resending to another target replaces the previous pending
challenge. Other purposes' existing HMAC vectors are unchanged. Only HMACs and
existing technical metadata are stored; no new pending-email table is needed.
SMTP delivery gating and superseding generation checks are reused unchanged.

The final short transaction locks account before session, rechecks active
ownership, credential-state snapshot and session expiry, narrowly writes
email/key/timestamp, removes old authority, grants fresh verified Admin only when
currently eligible, removes existing recovery grants and rotates sessions.
Names, password hash, activation, username, unrelated accounts, custom roles and
other users' recovery authorizations are preserved. Concurrent name editing is
explicitly tested. A session expiring during authority work causes rollback.

Code consumption deliberately commits before this transaction: failures burn
the proof safely; account/role/recovery/session changes roll back together. Tests
inject a driver failure after session insertion and check every original row,
including the recovery grant, then reject replay. Public exceptions have static
messages and no raw driver exception context. Dispatch logs operation and class
only, never provider text, recipient or code. No transaction survives SMTP I/O.

## TDD and validation

Initial behavioral red runs used the actual app and PostgreSQL:

- The first new-mailbox HTTP scenario failed with expected `404 != 200` before
  route implementation (1 failed in 1.18s).
- The HMAC account-scope regression failed because different targets previously
  had different scopes (1 failed, 35 deselected in 0.48s).
- Email DTO characterization exposed acceptance of `a@local`, inconsistent with
  the existing entity validation (1 failed, 17 passed in 0.44s); the target now
  applies the existing entity rule plus shared mail-context safety.

Python **3.12.14**, project PDM **2.29.2**, locked dependencies. The private runner
sets `DATANO_TEST_DATABASE_URL` without printing it, then executes `pdm run pytest`.
PostgreSQL **17.11** uses the retained exact image
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`
in `datano-be016-validation`, loopback-only, task-owned tmpfs, per-test schemas.
Temporary credentials stay outside the repository in private mode-0600 files.

Executed checks:

```sh
pdm run pytest tests/unit/test_email_change.py tests/unit/test_email_codes.py \
  tests/integration/test_email_change.py tests/integration/test_email_change_http.py \
  tests/integration/test_email_codes.py tests/integration/test_admin_proof.py \
  tests/integration/test_admin_email_http.py tests/integration/test_own_profile_postgres.py \
  tests/integration/test_password_recovery.py tests/integration/test_recovery_http.py
pdm run pytest tests/unit/test_email_change.py tests/unit/test_email_codes.py \
  tests/integration/test_email_change.py tests/integration/test_email_change_http.py \
  --cov=app.application.use_cases.auth.email_change \
  --cov=app.infra.repositories.postgres.email_change_repository \
  --cov=app.interface.controller.email_change_controller \
  --cov=app.interface.dependencies.email_change_dependencies \
  --cov=app.interface.dto.email_change_dto --cov=app.interface.email_change_route \
  --cov=app.infra.services.email_code_crypto --cov-branch --cov-report=term-missing
pdm run pytest -q --tb=short --show-capture=no
pdm run python -m compileall -q app scripts
pdm lock --check
git diff --check
```

- Related regressions: **228 passed in 51.60s** before the final four boundary
  cases were added; none failed.
- Final focused validation: **98 passed in 18.20s**, including those four cases.
  Coverage of the seven listed task modules: **256/256 statements and all 34
  branches covered (100%)**. No global coverage threshold is claimed.
- Full backend suite: **872 passed in 121.36s**, no failures, skips or warnings.
  This includes all 63 new cases and the existing 809 tests, including prior
  migration upgrade/downgrade, identity, authorization and session regressions.
- Compileall, lock consistency and whitespace checks passed. Actual generated
  OpenAPI is exercised by tests; all body fields are write-only, additional
  fields forbidden, session/CSRF required and private configuration absent.
- Final health query: `SELECT 1` succeeded, PostgreSQL **17.11**, **zero**
  leftover generated test schemas. Disposable schemas migrated to head through
  the fixtures; existing full-suite migration and metadata checks passed with
  head unchanged at `0008_admin_grants`.
- Docker inspection confirmed tmpfs at `/var/lib/postgresql/data`, loopback-only
  publication and automatic removal. The task container was stopped and removed
  by its `--rm` policy. The exact image and all six original volumes remain.
- Final diff review is limited to the 20 paths listed below, all unstaged;
  staged diff is empty. No private settings, generated files or Frontend changes
  are included. Only the BE-016 checkbox is marked complete in Backlog; FE-033
  and all other statuses are preserved. All acceptance criteria above passed.

No backend formatter/linter/static type-checker is configured. Compileall is
reported as syntax verification, not lint or type checking. Frontend checks and
client generation were not run because Frontend was not changed by this task.

## Operational limits and unchanged scope

No additional real SMTP email was authorized or sent during BE-016. Tests use
the existing mail contract with a captured sender; BE-011's controlled SMTP and
Inbox evidence remains historical. Mail sending uses the existing process-local
background task, without a new durable queue or automated retry. After a rare
failure reading public identity following a successful commit, the owner can log
in at the proved new address; former sessions stay revoked.

No production/non-test database was migrated or modified. No existing Docker
volume was mounted. The exact PostgreSQL image and prior six preserved volumes
are retained; only the task-owned tmpfs container was removed after validation.
Frontend files, generated clients, reviewed UI and FE-033 remain untouched.
No Git Stage, Commit, Push or branch change is performed.

## Changed files

20 paths, all within Backend plus the selected Backlog checkbox:

- `Backend/.env.example`
- `Backend/README.md`
- `Backend/app/application/use_cases/auth/email_change.py`
- `Backend/app/domain/error/exception_handlers.py`
- `Backend/app/infra/core/config.py`
- `Backend/app/infra/repositories/postgres/email_change_repository.py`
- `Backend/app/infra/services/email_code_crypto.py`
- `Backend/app/infra/services/registration_limiter.py`
- `Backend/app/interface/controller/api.py`
- `Backend/app/interface/controller/email_change_controller.py`
- `Backend/app/interface/dependencies/email_change_dependencies.py`
- `Backend/app/interface/dto/email_change_dto.py`
- `Backend/app/interface/email_change_route.py`
- `Backend/app/interface/repository/email_change_repository_interface.py`
- `Backend/docs/validation/BE-016-email-change.md`
- `Backend/tests/integration/test_email_change.py`
- `Backend/tests/integration/test_email_change_http.py`
- `Backend/tests/unit/test_email_change.py`
- `Backend/tests/unit/test_email_codes.py`
- `docs/backlog.md`
