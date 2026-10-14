# FE-019 — Dashboard shell and period controls

Validated 2026-10-14. Scope: FE-019 only, depending on completed FE-014.
No Git command, real session, backend/API, Google operation or new dependency.

## Outcome and acceptance

| Criterion | Delivered and verified |
| --- | --- |
| Dashboard shell | SiteLayout/ProductLayout, domain/ownership context, independent source-period Cards; no KPI/chart/recommendation implementation |
| Site selection | Existing allowlisted website/receipt identities; switching site resets drafts, applied window, comparison and feedback |
| 28-day default | 28 inclusive complete days ending at each source's supplied final day, within the approved maximum three-day finalization delay from yesterday |
| Comparison | Initially enabled shared Checkbox; immediately preceding equal inclusive day count, independently anchored for each source |
| Solar custom range | Labeled Persian date text fields, Persian/Arabic/ASCII digits, slash/hyphen separators, explicit Apply and separate applied-window summary |
| Date validation | Real calendar/leap validation, reversed ranges, source-local yesterday ceiling, retained drafts and first-invalid focus |
| Metadata | Source timezone, requested/comparison windows, received coverage, overlap with both windows, actual covered end and last final day |
| Missing/nonfinal data | `—` for unknown windows/coverage; missing coverage, incomplete coverage and provisional days stay distinct; no generated data |
| Shared identity | Persian/RTL/Vazirmatn, existing controls/cards/Lucide/brand tokens and single header/footer; approved pale blue dashboard backdrop |
| Production isolation | Review routes absent from manifest; sample sites/clock/selectors absent from client bundles; public query flags cannot expose fixtures or controls |

The private fixture clock is 2026-10-14T09:00:00Z. Source final ends reuse
FE-018's GSC October 10, GA4 October 11 and Ads October 12 metadata. Comparison
windows exist as controls/context, not fabricated historical metrics: the supplied
default fixtures contain only their current coverage, so previous-period coverage
shows `—`. Custom comparison overlap is shown only where supplied coverage exists.
An interval with incomplete coverage does not imply every day/row is present.

The solar field is explicitly a Persian-calendar date. A four-digit year that
resembles a Gregorian year is still interpreted as solar; future-date validation
then applies. Intl supplies both parsing validation and display calendar semantics,
including leap years. A bounded binary search of civil days avoids an additional
calendar dependency. Canonical values remain Gregorian source civil dates, not
localized payloads or UTC-shifted report days. Operational time is injected;
the fixture clock never enters product modules.

## Architecture and route decisions

Pages compose concrete injectors. DashboardShellController owns draft controls,
applied presentation windows, formatting, validation and callbacks. Its pure UI
uses locally typed presentation props, translations and callbacks, with existing
primitives. `periods.ts` accepts presentation metadata only, not a proposed API
schema or a new analytics/domain model. No fetching/data hook is fabricated.

The public `/websites/[websiteId]` route uses a new pathless `(workspace)` group
with the existing SiteLayout. Account onboarding routes remain in `(account)`;
the old `/sites/[siteId]` scaffold is preserved. There is one width shell and one
outer ProductLayout per route. The public injector imports no private controller,
fixtures or sample identity and shows guest access with working Login/list links.
Trusted ownership/session/report integration remains FE-037; real period/freshness
and refresh behavior remain FE-043.

Private `/ui-review/websites/dashboard` is a `page.review.tsx` route behind the
existing development/opt-in guard and production-discovery exclusion. It accepts
allowlisted site/source scenarios and `view=ready|loading|error`; unknown/repeated
parameters fall back to fixed presets. Report readiness reuses FE-018's validity
check, independent of ownership alone. The site list now opens this shell for
ready/empty reports. Receipt passes the same site and independent source scenarios
through an optional destination callback; the controller retains its original
local-destination fallback for consumers without that callback. Proof-example/new
receipt sites retain their own IDs and hostnames rather than falling back to a
different website. Ownership/not-ready/loading/failure have distinct UI states.

## Design and scope

The approved `#f3f7ff` backdrop and dark `#171e2b` adaptation are centralized in
`--page-dashboard`. Only `main:has(.page-surface-dashboard)` opts into them;
the shared header/footer, account onboarding and earlier public pages retain
their backgrounds. No primitive, logo, navigation design or status palette is
changed. Existing Card/Button/Field/Input/Checkbox, textual status labels and
Activity/Search/Megaphone symbols are reused. Controls have 48px minimum height;
source cards stack below lg. Domain/timezone values use LTR isolation, dates keep
Persian calendar display, and long labels/domains wrap. Metadata uses h3 source
headings and semantic dl groups. The implementation follows the
[Design System](../design-system.md), [MVP](../../../docs/Datano_MVP.md),
[UX](../../../docs/datano-ux-pages-.md) and [Backlog](../../../docs/backlog.md).

## Executed validation

Commands ran from Frontend with Node 24.19.0 selected before pnpm on PATH,
pnpm 11.25.0, Playwright 1.62.1 and explicit installed Chrome 155.0.8059.40.
The default bundled Chromium was not installed/run in this task. The existing
opted-in development server on port 3000 was reused and left running; a temporary
config imports repository configuration, overriding baseURL, server reuse and
output paths only. Reports/captures remain in `/private/tmp`.

