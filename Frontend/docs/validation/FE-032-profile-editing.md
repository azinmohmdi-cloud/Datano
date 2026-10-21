# FE-032 — connect profile and name editing

Date: 2026-10-22 (Asia/Tehran). Initial Git status was clean. Dependencies FE-013,
FE-030 and BE-015 were checked against Backlog and actual code. Shared/frontend
AGENTS, component cookbook, MVP/UX, approved profile UI, session/cache/transport
implementation and BE-015 DTO/controller were reviewed before editing.

## Acceptance / behavior

| Criterion | Evidence |
| --- | --- |
| Show real account and saved result | Existing verified `/auth/me` data supplies the account. Generated BE-015 PATCH sends only the two names and validates the returned active server identity. Summary, form and session consumers receive returned server names; the existing status slot announces success. Reset/reload use the saved names. No optimistic or simulated product save. |
| Failure preserves input | Local nonblank validation, server 422/403/503 and explicit retry are exercised. Errors show fixed Persian copy, retain draft names and keep the prior saved summary. Pending controls and synchronous ref prevent duplicate submits. Session expiry reconciles to anonymous and redirects, rather than retaining private account UI. |
| Cache stays coordinated | The existing `current-session` cache is updated from the verified save response; no duplicate profile query exists. Earlier reads are cancelled before publishing. Query identity plus owner checks reject late responses after logout/login, including the same user signing in again. Role changes reuse the existing private-cache cleanup. |

`DatanoProfile` injects the profile data action into the existing controller.
Data adaptation, API ownership checks and cache work live under
`data/feature/profile/`; the pure UI accepts presentation state/callbacks only.
The existing shared cache cleanup helper was exported for reuse, without changing
its session behavior. No backend source, schema, role policy, library dependency,
lockfile, page layout, stylesheet or public signup release lock changed.

### Request / state details

- Clients were regenerated with both existing Orval targets from current FastAPI
  `create_app(...).openapi()` (19 paths), including the actual BE-015 generated
  function `updateOwnProfileApiAuthMePatch` and `OwnProfileUpdate` strings.
  Ignored generated files were not hand-edited or staged.
- A fresh GET checks the cookie owner before PATCH without putting the session
  query into a loading state that would discard the form draft on ordinary error.
  A changed owner triggers existing session reconciliation before any PATCH.
- PATCH includes exactly `{first_name,last_name}`. No body ID, role, activation,
  email, username or password. Names retain exact Unicode/outer spaces. Existing
  transport attaches credentials and obtains a fresh session-bound CSRF token.
- Saved identity must parse successfully and belong to the expected owner. Only
  sanitized `SessionAccount` data enters the existing cache, never response
  envelopes, CSRF or mutation variables. Another account/query generation cannot
  be restored by an old save. Unrelated cache data survives name-only saves;
  server role changes clear other protected data using the shared helper.
- No automatic mutation retry. AbortSignal covers GET, CSRF and PATCH; unmount
  aborts the request and ignores obsolete results. A committed server write
  cannot be undone by client cancellation; the next read remains authoritative.
- Reset affects name drafts only; independent email drafts stay intact. The
  existing email flow remains unavailable until BE-016/FE-033. No SMTP provider,
  private allowlist, real mailbox, terms text or approved terms version was used.

### Design preservation

The approved card/field/button structure, CSS, spacing, account shell, typography,
responsive rules and keyboard order are preserved. Success uses the existing
live-status paragraph style/position; only its message can now report a verified
save. The summary updates its existing name text. Private review still has honest
unavailable mutations, isolated clocks/scenarios and no real API side effects.
The existing mobile/desktop profile review tests, including keyboard, themes,
text enlargement, no-JS and email/logout regression states, were retained.

## TDD / checks executed

- Initial browser attempt could not bind loopback (`EPERM`); rerun with permission
  reached the intended behavior. This environment failure is not a TDD Red.
- Red: new product save test failed with the old disconnected controller: account
  summary stayed «نام اولیه» after submitting, **1 failed, 11.3s**.
