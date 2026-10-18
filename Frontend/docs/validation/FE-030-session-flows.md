# FE-030 — session flows and account routing

Date: 2026-10-18. Scope: FE-030 only. Dependencies FE-029, FE-010, FE-011,
BE-006 and BE-010 are checked in the Backlog and their current implementation
was inspected. No backend source, schema, lockfile, approved form UI, theme,
font, shared shell geometry or dependency changed. No Git mutation was performed.

## Resume audit

The interrupted working tree already contained the session data layer, account
resolver, login/logout/registration connections, strict return-route helper,
boundary states and integration test harnesses. FE-030 was still unchecked.
Eight data tests, six initial desktop browser tests and non-public real
registration had passed. The wider interrupted run had 50 passes, three login
regression failures and an overall timeout; it was not counted as a clean run.
Correct existing changes were retained rather than regenerated or replaced.

The three login failures exposed an extra session recheck after failed login,
real session fetching from UI Review's idle form, and a no-JS mobile test trying
to click a closed menu. The form controller is now shared without importing
authentication into private review; the product injector owns real auth. The
menu test performs the real native disclosure action. All affected assertions
remain covered, including the no-auth-effects review boundary. An interrupted
website navigation timeout passed unchanged in the clean full regression run.

## Implemented acceptance

| Criterion | Implementation / evidence |
| --- | --- |
| Real flow | Generated client, FE-029 credentialed/CSRF transport, exact passwords, active User registration, login then fresh `/me`, current server logout; real PostgreSQL/browser tests |
| Server role determines destination | `/account`: Guest → Login, User → Profile, Admin → Admin Users; only validated active `/me.effective_role` is used; contradictory input/login role and browser role flags cannot grant access |
| Allowed return destination | Single `returnTo`; exact `/profile` for active product roles, `/admin/users` for Admin; external/protocol-relative/backslash/encoded/query/fragment/whitespace/unknown/unauthorized targets rejected |
| Logout clears private cache | Cancel before/after server operation, clear query and mutation cache, anonymous state; late canceled query cannot repopulate cache; failed server logout preserves identity/data and allows retry |
| No wrong page while checking | Pending state on Login/Profile/Admin/Account; no early redirect or protected/form rendering; lookup error supports retry; inactive effective role has no protected content and can log out |

Public signup remains locked by `termsSelectable={false}`. The user explicitly
confirmed this decision both before and after interruption. No approved terms,
version, legal consent record, public bypass or invented legal text was created.
The non-public fixture checkbox is explicitly a test input outside the product
route tree. The actual controller/hook registers through the real API and checks
duplicate-email recovery without automatic login. EXT-002 and FE-048 remain open.

Account identity is mapped to a small validated presentation record; passwords,
CSRF tokens, roles arrays and login envelopes are not cached. `/me` 401 or a
changed account/effective role clears other private caches. Authentication
operations do not use React Query mutation variables to hold passwords. Private
UI Review fixtures stay independent from product authentication.

The approved UI is reused, including Persian/RTL forms, password visibility,
remember-me, shared header order, profile cards and inline logout confirmation.
Only operational pending/error/denied states and the Account link destination
change. A signed-in Admin sees unavailable aggregates rather than a misleading
Guest/login prompt; no counts or admin backend integration are fabricated.

## Validation record

Runtime: Node 24.19.0, pnpm 11.25.0, existing Playwright 1.62.1 and installed
Chrome. No dependencies installed. The bundled Node path was prepended to PATH.

| Check | Actual result |
| --- | --- |
| Initial behavior Red | Both account-role routing tests failed on the previous unresolved `/account`; four tests did not run after the configured maximum failures |
| Focused corrected mobile Login + Session | 14 passed, 19.9 s |
| Session data/return/cache tests | 8 passed; final run after presentation-message extraction: 648 ms |
| Existing FE-029 transport adapter tests | 33 passed, 1.2 s |
| Full affected UI regression | 136 passed, 3.1 min; mobile + desktop, login/signup/profile/admin/users/websites/header/UI Review |
| Non-public real registration | 1 passed, 12.4 s; actual controller, CSRF, 201/409, no auto-session/storage, error cleared after editing |
| Real product sessions | 4 passed, 15.8 s; mobile + desktop with actual User and server-provisioned Admin |
| `pnpm lint` | Passed, exit 0; no rule suppressions |
| `pnpm exec tsc --noEmit --incremental false` | Passed, exit 0 |
| `pnpm build` | Passed; compiled in 4.0 s, built-in TypeScript passed, 18 static outputs generated, `/account` included |
| Production bundle / route audit | 22 JS files checked; no private fixture credentials, secret values or harness markers; no UI Review production route |
| `git diff --check` | Passed; no backend/CSS/primitives/lockfile changes or staged files |

The real product suite verified invalid-password recovery, Admin/User destinations,
allowed Admin return to Profile, `/me` across reload, remember-me HttpOnly/Lax
cookie, User refusal of Admin route despite query flags, server logout, cleared
cookies, rejected replay of the revoked cookie, anonymous routing and public
signup remaining locked. Admin fixture credentials were random, private runner
variables, never public configuration or source. Browser traces were disabled
for real integration tests. Existing backend unit/integration suites were not
rerun: backend code/contracts did not change.

The test backend used only `datano_test_fe030` on a task-owned tmpfs container,
with the exact preserved image
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
`SELECT 1` passed and the migration revision was `0005_opaque_sessions`.
No pre-existing container/volume was mounted, modified or removed. The six
pre-existing volumes, protected image and default networks are preserved.

Earlier harness failures (missing external-module alias and a zero-size unstyled
checkbox) were test infrastructure issues, not API successes. The temporary test
app now resolves the existing alias; the test operates the actual checkbox label.
An initial mutation-cache test used a nonexistent `setState` API; it now seeds a
real completed mutation via `execute`. No rule/test suppression, retries or
increased timeout was used to conceal failures. Sandbox blocked the first local
server bind; tests were rerun with the requested execution permission. CLI
NO_COLOR/FORCE_COLOR warnings were not suppressed.

The first sandboxed production build could not download the existing Vazirmatn
and Geist Mono Google Fonts. The identical command passed with network execution
permission; font configuration/design was not changed. Final ESLint and direct
TypeScript checks also passed independently of the build's type check.

All five acceptance criteria are verified under the owner's explicit public
signup-lock decision. Only FE-030's Backlog checkbox is marked complete; EXT-002,
FE-048 and subsequent task statuses are unchanged. The task-owned Next.js servers,
backend process and auto-remove tmpfs PostgreSQL container were stopped after
validation. The initial Docker baseline had no containers; the protected image,
six pre-existing volumes and default networks remain. No global cleanup ran.

## Boundaries and remaining work

Name/email persistence, email proof/recovery, real website data/ownership and admin
aggregates remain in FE-031/032/033/034/046 and their backend dependencies. No
website deep link is considered authorized merely by login. Existing website
access placeholders are unchanged. The backend still enforces all resource
permissions; these client guards provide routing and display behavior only.

HTTP integration uses the backend's explicit local cookie exception. Production
HTTPS cookie behavior is not inferred from local tests; same-origin deployment
proxy/security configuration remains OPS work. With JavaScript disabled, auth
routes show the pending state and a short enabling instruction, with no credential
submission or inferred session. No authenticated SSR/prefetch is introduced.

Reproduction commands and fixture prerequisites are in the
[Frontend README](../../README.md#session-flows-and-account-routing-fe-030).
