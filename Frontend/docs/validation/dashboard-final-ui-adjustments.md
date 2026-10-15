# Dashboard final UI adjustments — FE-019 through FE-023

Validated 2026-10-15. This is the user's scoped amendment to the approved
[dashboard redesign](dashboard-redesign.md), not another redesign or new feature
task. The requested changes concern composition and information placement only.

## Delivered changes

- Site selection is a separate Card containing the same selector, selected
  hostname and ownership state. The period Card contains the same range mode,
  comparison, explanations, custom Jalali form, validation, Apply, applied range
  and status notice. At lg the Cards have equal width, site on the right and
  period on the left. items-start allows independent content heights. On mobile
  site comes first, then period. Controller state and callbacks are unchanged.
- The cross-source overview, duplicate Search CTR card and independent three-source
  freshness list are removed from the rendered dashboard. No replacement overview
  is introduced. CTR remains in Search Console; receipt, coverage, freshness and
  source states remain available in the related metric/chart disclosures and the
  existing source-period area.
- The existing KPIOverview module is reused for the GA4 section with exactly
  three supported aggregate metrics: totalUsers, sessions and keyEvents. Their
  values, definitions, comparison, zero/missing/error/quality/freshness handling
  and metric disclosures retain the existing implementation. A fourth metric
  was not invented. On desktop the three Cards share one row; at intermediate
  widths the third spans the second row rather than leaving an empty half-row.
- The complete, unchanged traffic-chart component is composed below those GA4
  Cards through a presentation slot. Chart metric selection, dates, legend,
  tooltip, comparison, disclosures and daily table retain their existing logic.
- Search's four metric Cards and top-query Card markup/content are unchanged.
  Its chart/table container becomes a single-column grid: full-width chart then
  the natural-height query Card, separated by the existing 1rem gap. This removes
  the unoccupied lower column without stretching the query Card or adding content.
- GA4, Search and Ads plots now share the same available width and existing
  20rem height. Chart card heights remain content-driven. No chart renderer,
  chart type, series, source adapter or measurement logic was modified.
- GA4 → Search → Ads is the source-section order. Ads Cards, valid ROAS behavior,
  its chart, bottom source information/actions, navigation, background, shared
  header/footer, font, colors and logo are unchanged.

This follows the existing Design System: shared Card primitives, existing spacing,
blue/purple tokens, icons, native disclosures, Persian numerals, Jalali dates,
Vazirmatn and RTL. There is no palette or component-style deviation.

## Architecture and data boundaries

DashboardReport has three presentation slots: analytics, search and advertising.
The existing concrete KPI injector receives a chart slot, while daily chart data
continues through its original injector. The shell's site block was separated
from its period block; its controller and public selection inputs are unchanged.
No domain/API types were added or changed, no fetching was moved into pure UI,
and no new route, dependency, global CSS or backend code was introduced.

Private review scenarios, fixtures and data-selection chains are unchanged.
The existing future integration requirements remain in effect: operational report
endpoints and generated-client adapters are separate backend/integration work.
This UI amendment neither implements nor guarantees that future connection.

## Validation

Runtime: bundled Node 24.19.0 and pnpm 11.25.0; Chrome 155.0.8059.40.
Commands run from Frontend with the bundled Node directory first on PATH.

| Check | Result |
| --- | --- |
| pnpm lint | Passed |
| pnpm exec tsc --noEmit --incremental false | Passed, including the final post-build check |
| UI_REVIEW_ENABLED=1 pnpm build | Passed; 16 static pages generated, private review absent from route list |
| Seven dashboard specs, mobile and desktop | 132 passed, zero failures, 4.0 minutes |
| Production isolation | Passed on the final build: 38 HTTP/RSC checks, manifest/bundle scans and guest browser checks |
| Layout/interaction | Focused new acceptance test passed in mobile and desktop |
| Diff/format | git diff --check and final scope audit passed |

The new acceptance test first failed on the missing independent site Card, before
implementation. It then passed with the split Cards, three GA4 KPIs, removed
overview/freshness list, source order, equal plot dimensions and a gap-free Search
stack. It measures 320, 390, 768, 1280 and 1440px viewports. The mobile third-card
span is also asserted. Existing responsive checks cover both themes, 200% text,
expanded details, chart keyboard/touch, custom dates, site changes and source states.

The first complete run passed 128/132 checks. Four cases (two tests × two projects)
failed because the new GA4 section heading also matched the preserved source-period
heading. Those test locators were scoped to the GA4 section without changing product
headings, removing coverage or weakening an assertion. The final full run follows
that correction and the final mobile Card layout adjustment and passed all 132 cases.

