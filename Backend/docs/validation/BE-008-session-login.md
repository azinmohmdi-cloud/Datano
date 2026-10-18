# BE-008 — email login and current session identity

Validated locally on **2026-10-18**. BE-007 is complete; the initial working tree
was clean. Scope is email/password login, secure opaque cookie issuance/rotation
and current public identity. Frontend files/design, generated clients and other
backlog tasks are unchanged. No dependency or migration was added.

## Outcome and acceptance

| Acceptance | Implemented and verified |
| --- | --- |
| Valid email login sets a secure cookie | The existing login route reuses canonical email lookup and exact password verification. It issues `__Host-datano_session` with Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain. Normal cookies have no Max-Age/Expires; remember-me cookies use the issued absolute lifetime, default 30 days. |
| Session ID changes on login | Every success generates a fresh random identifier through BE-007. The previous browser session is revoked in the same transaction, including account switches. Unknown caller-chosen identifiers cannot fix the new session. Failed authentication emits no cookie; a failure after rotation rolls back insertion and revocation. |
| Public identity and effective role come from the server | Login adds public user data and `effective_role`; `/me` validates the opaque session, reloads the account and assigned role records, and returns current public fields plus the effective role. Active Admin takes precedence over active User. Inactive/deleted/custom roles cannot invent either role; no active product role yields null. |
| Invalid login/inactive accounts are denied | Wrong/unknown credentials, inactive accounts and account/password changes during authentication yield 401 without issuing a committed session. Current-session access rejects inactive/deleted accounts, expiry, revocation and malformed/unknown credentials. A bad cookie never falls back to an otherwise valid bearer. |

No email, header or browser role chooses Admin. Existing trusted server-side role
assignments are read; administrator allowlisting/email proof/provisioning remains
BE-014. Public DTO mapping excludes password hashes and canonical keys. The raw
opaque identifier is only in Set-Cookie, never a JSON field. Its digest alone is
stored in PostgreSQL. Successful login and `/me` carry `Cache-Control: no-store`.

## API contract and explicit intermediate compatibility

The existing paths and envelope are retained:

- `POST /api/auth/login`: accepts `email`, `password` and optional strict boolean
  `remember_me=false`. Exactly one email or deprecated username is required.
  Unknown fields, including caller-selected roles and activation, return 422;
  string/numeric remember-me coercion is rejected. Existing Unicode, canonical
  email, Argon2id and compatible bcrypt/recovery rules are reused.
- Success keeps the old `payload.title`, `token`, `type` and `expires_at`, and adds
  `payload.user` (the existing public User DTO) and `payload.effective_role`
  (`Admin`, `User` or null). `token` is marked deprecated in the new schema.
- `GET /api/auth/me`: retains its public User fields and adds `effective_role`.
  Its primary credential is the opaque cookie. It touches inactivity only for a
  valid session, then reads current activation/profile/roles from persistence.
- An absent cookie can still use the existing bearer path in this **explicit
  intermediate phase**. A present empty, malformed, unknown, expired or revoked
  cookie returns 401 even when a valid bearer is supplied. A bearer for another
  account cannot override a valid cookie's identity.

BE-009 explicitly owns the final JWT migration, general session permission checks
and Origin/CSRF-token enforcement. This task preserves existing bearer consumers
rather than silently breaking all protected routes. `/auth/refresh`, permission
checks and the old logout behavior remain in place for that transition. The
legacy refresh cookie now follows the same Secure/local policy and has no
Max-Age without remember-me; its server-side expiry remains the legacy configured
lifetime. It is still process-local and is not the new session authority.

The existing `/auth/logout` does **not** yet revoke the new opaque session; that
public flow is BE-010. No global JWT bypass closure, CSRF protection, recovery,
email service or administrator proof is claimed here. This is not a complete
production authentication rollout. The frontend login remains its approved UI
with explicit unavailable submission; FE-029/030 will connect credentials,
CSRF/envelopes and role-based navigation after their prerequisites. No generated
client, build or browser integration check was run across that boundary.

## Cookie profiles and local development

The server remains authoritative for BE-007's exact inactivity/absolute limits:

| Profile | Browser cookie | Idle expiry | Absolute cap |
| --- | --- | --- | --- |
| Normal | Session cookie, no Max-Age or Expires | 30 minutes | 12 hours |
| Remember-me | Persistent, Max-Age 2592000 seconds by default | 7 days | 30 days |

Max-Age comes from the issued record's lifetime rather than a later configuration
read. Cookie retention cannot extend server validity; activity never changes the
original absolute cap. Browser closure is not evidence of server revocation.

