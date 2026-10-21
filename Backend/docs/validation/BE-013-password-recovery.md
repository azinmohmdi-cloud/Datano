# BE-013 — password recovery and reset

Date: 2026-10-21. Initial Git status was clean. BE-012 and BE-010 are checked;
their email-code and session-revocation contracts, approved MVP/UX decisions and
existing email/password/auth interfaces were inspected before editing.

**BE-013 is complete at the backend acceptance scope.** Only its Backlog
checkbox changes. Frontend, approved page design and other task implementations
remain unchanged. No Stage, Commit, Push or branch switch was performed.

## Acceptance

| Criterion | Evidence |
| --- | --- |
| Identical known/unknown email response | Request returns the same `200` status, envelope/body, no-store policy and no account-specific cookies for known, unknown, inactive and cooldown cases. Mail failure has the same acknowledgement. Missing mail/key configuration returns the same `503` for all emails. An ASGI test proves response body delivery precedes any account lookup/SMTP work. |
| Restricted recovery authorization | Successful BE-012 proof issues a separate random 256-bit, digest-only, short-lived HttpOnly cookie. It only authorizes reset. Normal sessions, legacy JWTs and raw email codes cannot replace it; the recovery token cannot access normal authenticated APIs. Absolute expiry, one current grant/account, replay and account-state changes are tested. |
| Password change revokes all sessions | PostgreSQL user-before-grant/session locking; password hash update, deletion of account recovery grants and existing `SQLSessionRepository.revoke_all` share one transaction. Normal and remember-me sessions are rejected afterwards; another account's sessions survive. Injected failure after revocation rolls back hash, grants and sessions together. Actual login/reset concurrency confirms an in-flight old-password login rolls back instead of minting a surviving session. |
| No automatic login | Verify returns only CSRF/lifetime metadata plus the recovery cookie. Reset returns null payload and clears recovery/session/CSRF/retired-refresh cookies; `/auth/me` remains unauthorized until normal login. Old password fails, new password succeeds. |

The existing email-key trim/lowercase, exact 15–128-character Unicode password
policy, Argon2id hashing, opaque sessions and Origin/CSRF controls are reused.
No role, user activation, username requirement or ordinary session lifetime
policy changes. Verification consumes an eight-digit HMAC proof through BE-012;
five-attempt and 60-second account-context limits remain durable. Each request,
verify and reset also uses a separate durable recovery peer quota before body
parsing. Forwarding headers are not trusted as peer identity.

## Contract / implementation

- `POST /api/auth/password-recovery/request`: `{email}`, generic acknowledgement.
- `POST /api/auth/password-recovery/verify`: `{email, code}`, restricted cookie
  and `{expires_in, csrf_token}` payload. No code, account identity or raw grant
  is returned in JSON.
- `POST /api/auth/password-recovery/reset`: `{password, password_confirmation}`,
  restricted cookie required; no body-selected user/token/role fields accepted.

All mutation paths retain required Origin/CSRF headers. Credential validation
diagnostics strip input values even for missing/extra fields. Secure recovery
cookie: `__Host-datano_recovery`, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain;
the existing explicit localhost HTTP opt-in uses `datano_recovery_dev`. Default
grant life is 600 seconds, configurable only between 1 and 600 seconds. Grant
tokens have a `recovery.` prefix and separate digest domain, making them invalid
as normal 43-character opaque-session identifiers. OpenAPI uses `PasswordRecovery`
only on reset; existing product routes still require only `OpaqueSession`.

`RECOVERY_IP_LIMIT=10`, `RECOVERY_WINDOW_SECONDS=600` and
`RECOVERY_MAX_BODY_BYTES=8192` are configurable technical defaults. All three
steps share that recovery-only peer bucket, separate from login/registration.
Account cooldown/guess budgets come from BE-012. These are not product quotas.

The request response is sent before a Starlette in-process background task
queries the account and invokes the existing code/email services. Background
exceptions are observable as a static operation and exception class; provider
text, mailbox, code and credentials are not logged. This is not a durable queue:
process termination can lose an acknowledged request, and acknowledgement never
proves delivery. The ASGI ordering test is not a deployment-wide timing guarantee
across arbitrary buffering proxies or transports.

