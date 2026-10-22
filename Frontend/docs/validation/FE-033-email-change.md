# FE-033 — email-change workflow connection

Date: 2026-10-22. Scope: connect the approved profile's existing email forms to
BE-016. Dependencies FE-032 and BE-016 were checked complete. Initial Git status
was clean. No backend, schema, dependency, lockfile, public environment, CSS,
page/layout or private SMTP setting changed. Public signup remains release-locked
pending approved terms; no terms text/version was invented.

## Acceptance evidence

| Criterion | Implemented behavior and executed evidence |
| --- | --- |
| Request works | Actual generated Orval function POSTs only canonical `{email}` with credentials and fresh session-bound CSRF. A generic acknowledgement advances to the existing code form without replacing current email or claiming delivery. Browser/API tests exercise this. |
| Confirmation works | POST sends `{email,code}`; ASCII/Persian/Arabic digits and leading zero are supported. The returned public owner and destination are validated, current email updates only after success, drafts clear and a live Persian result appears. Real Backend/PostgreSQL tests verify persistence, reload and login at the final address. |
| Errors work | Fixed Persian errors cover invalid/expired proof, `403`, `409`, `422`, `429`, service/network failures. Invalid proof retains code/name drafts while a valid session remains mounted. Expired session clears private data; a canonical conflict returns to the editable target. No automatic POST retry. |
| Role/session reflected in navigation | Successful proof publishes only server effective role and sanitized identity, cancels stale session reads and clears other private cache for every rotation. Real tests show User→Admin→User, fresh cookie, old-cookie `401`, `/account` routing, Admin-route denial after downgrade and logout/login with new email. Client role flags never select authority. |

All criteria passed. Only FE-033's Backlog checkbox changes; no Epic/other task
status changes and no next task is started.

## Implementation and state boundaries

The current FastAPI OpenAPI was exported without connecting to a database or
SMTP. It contains **21 paths**. Both Orval 8.10.0 targets were generated from it;
generated output stays Git-ignored and was not hand-edited. The shared transport
already bootstraps current CSRF and sends credentialed requests; no transport or
session core rewrite was needed.

`data/feature/profile/email-change.ts` implements request/verify behind the
existing profile hook. A fresh GET checks the cookie owner before sending either
mutation. Query-instance and owner/email guards reject obsolete results after a
replacement login, account change or query reset. Verification validates the
expected user/destination and authoritative outer `effective_role`, cancels old
identity reads and clears every other protected query/mutation before caching
the public `SessionAccount`. Same-role email changes clear protected data too,
since BE-016 rotates the session regardless of role. Raw envelopes, CSRF, codes
and draft mutation variables never enter caches or browser storage.

A proof `401` is not assumed to be session expiry. Private identity reconciliation
does not set the observed session query loading, so recoverable errors keep the
form/code/name drafts. Actual session expiry clears private data and lets the
existing boundary redirect to login. Network/protocol errors also attempt a fresh
identity read; an actually changed server identity can update the summary without
replaying a mutation or inventing a successful result. If reconciliation is
offline, the original failure remains and a later read is authoritative.

The controller keeps presentation state in memory, blocks duplicate submissions
synchronously and forwards AbortSignal through GET/CSRF/POST. Unmount aborts and
ignores obsolete results. Cancellation cannot undo an already committed backend
change. Success clears email/code and returns to request while keeping the
independent name draft. Profile remains available to User and Admin to display
the result; `/account` and protected routes check fresh authoritative identity.

Wall-clock deadlines give approximate 600-second code expiry, 60-second resend
and at most five rejected attempts observed in this form. They do not claim to be
backend counters or delivery confirmation. Server limits remain authoritative
across tabs/accounts/targets. Cooldown survives target editing, Retry-After is
honored, expiration/exhaustion blocks local confirmation and accepted resend
clears the old code. Generic request acknowledgement deliberately does not reveal
availability, dispatch success or a server-side cooldown.

The pure UI retains all existing fields, controls, class names, layout and review
scenarios. Its sole rendering addition is optional success text in the existing
pending status paragraph's position/style. Private review continues to send no
mail or identity mutation. The old profile-product scenario's unavailable-email
assertion was updated only for the newly authorized real request behavior; its
name validation/reset and unchanged-account assertions remain.

## TDD and executed checks

Initial Red: the new product browser scenario failed because the code field did
not exist after requesting confirmation (**1 failed, 11.3s**). This was the
expected disconnected workflow, not a setup/import failure. Green: new workflow
plus existing desktop profile review **10 passed, 19.6s**. Expanded email/name
browser cases then passed **30/30, 36.8s**, both viewports.

Runtime: existing bundled **Node 24.19.0**, **pnpm 11.25.0**, **Orval 8.10.0**,
**Playwright 1.62.1**, installed Chrome. No packages/browsers were installed.