| Command/check | Actual result |
| --- | --- |
| Baseline `pnpm lint` and `pnpm exec tsc --noEmit --incremental false` | Passed before implementation |
| Initial sandbox Playwright attempt | Infrastructure failure: local server/browser unavailable in sandbox; not a behavioral Red |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-019.config.ts dashboard-shell.spec.ts --project=desktop --grep 'independent 28-day'` with allowed access | Meaningful Red: missing dashboard review returned 404 instead of 200 |
| First two-test dashboard run | 1/4 passed; strict locator ambiguity in Base UI checkbox/native input and Next route-announcer alerts corrected with semantic/scoped locators |
| First expanded four-file run | 77/82 passed; four new failures and one receipt focus-before-hydration failure, resolved below |
| Final `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-019.config.ts dashboard-shell.spec.ts data-receipt.spec.ts websites.spec.ts ui-review.spec.ts` | 82/82 passed on mobile/desktop, 1.9m; no failures/retries/skips |
| Final `pnpm lint` | Passed, no diagnostics |
| Final `pnpm exec tsc --noEmit --incremental false` | Passed, including after build/reference restoration |
| `UI_REVIEW_ENABLED=1 pnpm build` in sandbox | Failed fetching the existing Vazirmatn/Geist Mono Google Fonts resources |
| Same build with allowed network access | Passed; `/websites/[websiteId]` present; review routes excluded despite the flag |
| `node /private/tmp/datano-fe-019-production.cjs` | Passed: manifest/client isolation, 26 HTTP/RSC checks, public access/navigation/backdrops at 390/1440px and no-JS |
| `node /private/tmp/datano-fe-019-visual.cjs` | Passed: four focused control/source captures, normal mobile and 200% text/dark |
| `node /private/tmp/datano-fe-019-colors.cjs` | Passed: settled dark link background/color check after transition |
| Baseline snapshot/content audit | No removed files; modifications restricted to this task; only FE-019 Backlog status changes |

The expanded run exposed a real presentation omission: nonfinal received coverage
was hidden when no final default end existed. Received coverage is now independent
of the requested overlap and retains its provisional label. A calendar test had
incorrectly assumed the valid solar year `2026` was an invalid Gregorian entry;
it now asserts the actual solar interpretation and retains all invalid/leap-day
cases. The receipt focus assertion now explicitly waits for enabled before focus;
the original focus check remains. Source-navigation assertions now verify the real
private shell destination, matching hostname and source states. No acceptance
assertion, lint/type rule or retry policy was weakened.

New tests cover inclusive comparison length, Nowruz/leap dates, three digit sets,
different source midnights, missing/old final metadata, immutable transformations,
draft retention/error association/focus, one-day/custom windows, site reset, empty
versus unavailable coverage, independent partial sources, list/receipt handoffs,
loading/error/ownership gates, malformed/repeated selectors, no API/cookie/storage
effects, reload, public access and no-JavaScript boundaries. Layout checks cover
320/390/768/1440px, both token themes, 200% text and shared landmarks/footer.
Manual review inspected desktop light, mobile dark and focused custom/provisional
control/source captures, including enlarged dark text, with no clipping/overflow.

Production checks deliberately set UI_REVIEW_ENABLED=1. Private HTML/RSC URLs
still return 404. Fixture markers/fixed clock/private controls are absent from
production JavaScript. Public query flags expose no data, selector or private
link. Account onboarding shells/backgrounds remain unchanged. The owned temporary
production server was stopped; the existing development server was preserved.
Build's only next-env.d.ts change was verified as the generated routes reference
and restored exactly to its pre-task contents; TypeScript passed afterwards.

No live backend/Google/persistence/session test applies: these integrations are
absent and outside FE-019. Local UI coverage is not real report authorization,
physical-device testing or assistive-technology certification.

## Files and completion

Created (workspace-relative):

- `Frontend/app/(product)/(workspace)/layout.tsx`
- `Frontend/app/(product)/(workspace)/websites/[websiteId]/page.tsx`
- `Frontend/app/ui-review/websites/dashboard/page.review.tsx`
- `Frontend/components/feature/analytics/DashboardShell/index.tsx`
- `Frontend/components/feature/analytics/DashboardShell/DashboardShellController.tsx`
- `Frontend/components/feature/analytics/DashboardShell/DatanoDashboardShell.tsx`
- `Frontend/components/feature/analytics/DashboardShell/content.ts`
- `Frontend/components/feature/analytics/DashboardShell/periods.ts`
- `Frontend/components/feature/internal/DashboardReview/index.tsx`
- `Frontend/components/feature/internal/DashboardReview/DevelopmentDashboardReview.tsx`
- `Frontend/components/feature/internal/DashboardReview/fixtures.ts`
- `Frontend/tests/e2e/dashboard-shell.spec.ts`
- `Frontend/docs/validation/FE-019-dashboard-shell.md`

Edited:

- `Frontend/app/globals.css`
- `Frontend/components/feature/internal/WebsiteListReview/DevelopmentWebsiteListReview.tsx`
- `Frontend/components/feature/websites/DataReceipt/DataReceiptController.tsx`
- `Frontend/components/feature/internal/DataReceiptReview/DevelopmentDataReceiptReview.tsx`
- `Frontend/components/feature/internal/UIReview/index.tsx`
- `Frontend/components/feature/internal/UIReview/fixtures.ts`
- `Frontend/tests/e2e/websites.spec.ts`
- `Frontend/tests/e2e/data-receipt.spec.ts`
- `Frontend/docs/design-system.md`
- `Frontend/README.md`
- `docs/backlog.md` — FE-019 checkbox only, after successful acceptance/validation.

A pre-task snapshot of 337 files replaces Git inspection under the retained
no-Git restriction. Backend, engineering guides, previous product pages/shared
shells, package/lockfile, environment and API transport remain unchanged. There
are no deletions. FE-019 is complete within Epic 05 UI scope. FE-020 and all later
task statuses remain unchanged and their implementations were not started.

Suggested commit: `feat(frontend): implement FE-019 dashboard shell and period controls`
No stage, commit, branch, push, merge or deployment operation was performed.