HTTPS is the default even for development. The new
`SESSION_ALLOW_INSECURE_LOCAL_HTTP=false` setting must be explicitly enabled for
HTTP URLs hosted at `localhost`, `127.0.0.1` or `::1`. That case uses the separate
`datano_session_dev` name with HttpOnly/SameSite=Lax/Path=/ and no Domain. HTTPS
and non-local URLs retain the secure prefixed cookie even with the flag enabled.
Tests verify that an HTTP client does not send the default Secure cookie, while
the explicit local exception permits current-session access. Do not enable the
exception on a deployment or treat an untrusted proxy Host/scheme as a local
environment. The approved deployment target remains one HTTPS browser/API origin;
production CORS/proxy setup was not invented here.

## Atomic rotation, locking and hash migration

`SessionService.issue(..., previous_token=...)` reuses the token/digest/policy
implementation from BE-007. Its new repository `rotate` operation locks all
involved account rows in stable ID order, then delegates to the existing create
and revoke operations. It flushes without committing. Session issuance, prior
revocation and any verified hash upgrade share the existing HTTP transaction.
An injected failure after both rotation writes returns 500 without Set-Cookie;
the previous session remains usable and no new row persists.

A real PostgreSQL Red test found an additional lock-order problem: legacy bcrypt
upgrade could acquire the target account's compare-and-swap lock **before** the
ordered rotation locks. Two concurrent cross-account logins then deadlocked,
returning **500/200**. Login now first verifies credentials without hash writes,
acquires the ordered account locks through session issuance, reloads activation
and roles, then verifies again and performs the existing compatible hash upgrade
under those locks. Both requests now succeed and both hashes become Argon2id.
The default behavior of `AuthenticateUserUseCase.execute` is unchanged for other
callers; `upgrade_hash=False` is an explicit read-only phase used by login.

The second verification deliberately handles password/account changes during
the lock wait. Real tests cover deactivation, deletion, changed passwords and a
same-secret rehash; only the valid same-secret case succeeds. Opposite account
switches also succeed concurrently. The database remains the authoritative
clock and transaction owner. Tests use event barriers and independent sessions,
not sleeps, exception retries or deadlock suppression. This is correctness
evidence, not a throughput/load benchmark; verification under the account lock
requires short request transactions and no external I/O.

## Login abuse controls and unchanged schema

The existing PostgreSQL counter/credential-body guard is reused with a separate
`login` namespace, preserving registration keys/defaults. The historical table
name `registration_attempts` is retained; records still contain only a peer
digest, window timestamps and count. No schema expansion is needed: revision
**0005_opaque_sessions** remains head and the existing migration suite passes.

| New technical setting | Default |
| --- | --- |
| `LOGIN_IP_LIMIT` | 10 attempts per peer/window |
| `LOGIN_WINDOW_SECONDS` | 600 seconds |
| `LOGIN_MAX_BODY_BYTES` | 8192 bytes for the entire body |

The values are configurable positive technical defaults, not MVP-prescribed
numbers or account/product quotas. The quota is consumed before JSON parsing
and password work in a separate short transaction. Invalid/malformed/oversized
attempts and account rollback cannot refund it. All workers share PostgreSQL
state; it survives a new app lifetime and resets at the fixed-window boundary.
429 includes Retry-After; fixed/chunked oversized bodies return 413. Counter
failure yields sanitized 503 and cannot authenticate. Application code uses the
connection peer rather than caller-provided forwarding headers. Registration
and login quotas are independent; registration behavior remains tested unchanged.

Fixed-window/NAT/distributed-peer limitations remain as documented in BE-006.
There is no per-account lockout, CAPTCHA, Redis service, bot defense, login CSRF
token or deployment ingress control added by this task.

## Executed validation

Environment: **Python 3.12.14**, **PDM 2.29.2**, **PostgreSQL 17.11**. No package
or lockfile change. Commands ran from `Backend/` using the private
`/private/tmp/datano-be008/run-tests.py` wrapper, which loads only a dedicated
`datano_test` URL and forwards arguments to `.tools/pdm/bin/pdm run pytest`.

| Check | Actual result |
| --- | --- |
| Complete baseline before implementation | **333 passed**, 30.54s |
| Initial cookie/identity Red | **12 failed, 4 passed**, 3.48s; expected missing behavior, zero setup/import errors |
| Login quota Red | **1 failed**, 0.89s; attempt 11 incorrectly returned 200 |
| Login/identity/registration/password affected Green | **100 passed**, 10.67s |
| Normal legacy-cookie persistence Red | **1 failed**, 0.60s; compatibility cookie incorrectly retained Max-Age without remember-me |
| First complete suite with branch coverage | **350 passed**, 41.03s |
| Expanded login/current identity Green | **39 passed**, 8.63s, then **44 passed**, 8.89s with concurrency/unit cases |
| Concurrent bcrypt upgrade/account switch Red | **1 failed**, 1.86s; real PostgreSQL DeadlockDetected produced 500/200 |
| Race fix and password/auth regressions Green | **70 passed**, 12.67s |
| Final complete suite with branch coverage | **378 passed**, 49.39s; **0 failures, errors or skips**, no warnings |
| `pdm lock --check` | Passed; dependency declarations/lockfile unchanged |
| `make lint PDM=.tools/pdm/bin/pdm` | Passed; only its existing main-module syntax check |
| OpenAPI before/after comparison | Only login and `/me` operations changed; only existing schema `UserLogin` changed; four new response/envelope schemas and `OpaqueSession` security scheme added |
| PostgreSQL final health | `SELECT 1` succeeded, version **17.11**, zero remaining test schemas |
| Secret checks | 25 changed files and 28 recent app logs scanned; no private database credential, and no fixture password in logs; raw cookie absence checked directly during normal/remember-me HTTP tests |
| Source/diff and local documentation links | Reviewed; `git diff --check` and link checks passed |