The final suite command is:

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test \
  --config=/private/tmp/datano-final-ui.config.ts \
  dashboard-kpi.spec.ts dashboard-search.spec.ts dashboard-ads.spec.ts \
  dashboard-traffic.spec.ts dashboard-shell.spec.ts dashboard-redesign.spec.ts \
  dashboard-trend-data.spec.ts
```

The temporary config reuses the existing opted-in dev server on port 3000, retains
both repository projects, one worker, no retries and 30-second per-test timeout,
and allows 600 seconds for the combined run. For an independent reproduction, omit
that config override and add --global-timeout=600000; the repository config starts
its own dev server on port 3100. Temporary test/screenshot output remains outside
the repository.

Build initially failed in the sandbox while downloading the unchanged Google
Fonts. The authorized network-enabled rerun passed. Sandbox browser/server access
was likewise rerun with authorization. These infrastructure failures are not
counted as successful tests. The build-generated next-env route import was restored
to its pre-task content, with a direct TypeScript check afterward.

Unrelated public-page E2E specs and backend tests were not rerun: their code,
shared layouts, styles and backend behavior are unchanged. The affected dashboard
suite includes public guest-boundary checks; production guest navigation was also
tested separately. No live Google/backend integration result is claimed.

Manual visual review covered the two control Cards, full GA4 section, Search
chart/table stack, mobile GA4 and dark mobile Search. Measured plot containers:

| Viewport | GA4 | Search | Ads |
| --- | --- | --- | --- |
| 1440px desktop | 1166 × 320px | 1166 × 320px | 1166 × 320px |
| 390px mobile | 308 × 320px | 308 × 320px | 308 × 320px |

Production validation scans the manifest and server/client JS for private review,
fixture and new GA4/control markers, checks private HTML/RSC 404 responses even
with UI_REVIEW_ENABLED=1, and verifies the guest dashboard still requires login
without query-based data/auth, storage or API side effects. Its owned temporary
server on port 3009 is stopped afterward; the existing dev server is preserved.

## Files changed

Paths are relative to the workspace root. Seven implementation files:

Final audit: 16 existing files edited, one report created, none deleted. Backlog,
all AGENTS guides, backend, routes, global styles, shared layouts, dependency
files, Ads implementation, all chart renderers/adapters and review fixtures match
the preserved pre-task snapshot. Documentation links and git diff --check pass.

- Frontend/components/feature/analytics/DashboardShell/index.tsx
- Frontend/components/feature/analytics/DashboardReport/index.tsx
- Frontend/components/feature/analytics/KPIOverview/DatanoKPIOverview.tsx
- Frontend/components/feature/analytics/KPIOverview/index.tsx
- Frontend/components/feature/analytics/KPIOverview/content.ts
- Frontend/components/feature/analytics/SearchPerformance/index.tsx
- Frontend/components/feature/internal/DashboardReview/DevelopmentDashboardReview.tsx

Five affected test files:

- Frontend/tests/e2e/dashboard-redesign.spec.ts
- Frontend/tests/e2e/dashboard-kpi.spec.ts
- Frontend/tests/e2e/dashboard-search.spec.ts
- Frontend/tests/e2e/dashboard-traffic.spec.ts
- Frontend/tests/e2e/dashboard-ads.spec.ts

Four existing documentation files and this report:

- Frontend/docs/design-system.md
- Frontend/docs/cookbook/component-development-framework.md
- Frontend/README.md
- docs/datano-ux-pages-.md
- Frontend/docs/validation/dashboard-final-ui-adjustments.md (new)

Backlog IDs, dependencies, acceptance text and checkboxes are unchanged. This is
the explicitly authorized UI amendment of completed FE-019 through FE-023;
no new task or FE-024 work was started. The pre-existing untracked .pnpm-store/
was preserved and is not part of this change. Only read-only Git inspection was
performed; no stage, commit, push or repository-structure change was made.

## Review and suggested commit

[Default dashboard](http://127.0.0.1:3000/ui-review/websites/dashboard) and
[all three comparisons](http://127.0.0.1:3000/ui-review/websites/dashboard?traffic=comparison&search=comparison&adsMetric=comparison).
Review requires development mode and UI_REVIEW_ENABLED=1.

```text
fix(frontend): finalize dashboard layout for FE-019 to FE-023
```

This is a suggestion only. The requested UI scope has no remaining implementation
work; operational backend/report integration remains outside this amendment.