Proof scopes/grants bind to a one-way fingerprint of account ID, canonical email
and the existing salted hash. A password/email change or inactive account makes
old proof unusable. A legitimate hash-format upgrade may also require requesting
a fresh code. No duplicate password hash is stored in the new table. Successful
reset invalidates outstanding old-state codes by changing that fingerprint.
Code consumption and grant creation are separate committed operations: if grant
storage fails, proof remains consumed and the user requests a fresh code. This
fails closed. Reset itself is atomic and rechecks the grant after hashing.

## Changed files

- [Application services/models/ports](../../app/application/use_cases/auth/password_recovery.py)
- [Recovery repository contract](../../app/interface/repository/recovery_repository_interface.py)
- [PostgreSQL adapter](../../app/infra/repositories/postgres/recovery_repository.py)
- [Recovery token service](../../app/infra/services/recovery_token_service.py)
- [Controller](../../app/interface/controller/recovery_controller.py) and [router assembly](../../app/interface/controller/api.py)
- [Dependencies](../../app/interface/dependencies/recovery_dependencies.py), [DTOs](../../app/interface/dto/recovery_dto.py), [cookie adaptation](../../app/interface/recovery_cookie.py), [bounded route guard](../../app/interface/recovery_route.py)
- [Private/configurable settings](../../app/infra/core/config.py), [example](../../.env.example), [existing limiter namespace](../../app/infra/services/registration_limiter.py)
- [ORM table](../../app/infra/database/models.py), [migration](../../migrations/versions/0007_password_recovery.py), [startup schema probe](../../app/main.py)
- [Validation redaction paths](../../app/domain/error/exception_handlers.py)
- [Unit services](../../tests/unit/test_password_recovery.py), [settings/cookie tests](../../tests/unit/test_recovery_settings.py), [PostgreSQL tests](../../tests/integration/test_password_recovery.py), [HTTP tests](../../tests/integration/test_recovery_http.py)
- [Existing BE-012 migration test](../../tests/integration/test_email_codes.py): pins its characterized revision 0006 instead of moving head; preservation assertions retained
- [Existing session OpenAPI regression](../../tests/integration/test_session_security.py): explicitly allows reset-only `PasswordRecovery`, forbids it on other endpoints and preserves all ordinary-session/write-header assertions
- [README](../../README.md), this report and [BE-013 checkbox](../../../docs/backlog.md)

## TDD / checks executed

1. Initial token/reset unit tests failed with behavioral `NotImplementedError`.
   The implementation made both pass (0.42 s).
2. PostgreSQL reset/migration tests failed on unimplemented repository behavior
   and the absent recovery table, then all four combined tests passed (0.81 s).
3. The request HTTP test failed with `404` before the route existed. Its Green
   run plus the initial service/storage tests passed: five tests in 1.00 s.
4. Negative rollback testing exposed a retained raw driver exception context;
   moving SQL error translation outside the yielding transaction boundary
   removed that context. Thirty-eight core/migration tests passed (3.52 s).
   HTTP fixture defects (multiple lifespan owners for one app) and an incorrect
   expected validation status were corrected without changing production behavior;
   independent app instances and the existing `422` contract are now used.
5. The new startup probe test first failed with `DID NOT RAISE`, then the recovery
   table probe made old schemas fail safely with `run alembic upgrade head`.
6. The first full suite had 684 passes and one old OpenAPI assertion failure
   because it permitted only a single security scheme. The stricter per-route
   recovery/product security assertion replaced that outdated assumption. The
   final full suite below passes after all code/test edits.

Python **3.12.14**, existing PDM environment, no added packages or lockfile change.
Commands ran from `Backend/` through `.tools/pdm/bin/pdm`. A private external
wrapper supplied `DATANO_TEST_DATABASE_URL` internally; no connection credential
was placed in command arguments or this report.

