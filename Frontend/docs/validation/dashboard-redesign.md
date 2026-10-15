# Dashboard redesign — FE-019 through FE-023

Validated 2026-10-15. This completes the explicitly requested dashboard redesign,
including three independent source charts and targeted documentation updates.
It does not implement FE-024 or the future backend/integration tasks.

## Delivered behavior

- Reusable DashboardReport composition places the overview and GA4 chart beside
  each other on desktop, with compact Search and Ads sections below. Mobile
  stacks the same features. The dashboard uses existing blue/purple tokens,
  Vazirmatn, RTL, icons, soft cards and a light gradient; public page designs,
  header, footer and logo are unchanged.
- Site, default 28-day period, custom Jalali range, Apply behavior, comparison
  and source-specific periods remain available. Private scenario tools have a
  separate, initially collapsed disclosure.
- KPI cards retain prominent value, source and unit. Zero, missing, invalid
  denominator, partial/provisional, stale and error states remain distinguishable.
  Important quality/freshness warnings remain visible; technical metadata and
  comparison details expand within the same page without new routes or modals.
- GA4 uses an area chart with daily sessions or totalUsers. Whole-window unique
  users remain an independent KPI, never a sum of daily users.
- Search Console uses a line chart with daily property-level clicks or impressions.
  The query table is retained beside it on wide screens. Top rows cannot substitute
  for population totals or the property-level time series.
- Google Ads uses a bar chart with cost, clicks or conversions and integrates ROAS
  with the other four KPI cards. Original ISO currency and compatible attribution
  basis are required. Fractional conversions and exact micros display are retained;
  Number conversion is used only for chart coordinates, not financial arithmetic.
- Charts retain chronological LTR plots inside the RTL page, Persian labels,
  actual dates for current/previous periods, independent states, missing-day gaps,
  keyboard tooltips and an expandable daily table. There is no smoothing or
  allocation of real aggregate values into synthetic daily values.
- Only private review fixtures use deterministic, source-specific sample patterns.
  Recharts 3.10.1 and react-is 19.2.4 were already installed; this redesign adds
  no dependency or dependency/configuration upgrade.

## Backend readiness and remaining scope

The existing backend contains authentication, users and roles scaffolding, not
operational analytics/report endpoints. Backend code was inspected and left
unchanged. SourceTrend inputs are presentation adapter types, not an invented HTTP
schema. Pure rendering remains separate from selection/validation and future
data hooks. Future integration must use the actual OpenAPI/generated client and
map validated source results into these inputs.

The documented daily requirements are GA4 date × sessions/totalUsers, GSC date ×
clicks/impressions with property aggregation independent of top query rows, and
Ads segments.date × cost_micros/clicks/conversions. Site/resource, exact query,
timezone, requested/received/final coverage, receipt, quality, currency and
attribution basis must be preserved. Current and previous queries remain distinct.
Missing dates do not imply zero. Arbitrary future filters must be carried through
the real adapter/cache identity rather than assumed compatible.

