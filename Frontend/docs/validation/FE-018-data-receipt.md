# FE-018 — Data receipt and report readiness UI validation

Executed 2026-10-14. Scope: Epic 04 UI, dependent on completed FE-017.
No actual OAuth, sync, job, backend report or Git operation.

## Delivered behavior and acceptance

- `/ui-review/websites/receive` presents three independent GA4, Search Console
  and Ads cards. Disconnected, queued, receiving, failed, successful empty and
  successful with data have distinct textual states, descriptions and actions.
  Unknown/missing/error results are never reported as zero or successful empty.
- Report readiness is separate from the latest source activity. Verified
  ownership and any one connected/permitted selected source with a successful,
  complete, final result covering its requested window permit a report. Others
  can be disconnected, queued, failed or permission-denied without hiding that
  result. A subset of valid sources with data is labeled a partial report.
- An all-empty set of valid results permits an empty report. A mixed set of
  valid empty/data results permits a report with data, preserving each source's
  meaning. Incomplete/nonfinal/mismatched-window or permission failures do not
  qualify. A previous valid result remains available while a new receipt runs
  or a retry fails; loss of permission cannot qualify it.
- Each connected card displays requested window, actual coverage and its
  completeness/finality, source timezone, last successful result and success
  timestamp. Unknown fields display `—`. Source civil days use Persian-calendar
  display without UTC/Tehran day shifting; operational UTC timestamps display
  in Asia/Tehran. No percentage, ETA, time-based fake progression or job polling.
- Refresh, source-status check and retry report actual unavailability and keep
  source results and report availability intact. Busy source buttons are disabled;
  source feedback stays scoped to its own card. No API request, job or success
  is created by these actions. Unavailable operations are not implemented retries.
- The report action displays the conceptual next dashboard destination locally.
  No dashboard route, chart, KPI or report content is introduced. FE-019 and later
  UI/integration work remain separate and were not started.

## Journeys and review boundaries

FE-014 waiting/failed list sites open receipt review with the same hostname and
their initial GSC state. The list/profile backlinks remain available. Connection
management preserves the same site and maps private connected/revoked/disconnected
states; a receipt failure does not imply disconnection. FE-017 continuation passes
only eligible connected source IDs and opens queued receipt for them, with other
sources disconnected in that initial receipt fixture. Nothing is actually queued.
These are review navigation decisions within the documented onboarding flow.

Private `ga4`, `gsc`, `ads` selectors accept
`disconnected|queued|receiving|failed|empty|ready|incomplete|permission-error|wrong-window|refreshing|retry-failed`.
The last three are named review scenarios for mismatch and prior-result retention.
Site selection resets all source scenarios; source selection resets the fixture
and action feedback, as the private notice explains. Unknown/repeated selectors
fall back to that site's preset. Default site is FE-014's `waiting`; its GSC is
queued, with GA4/Ads disconnected. Other fixtures reuse existing site hostnames.
Arbitrary role, ownership, job, resource or readiness flags grant nothing.

Fixed private windows contain 28 final source days, with intentionally different
ends (GSC 2026-10-10, GA4 2026-10-11, Ads 2026-10-12). The times/windows/source
associations are examples, not provider results or a backend schema. No custom
filter/comparison is introduced; FE-019 owns those controls. No 72-hour report
readiness restriction is invented: the MVP's 72-hour condition concerns future
recommendation evaluation.

`/websites/[websiteId]/receive` uses the approved website namespace and currently
shows guest access with Login and a public list backlink. Public URL/query inputs
do not expose sample sites, source cards, readiness or identity. Without JavaScript
the public Login link works; private review remains in the visible Suspense
fallback and its streamed hidden content is inaccessible.

Requirements come from [Backlog Epic 04 and later integration tasks](../../../docs/backlog.md),
[MVP: اتصال، آمادگی گزارش و KPIها](../../../docs/Datano_MVP.md) and
[UX: website selection, proof and dashboard transition](../../../docs/datano-ux-pages-.md).
The precise card layout, private route/scenario names and local dashboard notice
are UI decisions, not newly approved API contracts. Existing namespace/shell
differences remain unchanged; no product scope was rewritten.

## Architecture, design and remaining integration

Pages compose concrete public/private injectors. The private injector validates
allowlisted review inputs and supplies presentation fixtures. The controller
projects status/readiness/formatting and owns only local feedback; pure UI receives
presentation props, translations and callbacks. `ReceiptSourceInput` is a local
presentation input, not an invented server response. The public injector imports
no private fixtures or source controller.

The approved design system is reused without deviation: AccountLayout,
ProductLayout, neutral backdrop, Persian/RTL, Vazirmatn, shared Card/Button and
EmptyState, brand/destructive tokens and Lucide symbols. Cards stack below lg
and form three columns above it. Technical domains/timezones use LTR bdi; long
text wraps, controls retain a 48px minimum and focus remains visible. Receiving
animation uses motion-safe. No shared primitive, color, font, gradient, shell,
profile, header/footer, dependency or provider SDK change.

Trusted owner/site/source permission, actual jobs/receipt/coverage/readiness and
real refresh/retry require BE-023/BE-026/BE-027 and FE-037. Later multi-source and
refresh tasks supply the other integrations. Backend router inspection found no
implemented receipt/readiness contract to integrate; no endpoint/client was
fabricated. No real backend, Google, credential or worker test was run because
these capabilities are outside this UI task and unavailable here.

## Executed validation

Node 24.19.0, pnpm 11.25.0, Playwright 1.62.1; production probe used installed
Chrome 155.0.8059.40. All commands below ran from `Frontend/` with the bundled
Node/pnpm runtime on PATH. Existing opted-in port 3000 was reused and preserved.
Temporary `/private/tmp/datano-fe-018.config.ts` imports repository Playwright
configuration and overrides absolute test/output paths, list reporter, baseURL
and server reuse; repository configuration was not changed.