```sh
pdm run pytest --cov=app.application.use_cases.auth.password_recovery \
  --cov=app.infra.repositories.postgres.recovery_repository \
  --cov=app.infra.services.recovery_token_service \
  --cov=app.interface.dependencies.recovery_dependencies \
  --cov=app.interface.controller.recovery_controller \
  --cov=app.interface.dto.recovery_dto \
  --cov=app.interface.recovery_cookie --cov=app.interface.recovery_route \
  --cov-report=term-missing
pdm lock --check
pdm run python -m compileall -q app migrations tests/unit/test_password_recovery.py \
  tests/unit/test_recovery_settings.py tests/integration/test_password_recovery.py \
  tests/integration/test_recovery_http.py
git diff --check
```

| Final check | Actual result |
| --- | --- |
| Complete backend suite | **691 passed in 88.97 s**, including **76 BE-013 tests** and 615 previous tests; 0 failures, errors or skips |
| Scoped statement coverage | **270/276, 97.83%**; token service, controller, dependencies, DTOs, cookie and route guard 100%; remaining six statements are two abstract port guards and four defensive repository guards (injected naive clock, invalid internal digest/TTL, CAS failure while the account lock is held) |
| PostgreSQL / migration | **17.11**, `SELECT 1`, revision **0007_password_recovery**; fresh upgrade, 0006→0007 replay/downgrade/re-upgrade, constraints, FK/ORM metadata alignment and populated identity/session preservation tested |
| Auth / concurrency | Absolute grant expiry, replay, latest-grant replacement, eight concurrent resets, actual old-password login/reset race, rollback after revocation, independent database pool, account-state invalidation and other-account session isolation passed |
| HTTP / security | Generic request response equality, ASGI response-before-lookup ordering, CSRF-before-guards, shared peer quota/body cap, malformed-body redaction, Unicode policy, reset after SMTP disablement, retired credential rejection and no automatic login passed |
| Startup / OpenAPI | SMTP-disabled and synthetic SMTP-enabled startup, ping and cleanup passed; no SMTP constructor invoked; **17** paths (14 existing + 3 recovery); no SMTP/HMAC-key schema fields or arbitrary SMTP debug/send endpoint |
| Lock / syntax | Lock check, compileall and diff check passed; full backend lint/type-check tooling is not configured and is not claimed |
| Secrecy audit | **249** Backend/docs files, **298** application log files and **4** final validation artifacts checked; zero actual SMTP App Password/raw or checked encoded-form hits; zero selected fixture credential/code/provider/driver markers in application logs; existing private SMTP file remains ignored, untracked, regular and mode **0600** |
| Scope / Git | Only listed BE-013 files and its checkbox changed; no Frontend, other status, dependency, staged file, commit, push or branch change |

The private wrappers, XML, coverage, logs, `health.json` and `security.json` are
under `/private/tmp/datano-be013/`, outside the repository. Synthetic fixture
codes/passwords appearing in test IDs/artifacts are intentional; no real mailbox
code, user password or deployment HMAC key was used. The existing App Password
is read only in memory for comparison and never displayed.

The task-owned tmpfs PostgreSQL container used a new `datano_test_be013` database
and exact protected BE-003 image:
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
It was stopped/automatically removed after tests. All six pre-existing volumes
and that image are intact; no pre-existing volume was mounted. No non-test
database was migrated, and no real account password was changed.

## Remaining deployment / task boundaries

All BE-013 backend acceptance criteria are verified. No new real recovery email
was sent: the API flow used a capture sender with real PostgreSQL, and transport
delivery evidence remains the explicitly owner-confirmed BE-011 send. The serving
process still needs private SMTP settings and `EMAIL_CODE_HMAC_KEY`; the BE-011
CLI's private file is not automatically loaded by the app. Runtime/browser/live
delivery integration must not be claimed until separately configured and tested.
FE-031, admin proof, email change, durable workers and deployment validation were
not started. Frontend build/client generation were not run because frontend
changes are excluded and these new routes are for the subsequent authorized task.

References: [approved MVP](../../../docs/Datano_MVP.md),
[OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
The 600-second grant cap and configurable peer defaults are technical choices
for this bounded flow; they are not asserted as numeric OWASP requirements or
a claim of complete production security certification.
