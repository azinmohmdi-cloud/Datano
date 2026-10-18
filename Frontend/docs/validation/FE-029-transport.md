# FE-029 — transport and real generated clients

Validated locally on **2026-10-18**. BE-009 and BE-010 were complete and the
initial working tree was clean. Scope is frontend transport, environment example,
Orval configuration, generated-client verification and focused test support.
No approved page, component, injector, styling, product data hook, backend source
or API contract was changed. FE-030 form/session routing and cache integration
remain separate. No staging, commit, push or branch change was performed.

## Outcome and acceptance

| Acceptance | Implemented and verified |
| --- | --- |
| Environment example matches code | `.env.example` now declares NEXT_PUBLIC_API_URL_V1; empty means browser origin. OPENAPI_JSON_URL is generation-only. No private key is public. |
| Orval consumes real OpenAPI | Both targets generated successfully from the normal running FastAPI app at `http://127.0.0.1:8019/openapi.json`, with real PostgreSQL/migrations. Its live schema matched the inspected FastAPI export. |
| Both mutators and envelope | Functions and React Query explicitly use Axios configurations, return the full envelope and preserve pagination/null payloads. Generated request/header/body/parameter and result types are checked. |
| Errors and cancellation | HTTP, application, malformed-protocol, network and configuration errors are distinguished. AbortSignal works before dispatch, while queued/bootstrapping, on active requests and through generated React Query query options. |
| Credentials and CSRF | Mutators include cookies, obtain fresh session-bound CSRF for unsafe operations and use the signed header. Real Chrome tests verify HttpOnly cookies, browser Origin, CSRF rotation, identity, denial, logout and re-login. |

## Implementation decisions

`customFetcher` and `fetcherHookAdapter` now accept AxiosRequestConfig plus optional
Axios request options. No product consumer used the previous URL/RequestInit
adapter. Orval 8's default React Query fetch output declared a response wrapper
containing data/status/headers, while the adapter returned the backend body. The
hook target now explicitly selects **httpClient: axios**, matching the function
target and the installed shared HTTP client. This also avoids separate fetch
header/body conversion rules. Generated code was regenerated, not hand-edited.

Successful JSON responses retain `{success,message,payload}` and pagination;
transport does not unwrap payload or return an Axios response. An HTTP failure
is rejected even if caller validateStatus accepts it. A 2xx `success:false` is an
application failure. Malformed envelopes and invalid bootstrap tokens are
protocol errors. Non-envelope FastAPI validation bodies remain available as raw
response bodies. ApiError exposes kind, status, backend code, response body and
Retry-After without carrying Axios request/config/cookies. Cancellation retains
Axios isCancel / ERR_CANCELED semantics but drops private request diagnostics.
Raw server bodies remain untrusted and require appropriate interpretation.

Both mutators enforce withCredentials=true and reject off-origin targets before
dispatch/bootstrap. The configured API origin can differ from the browser's
development port; the browser supplies Origin. No JWT, refresh loop, automatic
mutation replay, role inference, redirect or private query-cache operation was
added. AXIOS_INSTANCE remains a low-level export; generated methods/mutators are
the supported product-operation boundary.

Every unsafe operation obtains one fresh `/api/auth/csrf` response and sends its
43-character signed token as X-CSRF-Token. Bootstrap requests are serialized to
establish the initial nonce cookie without parallel bootstrap races; writes and
ordinary reads are not globally serialized. The token is local to that operation,
not retained in localStorage/sessionStorage, query keys or a transport cache.
This deliberately costs one extra GET per mutation, avoiding stale cached tokens
after HttpOnly session changes, logout/re-login or other-tab changes. There is no
automatic retry if a concurrent session change still causes 403. Callers control
their next action. Canceling one queued operation does not cancel another.