These requirements were checked against official
[GA4 schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema),
[Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query),
[Ads segmentation](https://developers.google.com/google-ads/api/docs/reporting/segmentation)
and [Ads metrics](https://developers.google.com/google-ads/api/fields/v23/metrics).
References do not pin a future API/SDK version.

Operational connection and full backend compatibility remain unverified until
the corresponding backend/integration tasks implement the real contracts.
This is an explicit future dependency, not a remaining UI redesign task.
No endpoint, backend model, generated client, authentication bypass or product
fixture fallback was added.

## Documentation and Backlog

The dated three-chart decision is recorded in MVP, UX, proposal, Design System,
the frontend architecture cookbook and README. Historical design recipes are
explicitly superseded where they differ from the new composition/disclosure design.

Only acceptance text was supplemented for:
FE-021, FE-022, FE-023, BE-024, BE-026, BE-027, FE-037, BE-029, BE-030,
FE-039, BE-032, BE-033 and FE-041.
All task identifiers, order, titles, priorities, dependencies and checkboxes remain
unchanged. No task was created or marked complete merely because its text changed.

## Validation evidence

Runtime: bundled Node 24.19.0, pnpm 11.25.0; installed Chrome 155.0.8059.40.
Commands ran from Frontend with the bundled Node directory first on PATH.

| Check | Actual final result |
| --- | --- |
| pnpm lint | Passed |
| pnpm exec tsc --noEmit --incremental false | Passed, including after restoring the build-generated next-env route import |
| UI_REVIEW_ENABLED=1 pnpm build | Passed; 16 static pages generated, private review routes absent |
| Seven dashboard spec files, mobile + desktop | 130 passed |
| Landing and services regression specs, mobile + desktop | 18 passed |
| Combined final Playwright run | 148 passed, zero failures, 5.2 minutes |
| Production route checks | 38 HTTP/RSC checks passed |
| Production manifest and server/client JS scan | Private chart/review/fixture markers absent |
| Production guest route browser checks | Passed at 390/1440px, including query tampering, no-JS login navigation and no storage/API side effects |
| Layout and interaction | 320/390/768/1440px, light/dark, 200% text, expanded disclosures, source independence, chronological comparison and keyboard tooltips passed |
| Manual final visual inspection | Desktop overview, Search chart and dark mobile Ads chart inspected; no clipping found |

The final test invocation used PLAYWRIGHT_CHANNEL=chrome and the temporary
/private/tmp/datano-redesign.config.ts to reuse the existing opted-in development
server on port 3000. It retains the repository's two projects, one worker,
zero retries and 30-second test timeout; the combined run's global timeout was
600 seconds rather than the repository's 300 seconds. Tests selected:
dashboard-shell, dashboard-kpi, dashboard-traffic, dashboard-search, dashboard-ads,
dashboard-redesign, dashboard-trend-data, landing and services.

For an independent run, use the same specs with the repository configuration and
--global-timeout=600000; its configured dev server uses port 3100. The existing
port-3000 server must not be mistaken for that separate test server.

New data tests exercise source/resource/window identity, top-row rejection,
timezone, duplicate/missing days, stale/invalid values, exact int64 micros display,
currency/basis mismatch and fractional conversions. Existing assertions were
preserved; review-tool disclosure opening and the now-ambiguous daily-table
summary locator were updated to match the new accessible layout.

Initial checks exposed real issues: grid overflow when daily tables expanded,
long text at 200%, and metric selection before React hydration. These were fixed
with grid min-width constraints, wrapping and hydration-aware control enabling.
The final 148-test run followed the final warning-visibility refinement.

The sandbox initially blocked Google Font downloads during build, local server
binding and Chrome launch. Authorized reruns outside the sandbox succeeded;
these failed attempts are not reported as passing checks. Production validation
used an owned temporary server on port 3009 with UI_REVIEW_ENABLED=1 and stopped it
afterward. The existing development server was preserved.

## Review URLs

- [Dashboard](http://127.0.0.1:3000/ui-review/websites/dashboard)
- [All three comparisons](http://127.0.0.1:3000/ui-review/websites/dashboard?traffic=comparison&search=comparison&adsMetric=comparison)
- [Missing days and real zero](http://127.0.0.1:3000/ui-review/websites/dashboard?trend=gaps)
- [Daily data unavailable](http://127.0.0.1:3000/ui-review/websites/dashboard?trend=empty)

The review route requires development mode and UI_REVIEW_ENABLED=1.
trend also accepts loading/error. These scenarios do not create product data.
Production review routes return 404 even when the flag is set.

## File inventory

Relative paths below are from the workspace root. Compared with the preserved
pre-redesign text snapshot: 28 existing files edited, seven files created
(including this report), none deleted. Build-generated next-env.d.ts was restored.
Backend, all AGENTS guides, manifests/lockfile, shared layouts and public page
implementation files are unchanged. No Git operation was performed.

### Edited

- `Frontend/README.md`
- `Frontend/app/globals.css`
- `Frontend/docs/design-system.md`
- `Frontend/components/feature/analytics/DashboardShell/index.tsx`
- `Frontend/components/feature/analytics/SearchPerformance/index.tsx`
- `Frontend/components/feature/analytics/SearchPerformance/content.ts`
- `Frontend/components/feature/analytics/SearchPerformance/DatanoSearchPerformance.tsx`
- `Frontend/components/feature/analytics/TrafficOverview/index.tsx`
- `Frontend/components/feature/analytics/TrafficOverview/series.ts`
- `Frontend/components/feature/analytics/TrafficOverview/DatanoTrafficOverview.tsx`
- `Frontend/components/feature/analytics/AdsPerformance/index.tsx`
- `Frontend/components/feature/analytics/AdsPerformance/DatanoAdsPerformance.tsx`
- `Frontend/components/feature/analytics/AdsPerformance/content.ts`
- `Frontend/components/feature/analytics/KPIOverview/index.tsx`
- `Frontend/components/feature/analytics/KPIOverview/content.ts`
- `Frontend/components/feature/internal/DashboardReview/index.tsx`
- `Frontend/components/feature/internal/DashboardReview/traffic-fixtures.ts`
- `Frontend/components/feature/internal/DashboardReview/DevelopmentDashboardReview.tsx`
- `Frontend/docs/cookbook/component-development-framework.md`
- `Frontend/tests/e2e/dashboard-shell.spec.ts`
- `Frontend/tests/e2e/dashboard-ads.spec.ts`
- `Frontend/tests/e2e/dashboard-traffic.spec.ts`
- `Frontend/tests/e2e/dashboard-kpi.spec.ts`
- `Frontend/tests/e2e/dashboard-search.spec.ts`
- `docs/Datano_MVP.md`
- `docs/Datano_proposal.md`
- `docs/datano-ux-pages-.md`
- `docs/backlog.md`

### Created

- `Frontend/components/feature/analytics/DashboardReport/index.tsx`
- `Frontend/components/feature/analytics/SourceTrend/DatanoSourceTrend.tsx`
- `Frontend/components/feature/analytics/SourceTrend/series.ts`
- `Frontend/components/feature/internal/DashboardReview/trend-fixtures.ts`
- `Frontend/tests/e2e/dashboard-redesign.spec.ts`
- `Frontend/tests/e2e/dashboard-trend-data.spec.ts`
- `Frontend/docs/validation/dashboard-redesign.md`

## Suggested commit message

```text
feat(frontend): redesign dashboard and charts for FE-019 to FE-023
```

This is a suggestion only; no stage, commit or push was executed.

