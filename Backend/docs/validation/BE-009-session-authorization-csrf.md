# BE-009 — session authorization and CSRF

Validated locally on **2026-10-18**, using Python **3.12.14**, PDM **2.29.2**
and real PostgreSQL **17.11**. BE-008 was complete and the initial working tree
was clean. Scope is BE-009 only; BE-010 logout is not implemented. No Frontend,
generated client, page design, dependency, lockfile or migration was changed.
No Git staging, commit, push or branch mutation was performed.

## Acceptance and implementation

| Acceptance | Result and evidence |
| --- | --- |
| Mutations require trusted Origin and CSRF token | A global ASGI boundary checks every unsafe `/api` request before routing, body parsing, quota consumption or mutation. Positive CRUD requests succeed; missing, foreign, malformed, duplicate and cross-session pairs return 403. |
| Inactive roles do not grant permissions | Every protected route resolves the PostgreSQL opaque session, reloads account and assigned role records, then aggregates permissions from active roles only. Tests deactivate a Super_User role and remove an ordinary role's permission while the same session remains open; access changes immediately. |
| Explicit, tested JWT migration | No protected HTTP route accepts Bearer credentials. Login issues only the opaque cookie and public identity/CSRF JSON. Legacy refresh/logout endpoints return 410 after CSRF checks. Existing opaque sessions survive a new app instance; JWT-only clients must authenticate again. |
| Old tokens cannot bypass product controls | Correctly signed JWTs fail on identity/users/roles/permissions, including writes with a legitimate anonymous CSRF pair. JWTs placed in the session cookie fail. Revoked/invalid sessions cannot fall back to JWT. |

Existing repository contracts, UUID permission identifiers, Super_User permission
semantics, DTO envelopes, pagination, collection slashes and CRUD status codes
are preserved. An inactive account returns 401; a valid session lacking required
permissions returns 403. The current effective product role still comes from
BE-008's server-side identity resolver. Historical JWT/refresh utilities remain
available as unmounted code; they are not an HTTP authentication authority.

The implementation reuses BE-007/008 session resolution, digest-only storage,
live identity resolution, transaction ownership, login rotation and ordered
account locking. It retains the read-only first password verification and the
locked second verification/hash upgrade. The concurrent bcrypt/account-switch
regression, rollback, lifetime, restart and migration checks still pass.

## CSRF protocol and configuration