An early Green attempt exposed a DTO import cycle and then an unresolved inherited
Role annotation. Moving the new response models to `session_dto.py` and explicitly
importing Role fixed them. Those collection/runtime failures are **not** counted
as behavioral Red evidence. All final tests collect and run normally.

The final equivalent command was:

```sh
pdm run pytest --cov=app --cov=migrations --cov-branch \
  --cov-report=term-missing \
  --cov-report=json:/private/tmp/datano-be008/coverage-final.json \
  --junitxml=/private/tmp/datano-be008/full-final.xml
```

The **45 new cases** comprise 43 PostgreSQL/HTTP integration cases and two current-
identity unit cases. Existing real migrations, transaction/constraint tests,
bcrypt/Unicode compatibility, process restarts, bearer CRUD authorization and
fixture/cookie isolation remain passing. Legacy in-memory characterization
fixtures explicitly override the new repository/limiter and clear their state;
they are not evidence of production session persistence. The real serving app
retains its PostgreSQL requirement and no fallback was added.

Final combined statement/branch coverage is **85.80%**: 2650/2988 statements and
281/428 branch exits. Authentication, current identity, session service, SQL
session repository, session DTOs and cookie helper have **100%** coverage. Login
orchestration is **94.29%**, with the defensive inconsistent-adapter user-ID
branch unexecuted; the login guard is **93.55%**, missing its no-database custom-
lifespan branch. Shared limiter/guard defensive constructor, naive-clock and
malformed Content-Length gaps remain, along with existing unrelated code gaps.
No exclusion, warning filter, threshold or assertion was weakened. Coverage does
not establish complete security or ASVS compliance. No new full lint/type-checker
or CI workflow was introduced.

## Environment and remaining scope

The task-owned `datano-be008-postgres` container used loopback port 55433,
`--rm`, and tmpfs database storage with the exact preserved image:

`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`

After final tests, PostgreSQL was healthy and no test schema remained. That
container alone was stopped and automatically removed; final `docker ps -a` is
empty. The exact image, all six previously preserved volumes, and the bridge,
host and none networks remain. No legacy volume was mounted, modified or deleted;
no image or network was deleted. No application/database server is left running
by this task, and no production/application database was migrated.

Only BE-008's checkbox is marked complete. BE-009/010 and other tasks remain
unchecked/unstarted. No Frontend or approved UI change, stage, commit, branch
change, push or deployment was performed.

## Changed files

- [Credential verification](../../app/application/use_cases/auth/authenticate_use_case.py),
  [login orchestration](../../app/application/use_cases/auth/login_use_case.py),
  [auth request/result models](../../app/application/use_cases/auth/models.py),
  [current identity](../../app/application/use_cases/auth/current_identity_use_case.py),
  [session service](../../app/application/use_cases/auth/session_service.py).
- [Session port](../../app/interface/repository/session_repository_interface.py),
  [SQL session adapter](../../app/infra/repositories/postgres/session_repository.py).
- [Controller](../../app/interface/controller/auth_controller.py),
  [auth dependencies](../../app/interface/dependencies/auth_dependencies.py),
  [login input](../../app/interface/dto/auth_dto.py),
  [session responses](../../app/interface/dto/session_dto.py),
  [cookie boundary](../../app/interface/session_cookie.py).
- [Login guard](../../app/interface/login_route.py),
  [reused body guard](../../app/interface/registration_route.py),
  [namespaced counter](../../app/infra/services/registration_limiter.py),
  [error messages](../../app/domain/error/exceptions.py),
  [settings](../../app/infra/core/config.py), [environment template](../../.env.example).
- [Real HTTP/storage tests](../../tests/integration/test_session_login.py),
  [identity units](../../tests/unit/test_current_identity.py),
  [isolated legacy fixtures](../../tests/conftest.py),
  [updated additive response assertion](../../tests/integration/test_email_password_http.py).
- [README](../../README.md), this report and the
  [BE-008 backlog checkbox](../../../docs/backlog.md).

## References

[The approved MVP](../../../docs/Datano_MVP.md) and
[UX identity/routing requirements](../../../docs/datano-ux-pages-.md) determine
the product policy. Cookie flags and server-session handling were checked against
[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
and [browser Set-Cookie documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie),
with concrete behavior verified against the installed Starlette/HTTPX stack.
