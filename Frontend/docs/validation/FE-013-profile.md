# FE-013 — profile and account-editing UI

Validated 2026-10-12. Scope: FE-013 only. FE-005 is checked. Shared/frontend
guides, product/MVP/UX, Epic 03, cookbook, Design System, existing account shell
and auth/review components were inspected. The user's prior no-Git restriction
was preserved: no Git command was run. A filesystem/hash snapshot of 268 files
was saved before changes to preserve existing work and audit this task's scope.

## Outcome and architecture

The approved `/profile` route composes `ProfilePage/DatanoProfile.tsx` through a
new pathless `(account)` group that reuses the existing AccountLayout inside
ProductLayout. It currently presents an honest access state and Login link;
trusted account/session data and real access routing remain FE-030/FE-032.
The route never imports private fixtures or accepts a query-supplied identity.
The existing `/account` destination/routing was not revised in this UI task.

The full profile is independently reviewable at `/ui-review/profile`. The client
controller maps local presentation records, validation, draft state, focus and
private timers into pure UI. `heading.tsx` is shared with the access state.
Names/email validation and translations remain sibling modules. Existing
Recovery helpers format the duration and normalize code digits without modifying
Recovery. No data hook, endpoint, backend contract or dependency was invented.

| Acceptance | Delivered and verified |
| --- | --- |
| Account information | Supplied account name/current email in a compact summary card; private deterministic data only |
| Edit names | Given/family-name fields, Persian validation, first-invalid focus, dirty-state action and names-only reset |
| Change email | New-address request and separately reviewable eight-digit-code stage, errors, expiry/cooldown/resend/attempt limit |
| Logout | Inline confirmation, keyboard focus, cancellation and pending/error review; no real session effect |
| No role/activation changes | No username, role or activation control or inference from UI/query/storage |
| Approved identity/backdrop | Existing logo/shell/Vazirmatn/Lucide/primitives with restrained blue/lavender gradient |
| No fabricated success | Valid save, email verification and logout report unavailability; account summary remains unchanged |

Names require non-whitespace content without an invented length limit. Edits
remain drafts; errors preserve values, and reset restores only names. Current
account data never changes on a sample save. Email validation uses native type
validity and the MVP trim/lowercase comparison against current email; no dot/plus
provider-specific canonicalization is applied. The entered value is preserved.
Current email remains visible and unchanged until future real ownership proof.

Code format requires exactly eight digits, preserving a leading zero. Persian/
Arabic decimal digits become ASCII; other input is retained for validation,
without silent truncation. The private fixture models 600-second expiry,
60-second resend cooldown and five invalid attempts. Resend clears the old code
and resets counters, explicitly stating that no email was sent. Editing the new
address clears its obsolete sample code. Back/next between email stages preserves
the current drafts; valid-format verification still ends with unavailability.

Logout opens an inline confirmation group and focuses its confirmation button.
Cancel restores focus to the trigger; confirmation reports actual unavailability,
without clearing fields/account data, redirecting, clearing cookies or inventing
a successful session revocation. No API request, cookie/token or browser-storage
write is implemented. Native POST semantics and pre-hydration disabling prevent
native form submission before the handlers are ready.

## Private review and design

`/ui-review/profile?emailStep=request|code&state=ready` selects either email stage
independently. Other initial states are `loading`, `error`, `names-pending`,
`names-error`, `email-pending`, `email-error`, `code-error`, `expired`,
`resend-ready`, `logout-confirm`, `logout-pending`, `logout-error`. Unknown/repeated
selectors fall back to request/ready. Changing the initial scenario remounts its
fixture, disclosed in the notice; changing the email stage retains drafts.
Reload reconstructs the selected initial state. No role selector is provided.
Private review requires JavaScript; without it, the Suspense loading fallback
remains visible and exposes no actionable forms. Public Login works without JS.

AccountLayout's 1024px outer cap is retained. At lg, a 256px account summary/logout
column sits beside the flexible names/email column; below lg they stack in RTL
DOM reading order. The page uses a compact UserRound heading, rounded-2xl Cards,
restrained brand borders/shadow-sm, shared 48px minimum controls and existing
Field label/error associations. No hero, chart, avatar upload or site dashboard
was added. Site/account routing and site information remain their own tasks.

The user's FE-013 gradient request supersedes the earlier flat-blue profile
proposal in the Design System. The new `main:has(.page-surface-profile)` selector
reuses established icy-blue/lavender auth tokens and their dark adaptation. It
does not change AccountLayout globally, previous selectors, the shared logo,
header/footer, public/auth pages, primitives, provider or future dashboard policy.

Validation message slots reserve minimal responsive space below controls so blur
feedback does not move the action beneath a pointer. Slots are minimum heights,
not clipping limits; longer/enlarged text can grow. Form/confirmation focus uses
a primitive `useId` root identifier and effects, avoiding ref reads during render.

Desktop 1440px, mobile 390px, narrow 320px dark and production 1440px screenshots
were manually inspected. Automated checks cover 320/390/768/1440px, both themes,
200% text, mixed-direction email/code, overflow, shared landmarks and a 420px
reduced-height viewport. Reduced-height scrolling is an emulation check, not
physical-device keyboard or assistive-technology certification.

## Red, corrections and executed checks

The initial focused desktop public test failed for the expected missing route:
`/profile` returned 404 instead of 200. After implementation it passes. Baseline
lint and direct TypeScript checks passed before edits.

