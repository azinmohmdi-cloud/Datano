# BE-010 — logout and current-session revocation

Validated locally on **2026-10-18**, with Python **3.12.14**, PDM **2.29.2** and
real PostgreSQL **17.11**. BE-009 was checked off and the initial working tree
was clean. Scope is BE-010 only; no Frontend/UI, dependency, lockfile, migration,
session lifetime or unrelated auth behavior changed. No Git staging, commit,
push or branch change was performed.

## Outcome and acceptance

**POST /api/auth/logout** now revokes the current opaque cookie's session in
PostgreSQL and clears its session and CSRF cookies. Captured credentials return
401 on protected reads and writes after logout, including from a fresh app
instance. Other sessions for the same account and other users remain usable.

The existing LogoutUseCase is wired to SessionService rather than the retired
refresh-token repository. It reuses the existing digest-only revoke operation,
account/session lock order and request transaction; no second storage mechanism,
schema change or bulk logout is introduced. LogoutRequest hides its token from
repr. The controller handles cookie expiration and the response envelope.

| Acceptance | Evidence |
| --- | --- |
| Current session revoked server-side | Real SQL checks find revoked_at set on the captured digest; replay on `/me`, users, roles, permissions and a protected write returns 401. |
| Browser cookie cleared | Four real-login profiles cover normal/remember-me and HTTPS/explicit local HTTP. Both auth and nonce cookies expire with matching path/security attributes. |
| Reuse denied | Replay includes the original valid cookie and CSRF pair, and uses a new application instance; denial does not depend on the original client's cleared jar. |

## HTTP contract and security decisions

Send the current cookies, trusted **Origin** and matching **X-CSRF-Token** from
BE-009 bootstrap/login. No request body is required. Caller-supplied session/user
IDs or bulk flags in a body cannot select a revocation target. Bearer and legacy
refresh credentials do not select an opaque session or grant authentication.

HTTP **200** returns the existing envelope:

```json
{"success":true,"message":"Logged out successfully","payload":null}
```

Logout is idempotent. An absent, empty, malformed, unknown, expired or already
revoked session cookie gets the same successful cleanup response with valid
Origin/CSRF. Inactive accounts can log out without active-role permission.
This is anonymous credential cleanup, not acceptance of unusable credentials
for protected operations. Concurrent identical retries both succeed.

Origin/CSRF checks remain mandatory, including anonymous cleanup and retries.
Missing/foreign Origin or missing/forged token yields **403** without revocation
or Set-Cookie. The earlier JWT migration remains closed; legacy refresh still
returns **410 AUTH_MIGRATION_REQUIRED**. Only logout's temporary 410/deprecation
is replaced by the requested functional endpoint.

Successful responses use **Cache-Control: no-store** and expire:

- `__Host-datano_session` and `__Host-datano_csrf`: HttpOnly, Secure,
  SameSite=Lax, Path=/, no Domain, Max-Age=0 and an expired date.
- Explicit local HTTP: `datano_session_dev` and `datano_csrf_dev`, with the
  existing local policy and matching attributes instead of secure names.
- A presented historical `refresh_token`, using its original cookie attributes.
  This is browser cleanup; it does not restore old refresh authentication.

Revocation and transaction finalization precede a successful cookie-clearing
response in the installed FastAPI 0.115.6 request lifecycle. Injected domain
unavailability (503) and unexpected finalization failure (500), after the handler
prepared its cookie headers, both roll back the real SQL mutation and return
failure without Set-Cookie. The current credential remains usable; failures are
not swallowed or described as successful logout. A database/transport failure
must be resolved before claiming server logout succeeded. A network retry with
the captured original pair is safe.

After success, discard the in-memory CSRF token and bootstrap again before
another anonymous mutation/login. A fresh login creates a new valid session;
the old session remains rejected. FE-030 owns private query-cache clearing,
navigation and the approved logout UI hookup. No Frontend file or generated
client was modified, generated or built for this backend task.

Actual before/after OpenAPI comparison changes only **POST /api/auth/logout**:
it is no longer deprecated, documents 200/403/500/503, adds the typed null-payload
envelope schema `StandardResponse_NoneType_`, and retains required Origin/CSRF
headers. Cookie security explicitly permits an absent cookie for cleanup via
`[{"OpaqueSession":[]},{}]`. Existing paths, schemas and all other operations
are unchanged.

## Changed files

| Files | Purpose |
| --- | --- |
| [logout_use_case.py](../../app/application/use_cases/auth/logout_use_case.py), [models.py](../../app/application/use_cases/auth/models.py) | Idempotent current-session revocation and private input model |
| [auth_dependencies.py](../../app/interface/dependencies/auth_dependencies.py) | Existing logout provider now injects SessionService |
| [auth_controller.py](../../app/interface/controller/auth_controller.py) | Functional logout, typed response, cookie cleanup and API documentation |
| [session_cookie.py](../../app/interface/session_cookie.py), [csrf.py](../../app/interface/csrf.py) | Expire cookies using the same policies/names as issuance |
| [test_session_logout.py](../../tests/integration/test_session_logout.py) | Real PostgreSQL logout, replay, isolation, retry, failure and cookie profiles |
| [unit test_session_logout.py](../../tests/unit/test_session_logout.py) | Use-case input privacy, idempotency, target isolation and error propagation |
| [conftest.py](../../tests/conftest.py), [test_auth.py](../../tests/integration/test_auth.py) | Actual revoke behavior in the isolated fixture and its replay regression |
| [test_session_security.py](../../tests/integration/test_session_security.py) | Refresh remains retired; logout's new contract replaces the obsolete tombstone expectation |
| [README](../../README.md), this report | Current consumer sequence, behavior and actual validation |
| [backlog](../../../docs/backlog.md) | Only the BE-010 checkbox after verified acceptance |

