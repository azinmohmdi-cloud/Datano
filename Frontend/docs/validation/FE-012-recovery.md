# FE-012 — unified password recovery UI

Validated 2026-10-12. Scope: FE-012 only. Initial HEAD `a744670`, working tree
clean. Shared/specialized guides, product/MVP/UX, Epic 03, component cookbook,
Design System, FE-005 review policy and existing Login/Signup were inspected.
FE-005 is checked. No backend, API, dependency, configuration or approved public
page implementation changed.

## Outcome and architecture

`/forgot-password` composes the concrete `RecoveryForm/DatanoRecovery.tsx`
wrapper, its client controller and pure UI through ProductLayout/PublicLayout.
The controller owns values, validation, stage changes, visibility, focus and
private review timers. Shared `AuthFormLayout` supplies one Card, heading/icon
slot, progress indicator and Login footer link. New modules use existing Field,
Input, Button, Card, ErrorState, Lucide, brand and typography tokens.

| Acceptance | Delivered and verified |
| --- | --- |
| Request code | Email, Persian native-type validation, continue and Login link; private pending/error scenarios |
| Enter code | Editable single numeric-input-mode textbox, exactly eight digits including a leading zero, clear format/invalid/expired/locked feedback |
| New password | Password/confirmation, independent accessible visibility controls, approved 15–128 Unicode-code-point policy and exact equality |
| Expiry/resend | Private 600-second expiry, 60-second cooldown, five invalid attempts, resend resets counters and clears old sample code |
| Continuous visual flow | One frame and CTA position, shared heading/progress/footer geometry, intrinsic sizing rather than fixed height |
| Retention/focus | Mounted inactive panels retain inputs; back/next focuses the active field; scenario reset is explicitly disclosed |
| No false backend success | Public email submit reports unavailability and cannot advance; private stage navigation is labeled inspection; even valid reset reports unavailability |
| Fixture isolation | Existing FE-005 discovery/server guard excludes review route and private values from production |

Passwords reuse the existing Unicode counter from Signup without changing that
feature. No trimming, normalization, truncation, composition requirement or
native UTF-16 min/max length is applied. Confirmation compares exact strings.
Code normalization converts Persian/Arabic decimal digits to ASCII only; other
characters are retained for validation rather than silently discarded. No code
length limit truncates input. Shared Field associates labels/errors/descriptions;
invalid submission focuses the first invalid field within the actual form.

The public controller always stays on email and ignores preview query strings.
No email, verification, password change, redirect, auto-login, API call, cookie,
token or browser-storage write is simulated. Native POST semantics and disabled
pre-hydration/no-JavaScript controls prevent credentials entering query strings.
Values remain in component memory. Real challenge/session/SMTP/rate-limit and
reset behavior is FE-031/BE-013 work, not a delivered integration here.

## Private review and design

`/ui-review/recovery` supports `step=email|code|password` and `state=ready|pending|
error|expired|locked|resend-ready|near-expiry`. Unknown/repeated selections fall
back to email/ready. Selectors expose every stage without requiring fake API
responses. Step changes preserve values; changing the initial scenario remounts
the fixture intentionally, explained beside its controls. Reload reconstructs
the selected initial fixture. Progressing a valid-format sample code is only
private panel navigation, never successful authentication.

Timers use elapsed wall-clock seconds, with deterministic SSR initial values and
effect cleanup. Tests control time using Playwright's clock. Resend explicitly
states that the sample timer was reset and no email was sent, clears the previous
sample code and resets expiry/cooldown/attempts. A pending fixture disables
interactions and exposes a polite status. Expiry/attempt limits prevent the code
action until a fresh sample is requested.

Recovery follows Login's existing `max-w-md` (448px) cap. Signup's `max-w-xl`
(576px) difference was observed and retained; neither approved page was edited.
The auth Card, Vazirmatn, 24px heading, blue primary action, 48px minimum controls,
44px visibility targets/20px icons and fixed 52px text inset match current auth
recipes. A new page-only selector reuses existing icy-blue/lavender gradient
tokens and dark adaptations, without changing any prior selector or token.

Heading and fieldset cells overlap in an intrinsic grid; the largest content at
the current viewport determines size. Inactive cells are invisible, inert,
aria-hidden and disabled, but retain inputs. One shared CTA reserves its longest
label at enlarged text sizes. This keeps normal stage frame x/y/width/height and
CTA document position within one pixel on both test projects. Inactive content
is not an extra keyboard/assistive-technology form. Error content can increase
intrinsic height; no fixed-height clipping is used. The short code hint and
combined resend/cooldown row reduce reserved whitespace; the email stage still
reserves space needed by the later two-field/code stages to avoid frame jumps.

Screenshots of email/code/password at 390px and 1440px, code at 320px dark, and
production at 390px were manually inspected for Persian shaping, mixed direction,
hierarchy, wrapping, form rhythm and the unchanged shell. Automated checks cover
all stages at 320/390/768/1440px in both themes, 200% text and reduced viewport
height (420px). Reduced-height emulation checks scroll access to the CTA; it is
not a claim of physical-device keyboard or screen-reader certification.

## Red, corrections and executed checks

Before implementation, the focused desktop public recovery test failed for the
expected behavior: `/forgot-password` returned 404 instead of 200. It passes on
the final implementation. Initial focused runs exposed strict locator ambiguity
because the code form and code textbox share the accessible name. Tests now
select the actual textbox by role and exact name. Clock tests await hydrated
enabled input before advancing time. Geometry measurements use document rather
than viewport coordinates because browser scrolling to the CTA changes viewport
y; the same one-pixel frame/CTA assertions remain in place.

