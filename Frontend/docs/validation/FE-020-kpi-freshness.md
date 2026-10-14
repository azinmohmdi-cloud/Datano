# FE-020 — KPI cards and data freshness

Validated 2026-10-14. Scope: FE-020 only, dependent on completed FE-019.
No Git command, backend/API, real Google request, new dependency or chart.

## Outcome and acceptance

| Criterion | Implemented and verified |
| --- | --- |
| Source/unit | Four overview Cards: GA4 totalUsers/users, sessions and keyEvents/events; GSC aggregate CTR/percent. Persian labels retain each source, unit and selected resource |
| Actual zero | Explicit count 0 and CTR 0 with positive impressions display Persian zero plus a zero label; no truthiness fallback |
| Missing value | Null/missing/unmatched aggregate displays `—` with an actionable explanation of source/window/permission availability |
| Zero denominator | GSC impressions=0 produces `—` and a distinct no-rate explanation; never 0%, NaN or Infinity |
| Incomplete data | Known partial/thresholded values keep separate quality labels and coverage, rather than appearing complete or disappearing into generic empty state |
| Stale data | More than 72 hours since successful receipt is explicitly old; numeric values remain visible. Exactly 72 hours is recent. This is not a new report-readiness gate |
| Independent freshness | Per-value receipt timestamps are independent of each source's last successful sync; recent unrelated sync cannot freshen an old aggregate |
| Period integration | Cards consume FE-019 applied windows/comparison, not drafts. Source-specific final ends remain independent and unavailable comparisons show `—` |
| Isolation | Observations must match website/source/property/metric/exact whole window; no summing daily unique users, proportional scaling or arbitrary duplicate choice |
| Persian/design | Shared Card/Lucide/brand tokens, Vazirmatn, RTL, semantic headings/dl, textual states, responsive grids and 200% text |
| Production | Public access-state injector unchanged; private selectors, clock, source IDs and fixtures absent from production routes/client code |

Sources are defined by [MVP](../../../docs/Datano_MVP.md),
[UX](../../../docs/datano-ux-pages-.md), [Backlog](../../../docs/backlog.md)
and the [Design System](../design-system.md). No provider API version, endpoint
or generated contract is inferred. Search Performance, Ads metrics, Recharts,
recommendations and real reporting remain separate tasks.

## Architecture and data semantics

The new `analytics/KPIOverview` feature has pure UI, a concrete injector, Persian
content and pure measurement/formatting helpers. Presentation inputs are explicit
local interfaces, not hand-written endpoint models. The shell gains only an
optional overview slot/render callback carrying its applied period/comparison.
This preserves a single control-state owner and existing ownership/readiness/
loading/error gates. The private dashboard injector supplies the KPI feature;
the public injector imports no fixture or KPI controller. No fetching hook,
request, polling, retry operation or storage is invented.

Whole-window GA4 totalUsers is supplied as a whole-window aggregate. Sessions and
keyEvents retain their GA4 meaning; Ads conversions are not mixed in. CTR uses
one matching aggregate's clicks/impressions rather than averaging row rates.
Invalid/negative/nonfinite observations, incompatible count/ratio shapes and
impossible click/impression ratios produce an explicit unavailable/invalid state.
Missing input is not zero. Tiny positive values retain a less-than display instead
of rounding into an apparently real zero. Source connection/permission is checked
before presentation matching, but this is not server authorization.

Current and comparison observations are independently selected by site, source,
active resource, metric and exact window. Missing/duplicate/mismatched observations
are not guessed. Known partial data remains labeled partial and retains its
received coverage. Quality and freshness are independent: zero can be old, partial
can be recent, and absent values can still have known receipt metadata. Provisional
quality remains distinct from final data. No recommendation evaluation is added.

