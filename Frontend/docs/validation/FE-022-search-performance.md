# FE-022 — Search Performance

Validated 2026-10-14. Scope: FE-022 only, dependent on completed FE-020.
No Git operation, new dependency, backend/API work or FE-023 implementation.

## Outcome and acceptance

| Criterion | Implemented and verified |
| --- | --- |
| Four metrics | Separate clicks, impressions, CTR and average position Cards identify Search Console and each unit |
| Independent states | Each current/comparison observation has its own value, state, coverage, quality, successful receipt time and freshness; one loading/error does not hide the other metrics |
| Zero/missing/undefined | Explicit counts/CTR zero retain a zero label; missing values show `—`; impressions=0 makes CTR undefined; empty-report position remains unavailable |
| Aggregate semantics | CTR uses an aggregate's clicks/impressions; position is supplied by the source aggregate, never averaged from top rows |
| Top rows | A separate top-query input/table is explicitly a subset; it never supplies missing aggregate values, sums, rates or average positions |
| Finality versus completeness | Finalized received rows do not claim a comprehensive query population; the table states that completeness is not guaranteed |
| Context | Website/property/exact-window matching, Pacific civil-day timezone, Persian solar dates, units, coverage and Tehran receipt timestamps remain explicit |
| Periods | Applied custom/default windows and comparison are consumed from the existing shell; drafts cannot replace displayed values |
| Design | Existing Card/Table/status primitives, Lucide, brand tokens, Vazirmatn, RTL, responsive grids, local table scrolling and 200% text |
| Production | Private routes excluded from the manifest, HTML/RSC returns 404, fixture/selector markers absent from server and client JS |