The full consumer sequence and setup examples are in
[README](../../README.md#session-authorization-csrf-and-jwt-cutover-be-009).

- Required `PUBLIC_ORIGIN` is a single HTTPS origin, without path/query/fragment
  or credentials. Default ports/host case normalize consistently. Null, duplicate,
  foreign, suffix-confusable, wrong-scheme/port and URL-shaped origins are denied.
  The trusted value is not inferred from Host or forwarded headers.
- Required `CSRF_SECRET_KEY` is a separate private secret of at least 32 UTF-8
  bytes, represented as SecretStr. It has no serving default and does not reuse
  the historical JWT key. All workers must share the key and origin. Missing
  configuration prevents serving startup; offline schema export remains possible.
- `GET /api/auth/csrf` returns the standard envelope with `payload.csrf_token`.
  It sets/reuses a random 256-bit nonce in `__Host-datano_csrf`, with HttpOnly,
  Secure, SameSite=Lax, Path=/, no Domain and no persistence attributes. It does
  not create an authenticated session. If Origin is supplied, it must be trusted.
- The header token is base64url HMAC-SHA256 over a versioned message containing
  the fixed-length digest of the current opaque cookie (zero binding before
  login) and the nonce. It is not the cookie value or raw session identifier.
  Format checks, duplicate-header rejection and constant-time comparison apply.
- Every unsafe `/api` request, including anonymous login/registration and retired
  legacy endpoints, requires both Origin and `X-CSRF-Token` plus the corresponding
  cookies. Failure yields `403 CSRF_FAILED` with no-store. GET/HEAD/OPTIONS remain
  safe, and preflight is handled by the outer CORS middleware.
- Successful login rotates the nonce and session together and returns the new
  `payload.csrf_token`; the old header cannot authorize the new session.
  Bootstrap/login responses carrying tokens use no-store and Cookie/Origin Vary.
  A valid bootstrap nonce is reused, avoiding needless parallel bootstrap races.
- CORS allows credentials only for configured PUBLIC_ORIGIN, allows
  Content-Type/X-CSRF-Token and exposes Retry-After. The explicit local HTTP
  exception requires loopback plus `SESSION_ALLOW_INSECURE_LOCAL_HTTP=true` and
  uses `datano_csrf_dev` / `datano_session_dev` instead of secure prefixed cookies.
- A signing-key change invalidates CSRF tokens; bootstrap can recover without
  revoking persisted opaque sessions. Consistent key deployment is required.

The signed, session-bound construction follows OWASP's
[CSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
CSRF tokens do not replace permission checks, protect against same-origin XSS,
or constitute a full production security certification.

## Breaking API transition and consumer impact

Login payload is now exactly `{user, effective_role, csrf_token}`. Temporary
BE-008 JWT fields `title`, `token`, `type`, `expires_at` are removed. Login no
longer creates JWT/refresh credentials and expires an old refresh cookie when
present. All protected operations document only `OpaqueSession` cookie security;
the HTTPBearer scheme is absent. Each unsafe operation documents required Origin
and X-CSRF-Token headers and its 403 boundary.

JWT-only clients must log in with credentials and adopt bootstrap/cookie/header
handling. There is deliberately no JWT-to-session exchange. Existing BE-007/008
opaque sessions retain their validity and lifetimes and can bootstrap CSRF.
Deploy backend and consumers together. This is a deliberate breaking transition
owned by BE-009, rather than an indefinite legacy-token bypass.

`POST /api/auth/refresh` and the old `POST /api/auth/logout` are deprecated
tombstones: **410 AUTH_MIGRATION_REQUIRED** with valid Origin/CSRF, **403** without
them. Neither endpoint issues credentials or revokes opaque sessions. The actual
opaque logout/revocation/cookie-clearing flow remains **BE-010**.

Actual before/after OpenAPI comparison found one new path (`/api/auth/csrf`), no
removed paths, and 20 changed operations for session security, mutation headers
or migration responses. The only changed existing data schema is `SessionLogin`;
user/role/request/pagination DTO schemas are unchanged. FE-029/030 own the real
transport/auth hookup. No generated client, Frontend build or browser UI journey
was run in this backend-only task.

## Executed validation

Private `/private/tmp/datano-be009/run-tests.py` reads only the dedicated test
database URL, sets private PDM cache/log paths and forwards arguments to
`.tools/pdm/bin/pdm run pytest`. No dependency was installed or resolved.

| Check | Actual result |
| --- | --- |
| Complete initial baseline | **378 passed**, 41.35s |
| Initial behavioral Red | **8 failed, 6 passed**, 2.59s: JWT remained accepted, bootstrap was absent, and unguarded registration mutated state. A permission fixture needed correction before its CSRF/positive authorization cases were valid evidence. |
| Corrected authorization Red | **5 failed**, 1.27s: four signed JWT GETs returned 200 instead of 401, while a real Super_User opaque session returned 401 instead of 200. |
| Initial focused Green | **14 passed**, 2.69s |
| Migrated auth/password/registration/login regressions | **98 passed**, 17.15s |
| First full suite with coverage | **392 passed**, 53.16s |
| Strict Origin syntax Red | **3 failed, 21 passed**, 0.35s: empty query/fragment markers and empty explicit port were accepted instead of rejected. |
| Expanded security/service Green | **64 passed**, 6.18s; then **70 passed**, 6.87s |
| Final complete suite with branch coverage | **450 passed**, 60.79s; **zero failures, errors, skips or warnings** |
| `pdm lock --check` | Passed; manifests and lockfile unchanged |
| `make lint PDM=.tools/pdm/bin/pdm` | Passed; only the existing main-module syntax check, not a full linter/type check |
| Actual OpenAPI/HTTP checks | Passed, including cookie profiles, headers, cache/CORS, duplicate headers, proxy root path, malformed bodies, quota ordering, permission changes and migration responses |
| PostgreSQL final health | `SELECT 1` succeeded, server **17.11**, zero leftover isolated test schemas |

An early Green collection error came from the stale TokenResponse re-export
after removing JWT issuance from login. Its import was corrected; this is not
counted as behavioral Red evidence. The initial permission fixture correction
also is not presented as a security fix. The final suite collects all cases.

The final equivalent command, run after the last code/test changes, was:

```sh
pdm run pytest --cov=app --cov=migrations --cov-branch \
  --cov-report=term:skip-covered \
  --cov-report=json:/private/tmp/datano-be009/coverage-final.json \
  --junitxml=/private/tmp/datano-be009/full-final.xml
```

There are **72 new cases**: 48 real-PostgreSQL/HTTP security cases and 24 pure
CSRF/configuration cases. Existing tests now authenticate with opaque cookies.
Their BrowserClient helper performs the real bootstrap and supplies valid
cookie/header pairs; it bypasses no middleware or production dependency.
Adversarial tests use plain FastAPI TestClient and explicitly construct requests.
BE-002's subprocess tests still exercise both orders and failure teardown, now
checking opaque-session state and cookie independence rather than retired refresh
credentials. Product persistence/security tests use disposable PostgreSQL schemas.

## Coverage review and practical limits

Combined statement/branch coverage for app and migrations is **86.27%**
(2742/3084 statements and 300/442 branches). No threshold or exclusion was relaxed.
The CSRF service covers **66/66 statements and 16/16 branches**. Middleware and
schema documentation cover **57/57 statements, 20/22 branches**; the remaining
branches are defensive OpenAPI paths for non-API operations/already-present
header parameters, not untested mutation bypasses. Active-role permission checks
have their decision branches exercised. Uncovered auth dependency code is the
retained unmounted legacy factories/cookie helper. Other gaps include pre-existing
catalog error/policy branches and login's defensive identity-ID mismatch guard.
Coverage is local correctness evidence, not a load test or deployment audit.

The real suite replays migrations through revision **0005_opaque_sessions**,
including downgrade/upgrade and constraint/preservation cases. No new schema is
needed. Production data was not migrated. SQLAlchemy transaction ownership and
session digest/lifetime policies are unchanged. TLS ingress, trusted proxy
configuration, browser integration, admin proof, logout and recovery retain their
own tasks. Tests use HTTP clients, not a browser enforcing every browser policy.

## Resource and source review

Only `datano-be009-postgres` was created for this task, on loopback port 55433
with tmpfs data, automatic removal and no persistent volume mount. It was healthy
on the exact protected image:

```text
postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
```

After all tests and final SQL health, only that task-owned container was stopped
and automatically removed. Final container inventory is empty. The PostgreSQL
image remains; networks remain bridge/host/none. These six pre-existing data
volumes were preserved without mounting, modifying or deleting them:

```text
3d8a155ce945a08146799f61dd77e6853f7225f025de92bea45b8c5f252aed9d
13c19106591c7067ee43923a462f550bd6e61781f21a730f7b52511737fab311
47b9543e9bb1387801ea9b1b44cac609d46a1d792ee911b47f86f2a021b2d9df
59e29537e4149a8de9788bea9e797e5b51977ede5f413dced9a8a816974ae2d5
99648db12e38ceff23fda1d31e7451b5a1b12a628c6fd136966d3bed8f6fbc87
backend_mongodb-data
```

Source review covers the new CSRF service/boundary, configuration/lifespan/CORS,
login output/use case, shared authorization dependency, migration tombstones,
test helper and all migrated regressions. README and environment examples now
describe the current contract. The historical BE-008 validation report remains
unchanged as evidence of that intermediate state. Only BE-009 is checked off in
the product backlog after successful validation.

Private database credentials were absent from all changed files. All 198 local
application log files were checked for the private database password, synthetic
security password and CSRF key; none were present. Direct tests also check raw
session/nonce/header-token absence from application logs. Synthetic CSRF keys
exist only in test setup; deployment secrets are not supplied or generated into
tracked files. Final checks passed for all **27 changed/new files**, **14 local
document links**, Python syntax and `git diff --check`. The staged-file list is
empty; no Frontend or migration/manifest diff is present.