UTC receipt timestamps are strictly validated and displayed with the existing
Persian/Tehran formatter. Missing, malformed, impossible-calendar or future times
produce unknown freshness. A three-source summary records the last successful
source sync separately from timestamps on the current/comparison values. A failed
latest sync with a valid previous result keeps that result and the source failure
label. Stale data is shown, not treated as disconnection or a report ban.

## Fixtures and design

`internal/DashboardReview/kpi-fixtures.ts` supplies deterministic, inert property
IDs, aggregate observations and scenarios. `kpi` accepts
`valid|mixed|zero|missing|zero-denominator|partial|thresholded|stale|loading|error|unknown-time`.
Unknown/repeated values fall back to valid. Arbitrary role/value parameters do not
create data. Changing site resets its fixture/period/comparison and KPI scenario;
review-scenario changes reset the shell, as the private notice explains.

Default valid source windows remain FE-019's existing ones. Explicit custom
aggregates exist only for 2026-09-23–2026-10-10. Other custom/comparison windows
show `—` unless an exact record exists. These fixtures contain no previous default
window, so comparison values are not fabricated. Empty GA4 fixtures explicitly
supply zero counts; GSC zero clicks/impressions produces undefined CTR.

Mixed/stale GA4 ends on October 10, with successful receipt at October 11 08:00 UTC,
73 hours before the October 14 09:00 UTC review clock. The source-period shell and
KPI Cards consume the same adjusted metadata, so neither the controls nor the
values claim complete data after receipt. Other sources retain independent times.
Fixture refinement did not alter the FE-019 default presets or previous product UI.

Cards use the established 30px/40px value scale, existing 1 → 2 at sm → 4 at lg
grid, rounded-2xl Card surfaces, brand-ink/brand-soft, Lucide symbols and tabular
Persian numerals. Each status has text, not color alone. Source brands use LTR
isolation. Loader animation respects reduced motion; errors use alert semantics.
Freshness summaries stack below lg. No shared primitive, color token, CSS, font,
layout, header/footer or earlier page design changes. Design-system consistency
is preserved without deviation.

## Executed checks

Run from Frontend with Node 24.19.0 selected before pnpm on PATH, pnpm 11.25.0,
Playwright 1.62.1 and explicit installed Chrome 155.0.8059.40. Default bundled
Chromium was not downloaded/run. The existing opted-in server on port 3000 was
reused and preserved. Temporary config imports repository Playwright settings,
changing only baseURL/server reuse/output paths; repository tooling is unchanged.