Product meaning follows [MVP](../../../docs/Datano_MVP.md),
[Backlog](../../../docs/backlog.md), [UX](../../../docs/datano-ux-pages-.md)
and [Design System](../design-system.md). The official
[Search Analytics query reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
confirms that returned top rows are not guaranteed to include all rows, source
report dates are Pacific civil days, and rows contain distinct clicks/impressions/
CTR/position fields. This UI task does not select an SDK/API version or invent a
provider endpoint integration.

## Architecture and data integrity

`analytics/SearchPerformance` separates pure UI, a concrete injector, Persian copy
and pure measurement/selection helpers. Local typed presentation inputs explicitly
distinguish `property-aggregate` observations from `top-rows`. The injector selects
four current/previous readings independently and formats them without fetching.
The existing shell overview callback supplies the applied period/comparison to
KPI, traffic and search; ownership/report/loading/error gates remain in the shell.

Matching requires website, Search Console source, selected property, metric and
exact query window. Duplicate/mismatched observations and out-of-window coverage
do not produce invented values. Negative/nonfinite/unsafe or fractional counts,
invalid measurement shapes and impossible ratios are rejected. Position preserves
the source aggregate and accepts valid positions from 1 upward. Quality and
freshness are independent, stale values remain visible, and a recent unrelated
source sync cannot refresh an old metric observation. Existing FE-020 date/value/
freshness helpers are reused without modifying that feature's implementation.

Top queries have separate identity/window/receipt metadata and independent
loading/error/empty/unavailable states. Invalid/duplicate row identities cannot
become a valid table. Cell values are individually validated and localized.
No table total or average is calculated. The absence of top rows does not erase
aggregate metrics; the presence of rows does not manufacture aggregate metrics.
Row finality copy describes only the returned rows, not population completeness.

Private fixture scenarios preserve the same CTR observation across the existing
overview and the new section. Changing search scenarios never modifies the
production injector. Stale Search Console metadata ends on October 10 with receipt
at October 11 08:00 UTC, after the measured days and 73 hours before the fixed
review clock. Other sources retain independent metadata. Top fixture counts remain
a subset of their associated aggregate even for zero and custom-window scenarios.
This fixture generation is not a product extrapolation or population estimate.

## Review and visual behavior

Local page: <http://127.0.0.1:3000/ui-review/websites/dashboard?search=mixed>.
Use `search=valid|mixed|zero-denominator|partial|stale|loading|error|no-totals|empty-rows|rows-error|comparison`.
Unknown/repeated selectors fall back to valid; changing site resets all scenarios.
The existing private review notice explains deterministic sample data and resets.
Public query flags cannot enable this section, grant access or create data.

Cards use the existing 1 → 2 at sm → 4 at lg grid, rounded-2xl brand-border surfaces,
30px/40px values, semantic h2/h3 headings/dl and textual status labels. Loading
respects reduced motion; errors have alert semantics. Source brands/timezone use
LTR isolation within Persian RTL content. The separate query Card uses the existing
horizontal-scroll Table, text-start column headers, caption and wrapped mixed-text
queries. No global color/font/shell/primitive or earlier-page design change was made.
Design-system consistency is preserved without deviation.

## Executed checks

Runtime: Node 24.19.0 selected first on PATH, pnpm 11.25.0, Playwright 1.62.1,
installed Chrome 155.0.8059.40. Default bundled Chromium was not downloaded/run.
The existing opted-in server on port 3000 was reused and preserved. Temporary
Playwright config imports the repository settings, changing only server reuse,
baseURL and output paths. Repository test configuration is unchanged.

| Command/check | Actual result |
| --- | --- |
| Initial desktop `dashboard-search.spec.ts` | Meaningful Red: Search Performance heading absent |
| Initial mobile/desktop smoke tests | 2/2 passed |
| Initial direct TypeScript | Found a redundant already-narrowed union check; fixed without suppression |
| Expanded search suite | 20 passed, 2 failed: reload test matched the old repeated selector URL; changed the assertion to require exactly one selected query value and rendered state before reload |
| Final `pnpm lint` | Passed without diagnostics |
| Final `pnpm exec tsc --noEmit --incremental false` | Passed, including repetition after restoring generated route-type reference |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-022.config.ts dashboard-search.spec.ts dashboard-traffic.spec.ts dashboard-kpi.spec.ts dashboard-shell.spec.ts` | 88/88 passed in 1.9m; no retries/skips/failures |
| `UI_REVIEW_ENABLED=1 pnpm build` in sandbox | Failed downloading existing Vazirmatn/Geist Mono Google Fonts |
| Same build with allowed network access | Passed compilation, TypeScript, static generation and route assembly |
| `node /private/tmp/datano-fe-022-production.cjs` | Passed manifest, server/client JS marker scans, 30 HTTP/RSC checks, guest query/storage/navigation at 390/1440px and no-JS |
| `node /private/tmp/datano-fe-022-visual.cjs` | Passed focused final 320px dark Card/table and desktop valid captures; inspected manually |
| Content/hash/diff audit against 376-file baseline | Only listed task files changed; no deletions; only FE-022 Backlog status updated |

Eleven new cases run in both viewport projects. Pure tests cover zero/missing/
undefined/invalid values, source position, exact identity/window/scope, duplicates,
immutability, 72-hour boundary, malformed/future timestamps and provisional/partial
quality. Browser tests cover aggregate values versus different row rates/positions,
independent loading/errors, no-totals with rows, empty rows with valid aggregates,
zero reports, stale/partial data, CTR consistency, comparison/keyboard, custom Apply
versus drafts, unavailable exact queries, denied permission, selector/reload/site
reset, no API/cookie/storage effects and guest access. Existing FE-019/020/021
tests were preserved and all passed in the final run.

Responsive checks cover 320/390/768/1440px, light/dark, Vazirmatn/RTL and 200% text
without page overflow. The table retains local scrolling. Final manual inspection
covered desktop valid/mixed data, 320px dark incomplete Card and subset table.
Generated screenshots/scripts/results remain under `/private/tmp/datano-fe-022-*`.

Production checks set UI_REVIEW_ENABLED=1 intentionally; review paths still return
404 for HTML and RSC. Private search/fixture/selector markers are absent from both
server and browser JS. Guest queries show no analytical sample controls, cookie,
storage or API effects. The owned temporary production server on 3009 was stopped.
Build's only next-env.d.ts change was verified as its generated route reference,
restored to the pre-task value, and followed by a successful TypeScript check.

Real provider, ingestion, database and authenticated reporting integration remains
later Backlog work (including FE-037); no production analytical readiness or
physical-device/assistive-technology certification is claimed by these UI checks.

## Files and completion

Created:

- `Frontend/components/feature/analytics/SearchPerformance/index.tsx`
- `Frontend/components/feature/analytics/SearchPerformance/DatanoSearchPerformance.tsx`
- `Frontend/components/feature/analytics/SearchPerformance/content.ts`
- `Frontend/components/feature/analytics/SearchPerformance/measurements.ts`
- `Frontend/components/feature/internal/DashboardReview/search-fixtures.ts`
- `Frontend/tests/e2e/dashboard-search.spec.ts`
- `Frontend/docs/validation/FE-022-search-performance.md`

Edited:

- `Frontend/components/feature/internal/DashboardReview/DevelopmentDashboardReview.tsx`
- `Frontend/components/feature/internal/DashboardReview/index.tsx`
- `Frontend/docs/design-system.md`
- `Frontend/README.md`
- `docs/backlog.md` — FE-022 checkbox only, after successful validation

No changes to dependencies, backend, guides, APIs, public routes, layouts, shared
primitives, KPI/traffic implementation or previous tests. No Git operations.
FE-023 and later tasks remain unchanged.

Suggested commit: `feat(frontend): implement FE-022 Search Performance`