The first focused suite passed 13/18. Name/email blur errors moved buttons during
pointer clicks, preventing submission/focus in three executions. Responsive
message reservations fixed this actual UI issue; the original click, validation
and focus assertions remain. Two no-JavaScript review assertions incorrectly
expected an actionable form in the private Suspense fallback. They now verify the
actual loading fallback/no visible controls, then test native public Login. No
test, lint/type rule, retry policy or diagnostic was suppressed.

Commands ran from `Frontend/` with Node 24.19.0, pnpm 11.25.0:

```sh
export PATH="/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

| Command/check | Result |
| --- | --- |
| Baseline `pnpm lint` and `pnpm exec tsc --noEmit --incremental false` | Passed before implementation |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-013.config.ts profile.spec.ts --project desktop` before implementation | Expected failure: 404 |
| Same temporary config with `profile.spec.ts` on both projects | 18/18 passed after corrections, 25.2s |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-013.config.ts` | 96/96 passed on final source, 1.9m; zero failures/retries/skips |
| Final `pnpm lint` | Passed, exit 0 |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed; `/profile` static, private reviews absent |
| `pnpm exec tsc --noEmit --incremental false` after final build | Passed, exit 0 |
| `node /private/tmp/datano-fe-013-production.cjs` | Passed: fixture isolation, 21 HTTP/RSC checks, public access/query isolation, gradient and no-JS at 390/1440px |
| `python3 /private/tmp/datano-fe-013-audit.py` | Passed: scoped files, preservation, whitespace/local references and FE-013-only Backlog change; no Git used |

Nine new tests execute on both projects (18 executions), alongside all 78 previous
cases. Coverage includes query isolation, absence of role/activation controls,
blank/whitespace names, linked errors/focus, draft retention/reset, unchanged
summary, empty/invalid/same-case-insensitive email, plus-tag preservation, stage
retention/focus, seven/nine/non-digit code rejection, both localized digit sets,
leading zero, controlled timers/resend, five invalid attempts, inline logout
cancel/error focus, fixed/reloaded loading/pending/error states, no requests or
storage/session effects, responsive themes/text and public no-JS navigation.

The temporary config spreads the real repo configuration, preserving both test
projects, explicit Chrome channel, locale/timezone, one worker and zero retries.
It reuses the existing opted-in port-3000 dev server, avoiding its checkout lock
without changing/stopping it. Reports/screenshots live under
`/private/tmp/datano-fe-013-tests` and `/private/tmp/datano-fe-013-report`.
No repository test configuration or prior test was edited.

Production checks scan manifest/static JS for private profile and prior auth
fixture markers. With `UI_REVIEW_ENABLED=1`, seven product routes return 200 and
seven private route/query variants return 404 for both HTTP and RSC (21 checks).
Browser contexts verify the public access state despite role/preview query flags,
one account shell, gradient, no sample account, API request, cookie/storage change,
overflow or page error, and working Login with/without JS. The owned production
server/browser on port 3008 were stopped afterward.

## Changed files

Paths are relative to the workspace root:

1. `Frontend/app/(product)/(account)/layout.tsx`
2. `Frontend/app/(product)/(account)/profile/page.tsx`
3. `Frontend/components/feature/identity/ProfilePage/DatanoProfile.tsx`
4. `Frontend/components/feature/identity/ProfilePage/ProfileController.tsx`
5. `Frontend/components/feature/identity/ProfilePage/index.tsx`
6. `Frontend/components/feature/identity/ProfilePage/heading.tsx`
7. `Frontend/components/feature/identity/ProfilePage/access.tsx`
8. `Frontend/components/feature/identity/ProfilePage/content.ts`
9. `Frontend/components/feature/identity/ProfilePage/validation.ts`
10. `Frontend/app/globals.css` — profile selector only
11. `Frontend/app/ui-review/profile/page.review.tsx`
12. `Frontend/components/feature/internal/ProfileReview/DevelopmentProfileReview.tsx`
13. `Frontend/components/feature/internal/ProfileReview/index.tsx`
14. `Frontend/components/feature/internal/ProfileReview/fixtures.ts`
15. `Frontend/components/feature/internal/UIReview/index.tsx` — catalogue link only
16. `Frontend/components/feature/internal/UIReview/fixtures.ts` — link text only
17. `Frontend/tests/e2e/profile.spec.ts`
18. `Frontend/README.md`
19. `Frontend/docs/design-system.md`
20. `Frontend/docs/validation/FE-013-profile.md`
21. `docs/backlog.md` — FE-013 checkbox only

## Limits and completion

Explicit Chrome 154.0.8037.98 was used. Matching bundled Chromium was not run or
downloaded; the FE-006 distribution-access limitation remains. Build used approved
network access for unchanged Google Fonts. Inherited color-environment warnings
were non-failing and not suppressed. Backend/OpenAPI/Orval/database/provider tests
do not apply because those code/contracts were untouched.

Real profile/session/logout integration remains FE-030/FE-032; email proof and
replacement remain FE-033/BE-016. The public access state is not a claim of
implemented server session authorization. UI fixtures cannot create identity,
privileges or successful mutations. No real data or integration was fabricated.

FE-013 is complete within UI scope. Only its checkbox changed; other task IDs,
descriptions/statuses and Epic structure remain intact. Hash/content comparison
confirms all previous approved pages, shared layouts/primitives, tooling, backend
and guides are preserved. No Git command, stage, commit, push or deployment ran.

The existing opted-in dev server remains at `http://127.0.0.1:3000`: `/profile`
shows the access state; `/ui-review/profile` shows the complete UI;
`/ui-review/profile?emailStep=code&state=ready` directly reviews email proof.

Suggested commit: `feat(frontend): implement FE-013 profile and account editing UI`