The browser integration harness is a separate temporary Next.js app outside the
product route tree. It imports the actual transport and generated modules.
Cross-port mode exercises CORS/credentials; empty-base mode uses a test-only
same-origin proxy preserving trailing slashes. Neither mode modifies product
ingress or UI. The tests cover the explicit local HTTP cookie exception; they
do not claim deployed HTTPS/proxy validation. Backend security configuration and
default Secure/HttpOnly/SameSite rules are unchanged.

## Generation and reproducibility

Runtime: **Node 24.19.0**, **pnpm 11.25.0**, **Orval 8.10.0**. The shell's default
Node 22.17.0 is below Orval's minimum; the existing compatible Node runtime was
selected through PATH, without installing or changing runtimes. Playwright is
the existing **1.62.1** runner and uses the installed Chrome channel. No runtime
or development dependency, lockfile, ESLint rule or TypeScript strictness changed.

The live schema has **14 paths / 22 operations**. Orval produced **31 TypeScript
files**, including functions, hooks and shared models under Git-ignored
`lib/api/v1/`. The reviewed export's SHA-256 is:

```text
618c3eb8d8f67261cabe24235332be9c416be917946b73edca5cbdadbdd25797
```

This fingerprints the formatted inspected export; the live JSON was compared
as parsed data rather than claiming identical HTTP whitespace. The generation
configuration retains the existing shared-output cleaning policy. No generated
file was force-added or manually patched. A fresh checkout must run generation
before type checking/build/transport tests; a trusted FastAPI export can also be
used for offline generation. See [README](../../README.md#api-generation-and-transport-fe-029).

Executed from Frontend with the compatible Node first in PATH:

```sh
OPENAPI_JSON_URL=http://127.0.0.1:8019/openapi.json pnpm api:generate
pnpm test:transport
DATANO_TRANSPORT_API_URL=http://127.0.0.1:8019 \
  PLAYWRIGHT_CHANNEL=chrome pnpm test:transport:integration
DATANO_TRANSPORT_API_URL=http://127.0.0.1:8019 \
  DATANO_TRANSPORT_SAME_ORIGIN=1 PLAYWRIGHT_CHANNEL=chrome pnpm test:transport:integration
PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e tests/e2e/login.spec.ts tests/e2e/signup.spec.ts tests/e2e/profile.spec.ts
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
```

## Actual results and TDD evidence

| Check | Actual result |
| --- | --- |
| Initial lint / direct TypeScript | Passed before changes; generated clients were initially absent |
| Initial build | Sandbox could not fetch existing Google fonts; permitted network retry passed without changing fonts or UI |
| Transport behavioral Red | **8 failed, 4 passed**, 3.1s: credentials and CSRF were absent; HTTP/application failures were not rejected |
| Generated return-type Red | TypeScript TS2739 reproduced the fetch-wrapper/body mismatch in the actual generated hook result |
| Initial focused Green | **12 passed**, 828ms; later **30 passed**, 831ms and **32 passed**, 1.2s |
| Cancellation privacy Red | **1 failed**, 29ms: canceled Axios error retained its private request config; regression preserved |
| Final transport suite | **33 passed**, 946ms; zero failed/skipped |
| Real API browser integration, explicit API origin | **4 passed**, 9.4s; both generated targets, lifecycle and abort |
| Real API browser integration, empty base / same origin | **4 passed**, 8.2s; both generated targets, lifecycle and abort |
| Existing login/signup/profile UI regressions | **44 passed**, 51.1s; mobile and desktop, unchanged test expectations |
| Final lint | Passed with generated code present; no suppressions/exclusions added |
| Final direct TypeScript | Passed, including generated models/functions/hooks and transport test consumers |
| Final production build | Passed with permitted font network access; product routes unchanged and temporary harness absent |
| Actual backend health | SELECT 1, PostgreSQL **17.11**, Alembic **0005_opaque_sessions**, live OpenAPI matched export |

Implementation-stage errors in Axios option/header merging and test-fixture
typing were caught and corrected; they are not counted as missing-feature Red.
Axios merges headers but takes URL/method/data from its second configuration;
the final implementation preserves all generated request fields while merging
caller headers. No unsafe type cast was used to bypass the header type errors.

The first browser header observer used filtered request.headers and missed
Origin; it now uses allHeaders with the same assertion. A later run encountered
a Chrome context-setup timeout before the test body while other validation jobs
were active. Final complete browser runs passed when browser jobs were run
sequentially; no retry, timeout increase or weakened assertion was introduced.
CLI NO_COLOR/FORCE_COLOR environment warnings were visible and not suppressed.

The 33 adapter tests cover both mutators, query/body/header preservation, signed
CSRF for all four unsafe methods, malformed/unavailable bootstrap, changed tokens,
HTTP 401/403/409/422/429/500, application/protocol/network failure, Retry-After,
off-origin rejection, active/queued/pre-dispatch cancellation, React Query signal
propagation and private diagnostics. These do not replace real HTTP checks.
The separate browser tests use normal backend registration and login with ordinary
User accounts, observe real cookies/Origin and assert 403/401 without auth bypass.
They also check empty readable cookies/browser storage and no legacy refresh call.

## Changed files

- [.env.example](../../.env.example), [orval.config.ts](../../orval.config.ts): aligned configuration and explicit Axios hook generation.
- [fetcher.ts](../../lib/fetcher.ts), [api-error.ts](../../lib/api-error.ts): shared session/CSRF transport and normalized public errors.
- [package.json](../../package.json), [adapter config](../../playwright.transport.config.ts), [integration config](../../playwright.transport.integration.config.ts): runnable checks using existing Playwright.
- [transport tests](../../tests/transport/transport.spec.ts), [browser tests](../../tests/transport/browser.spec.ts): focused acceptance and regression cases.
- [browser fixture](../../tests/transport/browser-page.tsx), [temporary harness server](../../tests/transport/serve-browser-harness.mjs): actual browser module loading outside product routes.
- [README](../../README.md), this report, and only the FE-029 checkbox in [backlog](../../../docs/backlog.md).

## Environment, privacy and limits

Only task-owned `datano-fe029-postgres` was created, on loopback **55435** with
tmpfs data, automatic removal and no volume mounts. The normal FastAPI server ran
on **8019**, migrated only its dedicated disposable datano_test database and used
`PUBLIC_ORIGIN=http://127.0.0.1:3139`, explicit local HTTP cookies and test-only
attempt limits. No serving startup/auth/middleware was bypassed. Private database
and CSRF secrets were outside the repository with restricted file permissions.

After final SQL/API health, only that API PID was stopped after checking its
command ownership, and only the task's temporary PostgreSQL container was stopped
and removed. The exact protected image remains:

```text
postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
```

Pre-existing volumes/networks were not mounted, modified or pruned. Playwright
owns and stops its temporary harness/UI servers. Generated clients remain locally
available and ignored. The source scan found no private database password or CSRF
key in the 12 initial changed/new files; **20 production bundles** contained
neither those secrets nor the harness marker. **218 backend log files** contained
neither those secrets nor the synthetic integration password. Transport itself
adds no console logging, and integration traces are off to avoid credential
capture. Final documentation, source scope, links and diff checks are recorded
before completion: **14 changed/new files**, **46 local links**, no staged files
and a clean `git diff --check`. Only FE-029's checkbox changed. The final Docker
inventory has no containers, the exact protected image, the same six pre-existing
volumes and bridge/host/none networks. No listeners remain on 8019/3139/3100.

No product page hookup, protected-cache clearing, trusted-role navigation,
production TLS/ingress, authenticated SSR, binary transport, full unrelated UI
suite or backend regression suite was added/run as part of this frontend-only
scope. Backend source/dependencies were unchanged; its real migrations/startup
and requested transport boundary were exercised. This report does not claim
complete production authentication or security certification. FE-030 remains
unchecked; no subsequent task was started.