| Command / check | Result |
| --- | --- |
| Initial `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-018.config.ts data-receipt.spec.ts --project=desktop` | Meaningful red: receipt page/heading absent |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-018.config.ts data-receipt.spec.ts google-connections.spec.ts websites.spec.ts --project=desktop` | 37/38 passed; private fixture changes were made before preceding navigation completed |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-018.config.ts data-receipt.spec.ts google-connections.spec.ts website-verification.spec.ts websites.spec.ts add-website.spec.ts profile.spec.ts` | 133/136 passed; all 108 regression cases passed; one new keyboard case focused before hydration, and two no-JS cases incorrectly counted hidden streamed DOM as exposed UI |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-018.config.ts data-receipt.spec.ts` after correcting test waits/visibility | 28/28 passed on mobile/desktop, 47.0s |
| `pnpm lint` | Passed, no diagnostics |
| `pnpm exec tsc --noEmit --incremental false` | Passed, no diagnostics, including after the build-generated reference was restored |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed; public receipt route present, private review excluded |
| `node /private/tmp/datano-fe-018-production.cjs` | Passed: manifest/client fixture isolation, 30 HTTP/RSC checks and public navigation/query isolation at 390/1440px |
| Final localhost check | Receipt review returned HTTP 200 on port 3000 |

The corrected keyboard case waits for visible/enabled before focus and Enter,
then asserts scoped feedback and preserved results. The no-JS cases assert the
visible fallback, hidden receipt content and absence of accessible report controls;
they do not claim private development streaming contains no hidden markup.
Navigation waits for the changed source state before continuing. Layout screenshots
wait for a visible heading rather than merely counting streamed DOM. No product
acceptance assertion was removed. All new cases were rerun; already-passing
regression suites were not repeated without a new change.

Automated checks cover each source alone, mixed empty/data results, incomplete,
wrong-window and permission cases, historical valid results during updates,
source-local action failures, ownership and query guards, matching navigation,
date/timezone display, no-JS behavior and no mutation/API/cookie/storage effects.
Responsive checks cover 320/390/768/1440px, all six states at 390/1440 in both
token themes, 200% root text and reduced motion without horizontal overflow.
Manual screenshot inspection covered the mixed partial report on desktop dark
and mobile light, all-ready desktop light, failed mobile dark and public guest
mobile. Stable screenshots are `/private/tmp/datano-fe-018-manual-*` and
`/private/tmp/datano-fe-018-public-*`; test screenshots also remain in `/private/tmp`.
No generated screenshots/reports were added to project source.

Production checks intentionally set the review flag. Every private HTML/RSC URL
returned 404, and private source/site/receipt fixture markers were absent from
production client bundles and route manifest. Public receipt exposed no private
link/result, mutation request, cookie or storage effect. The owned temporary
server on port 3009 was stopped; port 3000 remained active. Build's only
generated `next-env.d.ts` route-types reference change was verified against
the pre-task snapshot and restored exactly.

## Changed files and completion

New files, relative to the workspace root:

- [Public receipt route](../../../Frontend/app/(product)/(account)/websites/[websiteId]/receive/page.tsx)
- [Private receipt route](../../../Frontend/app/ui-review/websites/receive/page.review.tsx)
- [Receipt UI](../../../Frontend/components/feature/websites/DataReceipt/index.tsx)
- [Receipt copy](../../../Frontend/components/feature/websites/DataReceipt/content.ts)
- [Readiness and date helpers](../../../Frontend/components/feature/websites/DataReceipt/readiness.ts)
- [Receipt controller](../../../Frontend/components/feature/websites/DataReceipt/DataReceiptController.tsx)
- [Public guest injector](../../../Frontend/components/feature/websites/DataReceipt/DatanoDataReceipt.tsx)
- [Review UI](../../../Frontend/components/feature/internal/DataReceiptReview/index.tsx)
- [Review fixtures](../../../Frontend/components/feature/internal/DataReceiptReview/fixtures.ts)
- [Private injector](../../../Frontend/components/feature/internal/DataReceiptReview/DevelopmentDataReceiptReview.tsx)
- [Receipt tests](../../../Frontend/tests/e2e/data-receipt.spec.ts)
- [This validation report](../../../Frontend/docs/validation/FE-018-data-receipt.md)

Updated files:

- [Connection controller](../../../Frontend/components/feature/websites/GoogleConnections/GoogleConnectionsController.tsx)
- [Connection review injector](../../../Frontend/components/feature/internal/GoogleConnectionsReview/DevelopmentGoogleConnectionsReview.tsx)
- [Connection fixtures](../../../Frontend/components/feature/internal/GoogleConnectionsReview/fixtures.ts)
- [Website list review injector](../../../Frontend/components/feature/internal/WebsiteListReview/DevelopmentWebsiteListReview.tsx)
- [Connection tests](../../../Frontend/tests/e2e/google-connections.spec.ts)
- [Website list tests](../../../Frontend/tests/e2e/websites.spec.ts)
- [README](../../../Frontend/README.md)
- [Design system](../../../Frontend/docs/design-system.md)
- [Backlog](../../../docs/backlog.md) — only FE-018 checkbox, after successful verification.

Pre-task SHA-256/content snapshots and scoped comparison replace Git inspection
under the user's explicit no-Git restriction. Existing source changes are limited
to receipt handoffs/tests/documentation; no Backend, profile, shared shell, package,
lockfile or unrelated source was modified or removed. FE-018 is complete as UI;
all five Epic 04 UI task checkboxes are now complete. No Epic checkbox existed to
change. This does not claim real integration completion. FE-019 was not started.