| Command/check | Result |
| --- | --- |
| Baseline `pnpm lint` and `pnpm exec tsc --noEmit --incremental false` | Passed before implementation |
| Initial sandbox browser attempt | Infrastructure failure reaching local server/browser; not counted as behavioral Red |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-020.config.ts dashboard-kpi.spec.ts --project=desktop --grep 'whole-window'` with allowed access | Meaningful Red: KPI overview heading absent from the existing dashboard |
| Initial `dashboard-kpi.spec.ts` run | 4/4 passed on mobile/desktop |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-020.config.ts dashboard-kpi.spec.ts dashboard-shell.spec.ts data-receipt.spec.ts websites.spec.ts ui-review.spec.ts` | 104/104 passed, 2.3m; no retries/skips/failures |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-020.config.ts dashboard-kpi.spec.ts dashboard-shell.spec.ts` after stale-fixture temporal refinement | 44/44 passed on final implementation, 48.6s |
| Final `pnpm lint` | Passed, no diagnostics |
| Final `pnpm exec tsc --noEmit --incremental false` | Passed, including after build/reference restoration |
| `UI_REVIEW_ENABLED=1 pnpm build` in sandbox | Failed fetching the existing Vazirmatn/Geist Mono resources from Google Fonts |
| Same build with allowed network access | Passed; product routes retained and private review excluded despite enabled review flag |
| `node /private/tmp/datano-fe-020-production.cjs` | Passed: manifest/client KPI isolation, 26 HTTP/RSC checks, public query/storage/navigation at 390/1440px and no-JS |
| `node /private/tmp/datano-fe-020-visual.cjs` | Passed: four final focused captures for desktop, mobile dark and enlarged text |
| Source/content/SHA-256 audit | Expected created/edited files only; no deletions; FE-020-only Backlog checkbox change |

Eleven new test cases run in both viewport projects. They cover valid/zero/missing/
undefined ratios, partial/thresholded/old/unknown-time data, loading/error without
hiding another metric, exact age boundary, invalid numbers/calendar timestamps,
tiny positive formatting, immutable transformations, source/site/property/window
mismatch, duplicate records, unavailable comparisons, draft versus Apply, custom
whole aggregates and reset, empty reports, denied source permission, retained prior
success after sync failure, selector/reload guards and no API/cookie/storage effects.
The larger run includes all affected FE-019 and onboarding/shared-review regressions.
No acceptance assertion, previous test, lint/type rule, warning or retry policy was
removed or weakened. Only the affected KPI/shell suites were repeated after the
final fixture-only refinement; already-passing unrelated suites were not rerun.

Layout checks cover 320/390/768/1440px, both token themes, explicit Vazirmatn/RTL,
semantic labels, reduced motion and 200% root text without page overflow. Manual
inspection covered final desktop mixed states, mobile dark partial and zero-
denominator Cards, and enlarged dark zero/stale Card, with no clipping. Captures
and browser output remain in `/private/tmp/datano-fe-020-*`, not project source.

Production checks intentionally enable UI_REVIEW_ENABLED=1. Review HTML/RSC URLs
still return 404 and private KPI IDs/clock/selectors/site markers are absent from
client bundles. Product query flags expose no Card, freshness result or sample
control. Guest Login works at both viewport sizes and without JavaScript, with
no session/storage/API effects. The owned temporary production server was stopped;
the existing development server remained. Build's only next-env.d.ts change was
verified as the generated route-types reference and restored exactly to baseline;
TypeScript passed afterwards.

Real Google/provider/ingestion/database/session tests are outside this UI task and
were not run. API contract, actual source permission and trusted reporting remain
later integrations. This is local UI acceptance, not physical-device or assistive-
technology certification or production report readiness.

## Files and completion

Created (workspace-relative):

- `Frontend/components/feature/analytics/KPIOverview/index.tsx`
- `Frontend/components/feature/analytics/KPIOverview/DatanoKPIOverview.tsx`
- `Frontend/components/feature/analytics/KPIOverview/measurements.ts`
- `Frontend/components/feature/analytics/KPIOverview/content.ts`
- `Frontend/components/feature/internal/DashboardReview/kpi-fixtures.ts`
- `Frontend/tests/e2e/dashboard-kpi.spec.ts`
- `Frontend/docs/validation/FE-020-kpi-freshness.md`

Edited:

- `Frontend/components/feature/analytics/DashboardShell/index.tsx` — optional slot only
- `Frontend/components/feature/analytics/DashboardShell/DashboardShellController.tsx` — applied-period composition callback
- `Frontend/components/feature/internal/DashboardReview/index.tsx` — private scenario selector
- `Frontend/components/feature/internal/DashboardReview/DevelopmentDashboardReview.tsx` — private KPI composition/allowlisted scenarios
- `Frontend/docs/design-system.md`
- `Frontend/README.md`
- `docs/backlog.md` — only FE-020 status, after successful checks/acceptance

A pre-task 350-file content/SHA-256 snapshot replaces Git inspection under the
retained no-Git restriction. No Backend, engineering guide, package/lockfile,
environment, transport, route, shared primitive/layout, CSS, prior test or public
page source changes. No deletions. FE-020 is complete within Epic 05 UI scope;
FE-021 and later tasks remain unchanged and were not started.

Suggested commit: `feat(frontend): implement FE-020 KPI cards and data freshness`
No stage, commit, branch, push, merge or deployment operation was performed.