| Final command/check | Actual result |
| --- | --- |
| `OPENAPI_JSON_URL=/private/tmp/datano-fe033/openapi.json pnpm api:generate` | Both targets succeeded; actual FastAPI schema, 21 paths; ignored output only |
| `pnpm test:profile` | **36 passed, 957ms**: 23 new email adapter/cache cases plus 13 existing names cases |
| `pnpm test:session` | **8 passed, 833ms** |
| `pnpm test:transport` | **33 passed, 1.3s**, both mutators |
| `pnpm test:recovery` | **6 passed, 808ms** |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e email-change.spec.ts profile-product.spec.ts profile.spec.ts session.spec.ts login.spec.ts signup.spec.ts recovery.spec.ts recovery-product.spec.ts --global-timeout=600000` | **122 passed, 2.5m**, mobile/desktop; no failures/skips/flaky cases/retries |
| Dedicated runner: `pnpm test:email-change:integration` | **4 passed, 18.1s**, real Backend/PostgreSQL, mobile/desktop |
| `pnpm lint` | Passed, exit 0 |
| `pnpm exec tsc --noEmit --incremental false` | Passed, exit 0 |
| `NEXT_PUBLIC_API_URL_V1= pnpm build` | Final network-enabled execution passed; compiled 3.1s, built-in TypeScript 5.1s, 18 static outputs |
| Production smoke/visual review | Both viewports passed request/code/result; screenshots inspected; no horizontal overflow; private review returned `404` |
| Scoped production marker scan | 23 JS files passed; synthetic test/error/review markers absent |
| `git diff --check` and final scope review | Passed |

The first sandboxed production build failed fetching the existing Geist Mono and
Vazirmatn resources from Google Fonts. It is not counted as a pass. The authorized
network-enabled rerun succeeded without changing fonts, code or dependencies.
Inherited NO_COLOR/FORCE_COLOR warnings were not suppressed. No broad unfiltered
analytics/site browser suite or backend pytest rerun is claimed: the affected
identity/profile regression range and real unchanged backend were exercised.
No coverage percentage or CI execution is claimed.

Adapter tests cover canonical request/CSRF/cancellation, no optimistic email,
server Admin/User/null role, cache clearing, malformed/wrong-owner/destination
responses, valid-session proof `401`, expired session, preflight owner switch,
late results with same/different owner replacement, cancelled stale reads,
network reconciliation, safe errors and no retry. Browser cases add focus,
leading zero, retained drafts, five rejected attempts, expiry/resend, cross-target
cooldown, `403/409/422/429/503`, pending duplicate prevention and navigation.

## Real integration isolation and limits

`datano-fe033-validation` used only task-owned tmpfs and random loopback publication
with the exact retained image:
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
Private launch/runner scripts and mode-0600 temporary settings are under
`/private/tmp/datano-fe033`, outside the repository in a private directory.
Only this dedicated `datano_test_fe033` database was migrated.

The test lifespan injected a private captured email adapter with SMTP disabled.
Actual random BE-012 codes went through its normal HMAC/delivery-gating flow and
were read only from a local test capture, never a public API endpoint. All
accounts/mailboxes are `.test` fixtures. The role test allowlist is private fixture
configuration; it is not a real provider/deployment setting. Six synthetic users
were created and final Admin grant count was zero after downgrade scenarios.
Real invalid proof (`401`), concurrent canonical claim (`409`), successful persisted
change, role navigation and cookie rotation/revocation were executed through the
real API. Test traces/screenshots/video were disabled for this suite.

**No external SMTP email was authorized or sent.** Existing private Gmail settings
were not read or changed; Inbox delivery is not asserted here. BE-011's historical
delivery validation is unchanged. Controlled browser/production visual checks
use synthetic API responses and are distinguished from the real DB integration.

Final database checks: `SELECT 1` succeeded, PostgreSQL **17.11**, migration head
**0008_admin_grants**, zero leftover generated schemas. The task backend and
production smoke server were stopped by matching their launcher or port/cwd.
Playwright stopped its own development servers. The task tmpfs container was
stopped/removed; the exact PostgreSQL image and original six volumes are retained.
No project/non-test data or existing volume was mounted or modified.

## Changed files and Git

17 paths: 11 modified tracked files and six new files. All changes are unstaged;
staged diff is empty. No Stage, Commit, Push, branch switch, deployment or backend
source change occurred. No acceptance item remains unverified within FE-033.

- `Frontend/README.md`
- `Frontend/components/feature/identity/ProfilePage/DatanoProfile.tsx`
- `Frontend/components/feature/identity/ProfilePage/ProfileController.tsx`
- `Frontend/components/feature/identity/ProfilePage/content.ts`
- `Frontend/components/feature/identity/ProfilePage/errors.ts`
- `Frontend/components/feature/identity/ProfilePage/index.tsx`
- `Frontend/data/feature/profile/email-change.ts`
- `Frontend/data/feature/profile/useProfileActions.ts`
- `Frontend/package.json`
- `Frontend/playwright.profile.config.ts`
- `Frontend/playwright.email-change.integration.config.ts`
- `Frontend/tests/e2e/email-change.spec.ts`
- `Frontend/tests/e2e/profile-product.spec.ts`
- `Frontend/tests/profile/email-change.spec.ts`
- `Frontend/tests/profile/email-change.browser.spec.ts`
- `Frontend/docs/validation/FE-033-email-change.md`
- `docs/backlog.md`