Lint caught ref propagation during render in initial focus wiring. Final focus
uses a primitive React `useId` form identifier and an effect scoped to the active
panel; refs are read only in the effect. No rule, type check or assertion was
disabled. A focused 16/16 run passed before the final layout compacting; the full
78-test suite then passed on the final source.

Commands ran from `Frontend/` with Node 24.19.0 and pnpm 11.25.0:

```sh
export PATH="/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

| Command/check | Result |
| --- | --- |
| Baseline `pnpm lint` and `pnpm exec tsc --noEmit --incremental false` | Passed before implementation |
| Focused public recovery test, desktop, before implementation | Expected failure: 404 |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-012.config.ts recovery.spec.ts` | 16/16 passed after locator, clock and coordinate corrections, 26.3s |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-012.config.ts` | 78/78 passed on final source, 1.6m; zero failures, retries or skips |
| Final `pnpm lint` | Passed, exit 0 |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed; `/forgot-password` static, private review routes absent |
| `pnpm exec tsc --noEmit --incremental false` after final build | Passed, exit 0 |
| `node /private/tmp/datano-fe-012-production.cjs` | Passed: manifest/client isolation, 20 HTTP/RSC checks, unavailable recovery/query isolation and no-JS at 390/1440px |
| Diff, preservation, local links, whitespace and Backlog audit | Passed; FE-012 checkbox only |

The full suite adds 16 recovery executions to all 62 existing auth/public/shell/
navigation/review cases. It verifies email errors/focus, public query isolation,
no requests/storage/auth effects, continuous geometry, values/focus across back/
next, exact code length, leading zeros and both localized digit sets, linked
errors, controlled expiry/cooldown/resend, five invalid attempts, locked recovery,
14/15 emoji and 128/129 password boundaries, exact whitespace confirmation,
independent keyboard visibility, pending stages and disabled no-JavaScript forms.

The temporary test config spreads the actual repository configuration, preserving
both projects, locale/timezone, browser policy, one worker and zero retries. It
reuses the existing opted-in port-3000 server and writes artifacts under
`/private/tmp/datano-fe-012-tests` and `/private/tmp/datano-fe-012-report`. No repo
test configuration or prior test changed. This avoids the existing dev lock
without stopping the task-owned server.

Production validation used its own port-3008 server with the review flag enabled.
Manifest and static JavaScript scans exclude recovery/login/signup fixture
markers. Six public routes return 200; seven private route/query variants return
404 for HTTP and RSC (20 checks). Real browser contexts prove query flags/sample
code cannot enable stages, valid email reports unavailability, Login navigation
works, and no API request, cookie/storage change, overflow or page error occurs.
No-JavaScript contexts prove disabled controls and working Login links. The owned
production server and browser were stopped after the passing check.

## Changed files

Paths are relative to the workspace root:

1. `Frontend/app/(product)/(public)/forgot-password/page.tsx`
2. `Frontend/components/layout/AuthFormLayout/index.tsx`
3. `Frontend/components/feature/identity/RecoveryForm/DatanoRecovery.tsx`
4. `Frontend/components/feature/identity/RecoveryForm/RecoveryFormController.tsx`
5. `Frontend/components/feature/identity/RecoveryForm/index.tsx`
6. `Frontend/components/feature/identity/RecoveryForm/content.ts`
7. `Frontend/components/feature/identity/RecoveryForm/validation.ts`
8. `Frontend/app/globals.css` — recovery selector only
9. `Frontend/app/ui-review/recovery/page.review.tsx`
10. `Frontend/components/feature/internal/RecoveryReview/DevelopmentRecoveryReview.tsx`
11. `Frontend/components/feature/internal/RecoveryReview/index.tsx`
12. `Frontend/components/feature/internal/RecoveryReview/fixtures.ts`
13. `Frontend/components/feature/internal/UIReview/index.tsx` — catalogue link only
14. `Frontend/components/feature/internal/UIReview/fixtures.ts` — link text only
15. `Frontend/tests/e2e/recovery.spec.ts`
16. `Frontend/README.md`
17. `Frontend/docs/design-system.md`
18. `Frontend/docs/validation/FE-012-recovery.md`
19. `docs/backlog.md` — FE-012 checkbox only

## Limits and completion

Chrome 154.0.8037.98 was explicitly selected. Matching bundled Chromium was not
downloaded or executed; FE-006 records the workstation's distribution-access
limitation. Build used approved network access for unchanged Google Fonts.
Inherited NO_COLOR/FORCE_COLOR warnings were non-failing and not suppressed.
Backend/OpenAPI/Orval/provider/database checks do not apply to this UI-only change.
Actual email delivery, challenge verification and password reset remain FE-031.
There is no new API contract, dependency, deployment or production auth claim.

FE-012 is complete in its UI scope. Only its checkbox was updated; other IDs,
descriptions/statuses and Epic status remain unchanged. Approved Login/Signup,
Landing/Services/About, previous tests, shell, primitives and engineering guides
are preserved. No stage, commit, push or deployment was performed.

The reused development server remains on `http://127.0.0.1:3000`:
`/forgot-password` is the public unavailable form; `/ui-review/recovery` provides
private three-stage/state inspection.

Suggested commit: `feat(frontend): implement FE-012 unified password recovery UI`