- Green: first product test and all existing profile review tests in both
  viewports: **20 passed, 34.4s**.
- Final data/cache tests: **13 passed, 1.1s**. Actual generated request shape,
  credentials/CSRF, exact names, safe errors, no retry, wrong owner, fresh owner
  change, replaced-query race (same/different owner), stale-read cancellation,
  early/in-flight abort, session expiry, role-change invalidation and mutation
  cache absence were executed.
- Existing session data tests: **8 passed, 797ms**.
- Existing transport tests: **33 passed, 1.2s**, including both generated mutators.
- Existing recovery data tests: **6 passed, 796ms**.
- Initial lint and TypeScript checks passed. Final checks, complete browser suite,
  real integration and build results are recorded below when complete.

Runtime uses the already installed bundled Node 24.19.0 runtime (supported by the locked
Next/Orval toolchain), pnpm 11.25.0, Orval 8.10.0, Playwright 1.62.1 and installed
Chrome. No dependencies or browsers were installed. The inherited NO_COLOR /
FORCE_COLOR warnings were not suppressed or reported as test failures.

## Real integration isolation

The task-owned `datano-fe032-validation` container uses tmpfs, a random loopback
port and private mode-0600 temporary settings in a dedicated `datano_test_fe032`
database. Current existing migrations are applied only there. The exact retained
PostgreSQL image is:
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
No old volume, project database or previous SMTP settings are used.

An untracked temporary backend launcher runs the real app with SMTP disabled,
explicit loopback HTTP cookie opt-in, origin `http://127.0.0.1:3100` and elevated
synthetic-test login/registration limits. Browser integration creates unique
`.test` accounts through the actual backend API, logs in through the product UI,
saves Unicode names, verifies them directly via API, exercises a real 422,
checks preserved drafts/reset, reload and unchanged cookie identity. It does not
unlock public signup. Trace/screenshot/video capture is disabled for this suite.

## Scope / limits

Frontend name editing is the only product behavior changed. Backend tests are
not rerun as a claim of backend changes; the actual unchanged backend is exercised
by the real browser integration. BE-016/FE-033 remain pending; existing session
security and signup terms release decision remain in force. No deployment, Git
Stage/Commit/Push or branch switch is performed. No standalone frontend coverage
percentage or CI run is claimed; tests/checks are reported by their real commands.


## Extended validation results

The first unfiltered browser run reached the existing config's 300-second global
limit: 183 passed, 313 not run, plus global timeout/teardown errors (the last
in-flight worker printed another completion during teardown). No individual test
failure was reported. This was not counted as a full pass. The final full run
uses `--global-timeout=1200000`, matching the size of the existing 484-case suite
plus the 12 new viewport cases; no test assertions, retries or global config were
weakened or changed. The larger invocation is documented in README.

Real API/PostgreSQL integration: **2 passed, 9.8s** (mobile and desktop), including
actual 200 save, direct GET verification, 422 rejection of invalid PostgreSQL text,
retained draft inputs, unchanged saved summary, reset/reload and unchanged opaque
cookie identity. Traces/screenshots/video were off. No SMTP was contacted.
The dedicated database returned `SELECT 1`, PostgreSQL **17.11**, head
**0008_admin_grants**. Backend source and existing migration files are unchanged.

Final lint and direct TypeScript (`--incremental false`) checks passed after all
code/test additions, with no suppressions or rule changes. Build, final browser
run, visual/scope/security checks and cleanup are recorded below.


Production build: `NEXT_PUBLIC_API_URL_V1= pnpm build` **passed** with the existing
fonts and same-origin API mode; compiled in 3.3s, built-in TypeScript completed in
4.9s and 18 static outputs were generated. No private UI Review route is present.
An isolated local production-server smoke check used controlled synthetic API
responses (not the PostgreSQL integration). Mobile 390×844 and desktop 1440×900
both saved through the generated client, displayed the returned name and live
success status, had no horizontal overflow, and returned 404 for
`/ui-review/profile`. Screenshots were inspected locally; existing card/layout,
fields, typography, colors and controls are preserved. The production server was
stopped after this check.