## Executed validation and TDD

The private `/private/tmp/datano-be010/run-tests.py` wrapper supplies only the
dedicated test URL and private PDM cache/log paths, then executes the existing
`.tools/pdm/bin/pdm run pytest`. No dependency installation or resolution occurred.

| Check | Actual result |
| --- | --- |
| Complete baseline | **450 passed**, 49.27s |
| Logout HTTP Red | **13 failed, 4 passed**, 3.40s. Successful logout cases received the existing 410 instead of 200; existing CSRF rejection cases already passed. No fixture/import/setup failure was counted as Red. |
| Initial PostgreSQL Green, including rollback/concurrency | **19 passed**, 4.21s |
| Isolated fixture replay Red | **1 failed**, 0.54s: its unconfigured fake revoke left the captured session accepted with 200 after logout. |
| Affected security/auth/fixture/use-case Green | **88 passed**, 19.82s |
| Final complete suite with branch coverage | **476 passed**, 65.99s; **zero failures, errors, skips or warnings** |
| `pdm lock --check` | Passed; declarations and lockfile unchanged |
| `make lint PDM=.tools/pdm/bin/pdm` | Passed; only the existing main-module syntax check, not a full lint/type-check suite |
| OpenAPI before/after and representative HTTP responses | Passed; only logout operation changed, as detailed above |
| Final PostgreSQL health | `SELECT 1` succeeded, PostgreSQL **17.11**, zero leftover isolated schemas |

The final equivalent command ran after the last code/test change:

```sh
pdm run pytest --cov=app --cov=migrations --cov-branch \
  --cov-report=term:skip-covered \
  --cov-report=json:/private/tmp/datano-be010/coverage-final.json \
  --junitxml=/private/tmp/datano-be010/full-final.xml
```

There are **27 new cases**: 21 PostgreSQL/HTTP cases, five use-case units and one
isolated-fixture HTTP regression. One obsolete BE-009 logout-410 parameter case
is replaced by the functional logout coverage; the refresh-410 case remains.
This explains the net increase from 450 to 476. Production security checks are
not bypassed: adversarial/logout integration cases use plain FastAPI TestClient.
The fixture's revoke now removes only the matching digest from its per-test
records; real persistence is established separately against PostgreSQL.

Tests provision their own ordinary accounts, not a mutated seeded admin. They
use distinct disposable schemas, captured credentials and a barrier for concurrent
retries, without sleeps or order dependence. Existing BE-002 subprocess tests
still pass in both orders and after intentional child-test failure. The full
suite also reruns existing migration upgrade/downgrade, data preservation,
transaction, session lifetime and login/hash concurrency checks.

## Coverage and limits

Combined app/migration statement-and-branch coverage is **86.57%** (2758/3093
statements, 304/444 branches). LogoutUseCase covers **9/9 statements and 2/2
branches**. Session cookie helpers cover **29/29 statements**; CSRF helpers cover
all **59/59 statements**. Logout controller/provider statements and both legacy
cookie cleanup branches are exercised. Remaining controller gaps are unchanged
catalog error/policy expansion paths; dependency gaps are unmounted legacy
refresh/JWT helpers. Other baseline policy/catalog and defensive OpenAPI branches
remain untested. No coverage threshold/exclusion was changed.

No new migration is required: **0005_opaque_sessions** remains head. Production
data was not accessed or migrated. A fresh application instance is tested here;
there is no claim of a new standalone multi-process logout benchmark. Existing
session persistence/process tests still run in the full suite. An already-running
authorized operation is not retroactively canceled by logout. UI/browser journeys,
ingress/TLS validation, production load or ASVS certification are not established
by these local HTTP-client tests. Recovery/all-session revocation remains its
separate backlog task.

## Environment and final review

Only task-owned `datano-be010-postgres` was started on loopback **55434**, with
tmpfs storage, automatic removal and **no persistent volume mounts**. Its healthy
server used the protected existing image:

```text
postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
```

After final SQL health, only that temporary container was stopped and automatically
removed. The exact PostgreSQL image, six pre-existing data volumes and default
Docker networks are preserved; no volume data was mounted or cleaned. Private
test credentials were written outside the repository in a mode-0700 directory
with mode-0600 files and were not printed or copied into tracked content.

Source review covered all changed runtime code, tests and actual OpenAPI.
The initial scan of 12 code/test/README files found no private database credential;
all **214** application logs contained neither that credential nor the synthetic
logout password or CSRF key. HTTP tests additionally check raw session/nonce
absence from responses and logs. Final checks passed for all **14 changed/new
files**, **27 local links**, Python syntax and `git diff --check`; no files are
staged. Only BE-010's backlog checkbox changed. Final Docker inventory contains
no containers, the exact protected PostgreSQL image, the same six volumes and
bridge/host/none networks. Historical BE-009 validation remains unchanged as
evidence of the prior temporary contract.