Production JS scan before restarting development: **23 files** checked; new test
identities, raw error fixtures and the private profile review mailbox marker were
absent. This is a scoped marker scan, not a claim of exhaustive vulnerability
assessment or scanning unknown external credentials.


After real integration, a read-only database check confirmed exactly two
synthetic accounts, both retaining the saved Unicode names and zero Admin
grants. The task backend was stopped by matching its exact private launcher
path; the task tmpfs container was stopped/removed. Final Docker inspection
confirmed its absence, the unchanged exact PostgreSQL image and all six original
volume names. No other container/image/volume/network was removed.


## Final outcome

**FE-032 is complete.** All three acceptance criteria are verified; only FE-032's
Backlog checkbox changes. The full final browser invocation completed with
**496 passed (13.0m)**, exit 0, zero failed/skipped/flaky cases and no retries.
The earlier global-timeout run remains recorded above and is not presented as a
pass. No existing browser test was changed or weakened to obtain this result.

| Final check | Actual result |
| --- | --- |
| `OPENAPI_JSON_URL=/private/tmp/datano-fe032/openapi.json pnpm api:generate` | Both targets passed; actual current FastAPI schema, 19 paths; ignored output only |
| `pnpm test:profile` | 13 passed, 1.1s |
| `pnpm test:session` | 8 passed, 797ms |
| `pnpm test:transport` | 33 passed, 1.2s |
| `pnpm test:recovery` | 6 passed, 796ms |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:profile:integration` with the dedicated private runner | 2 passed, 9.8s, real Backend/PostgreSQL, mobile/desktop |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --global-timeout=1200000` | 496 passed, 13.0m; complete unfiltered browser suite, mobile/desktop |
| `pnpm lint` | Passed, exit 0 |
| `pnpm exec tsc --noEmit --incremental false` | Passed, exit 0 |
| `NEXT_PUBLIC_API_URL_V1= pnpm build` | Passed; production output and built-in TypeScript successful |
| Production smoke + visual review | Both viewports passed, screenshots inspected; controlled API responses, no overflow, review route 404 |
| Production JS marker scan | 23 files passed before restarting development |
| `git diff --check` | Passed |

Node 24.19.0 was selected by prepending its installed bundled bin directory to
PATH for pnpm commands. No package install, dependency/lockfile update or test
runner replacement was needed. The only inherited console warnings were the
existing NO_COLOR/FORCE_COLOR mismatch; they were not suppressed.

Final scope: no Backend source/schema, CSS, page/layout, Next configuration,
public environment template, lockfile or private settings changed. The private
backend, tmpfs PostgreSQL and production-smoke server were stopped; Playwright
owned/stopped its development servers. The exact PostgreSQL image and all six
previous volumes remain. All source changes are unstaged; no Stage, Commit, Push
or branch change occurred. Generated clients and runtime/test artifacts remain
ignored. BE-016/FE-033 are pending; public signup remains locked for approved terms.
No acceptance item remains unverified within FE-032 scope.

## Changed files

17 repository paths: 8 modified tracked files and 9 new files.

- `Frontend/README.md`
- `Frontend/components/feature/identity/ProfilePage/DatanoProfile.tsx`
- `Frontend/components/feature/identity/ProfilePage/ProfileController.tsx`
- `Frontend/components/feature/identity/ProfilePage/content.ts`
- `Frontend/components/feature/identity/ProfilePage/errors.ts`
- `Frontend/components/feature/identity/ProfilePage/index.tsx`
- `Frontend/data/feature/profile/profile.ts`
- `Frontend/data/feature/profile/useProfileActions.ts`
- `Frontend/data/feature/session/session.ts`
- `Frontend/docs/validation/FE-032-profile-editing.md`
- `Frontend/package.json`
- `Frontend/playwright.profile.config.ts`
- `Frontend/playwright.profile.integration.config.ts`
- `Frontend/tests/e2e/profile-product.spec.ts`
- `Frontend/tests/profile/product.browser.spec.ts`
- `Frontend/tests/profile/profile.spec.ts`
- `docs/backlog.md`
