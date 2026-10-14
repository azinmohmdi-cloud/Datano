# FE-021 — Traffic trend with Recharts

Validated 2026-10-14. Scope: FE-021 only, dependent on completed FE-020.
Work resumed at final validation after interruption; existing implementation was
preserved. No Git operations, backend changes or FE-022 work were performed.

## Outcome and acceptance

| Criterion | Result |
| --- | --- |
| Dependency | Recharts 3.10.1 and its required react-is 19.2.4 peer are pinned in package.json/lockfile; runtime resolution confirms the peer matches React 19.2.4 |
| Persian chart | Persian solar date/numeric ticks, axis captions, series legend and RTL tooltip retain GA4 source, unit and actual dates |
| Chronology | Canonical source civil days increase left to right inside an explicit LTR plot; surrounding page stays RTL/Vazirmatn |
| Small screens | 320/390/768/1440px, light/dark, 200% text, local table scrolling and tooltip viewport bounds passed |
| Empty and zero | Missing/invalid/uncovered days remain null gaps; explicit zero draws a baseline; empty data draws no chart and displays an empty state |
| Interaction | Arrow-key tooltip navigation, Escape, touch/hover, native keyboard table disclosure and applied range/comparison controls passed |
| Isolation | Private review works in development; review routes are absent from the production manifest and return 404 for HTML/RSC even with the review flag enabled |

## Architecture and semantics

`analytics/TrafficOverview` separates pure UI, concrete injector, Persian copy and
pure snapshot helpers. The existing shell's overview callback supplies the applied
period/comparison to both KPI and traffic features. No shell state duplication,
endpoint, fetching hook, storage, authentication success or provider request is
introduced. Public dashboard access-state behavior remains unchanged.

GA4 daily sessions snapshots bind to website, source, selected property, metric and
exact query window. Mismatched/duplicate snapshots are unavailable. Days are sorted
canonically without timezone conversion; duplicate days, invalid counts and missing
coverage become gaps. Only finite, safe, nonnegative integer counts are plotted.
Partial/thresholded/provisional and stale states remain explicit; stale values stay
visible. Daily values are not summed to reconstruct whole-window unique users.

Comparison aligns equal-length windows by relative day and explains the alignment.
Both actual dates remain in tooltip/table. The default missing previous snapshot
is not fabricated. Solid/current and dashed/previous lines distinguish series
beyond color. All chart/tooltip animation is disabled. A semantic table provides
an alternative to plot interaction and contains its own horizontal scroll area.

The private `traffic` selector accepts `valid|empty|gaps|comparison`; unknown or
repeated values fall back to valid. Site changes reset scenarios. Fixture generation
is confined to `internal/DashboardReview/traffic-fixtures.ts`; its daily distribution
is test data, not a production disaggregation algorithm. Explicit default/custom
snapshots share the established source metadata. The comparison scenario expands
fixture coverage and provides explicit prior snapshots. Real reporting remains
FE-037 work; no live provider/session integration is claimed.

Design follows the existing rounded-2xl Card, Activity icon, brand surfaces,
popover tooltip and typography. Scoped series variables reuse brand-blue/purple in
light mode and brand-ink/lilac in dark mode for readable strokes. No new global
palette, font, layout, shared primitive or earlier page redesign was introduced.
The plot reserves 20rem height and flexible width. Design-system consistency is
preserved without an identity deviation.

Recharts APIs were checked against installed types/source and official references:
[ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/),
[Tooltip](https://recharts.github.io/en-US/api/Tooltip/),
[accessibility](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility).
The installed Recharts README requires react-is to match React; runtime
`createRequire(require.resolve("recharts"))` resolves react-is 19.2.4.

## Executed validation

Runtime: Node 24.19.0, pnpm 11.25.0, Playwright 1.62.1, installed Chrome
155.0.8059.40. Commands run from Frontend with the bundled Node directory first
on PATH. No bundled Chromium download or physical-device/assistive-technology
certification is claimed.

| Command/check | Actual result |
| --- | --- |
| Initial desktop traffic test before implementation | Meaningful Red: traffic heading absent |
| Initial chart smoke tests | 2/2 passed |
| Expanded initial traffic suite | 14 passed, 8 failed; test assumptions corrected for zero-height SVG paths, focus selecting the first day, and waiting for route replacement before reload |
| Traffic + KPI + shell suite before interruption | 66/66 passed |
| Resumed `pnpm lint` | Passed without diagnostics |
| Resumed `pnpm exec tsc --noEmit --incremental false` | Passed; repeated after restoring build-generated route-type reference |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-021.config.ts dashboard-traffic.spec.ts dashboard-kpi.spec.ts dashboard-shell.spec.ts` on final code/dependencies | 66/66 passed in 1.5m, no retries/skips/failures |
| `UI_REVIEW_ENABLED=1 pnpm build` in sandbox | Failed downloading existing Geist Mono/Vazirmatn fonts |
| Same build with approved network access | Passed compilation, TypeScript, static generation and route assembly |
| `node /private/tmp/datano-fe-021-production.cjs` | Passed manifest/client isolation, 26 HTTP/RSC checks, guest query/storage/navigation checks at 390/1440px and no-JS |
| Production server JS marker scan | Passed: private dashboard/traffic/fixture markers absent |
| Screenshot inspection | Final desktop light and 320px dark inspected; responsive matrix and enlarged text captured by tests |
| Content/hash audit against pre-task snapshot | Only listed task files changed; no deletions or unrelated dependency removals |

The temporary Playwright config imports the existing repository configuration,
using the opted-in local server on port 3000 and temporary output paths. The server
was restarted after the interruption and remains available for user review.
The owned production test server on port 3009 was stopped after checks.
The production build's generated next-env.d.ts route reference was verified as
the only change in that file and restored to its pre-task value.

Tests cover immutable chronological normalization, leap-day/source-midnight
boundaries, identity/window isolation, duplicates, invalid counts/coverage,
freshness/provisional states, empty versus zero, actual line gaps, keyboard/touch
tooltip behavior, comparison dates/dashes, Apply versus drafts, arbitrary missing
queries, loading/error/permissions, scenario resets and no API/cookie/storage
effects. Existing FE-019/FE-020 tests were preserved. Final visual tests also cover
200% text and keyboard opening of the daily table without page overflow.

## Local review

- Default: <http://127.0.0.1:3000/ui-review/websites/dashboard>
- Two explicit windows: <http://127.0.0.1:3000/ui-review/websites/dashboard?traffic=comparison>
- Missing days: <http://127.0.0.1:3000/ui-review/websites/dashboard?traffic=gaps>
- Empty data: <http://127.0.0.1:3000/ui-review/websites/dashboard?traffic=empty>

These development-only fixtures are not production report data.

## Files and completion

Created:

- `Frontend/components/feature/analytics/TrafficOverview/index.tsx`
- `Frontend/components/feature/analytics/TrafficOverview/DatanoTrafficOverview.tsx`
- `Frontend/components/feature/analytics/TrafficOverview/content.ts`
- `Frontend/components/feature/analytics/TrafficOverview/series.ts`
- `Frontend/components/feature/internal/DashboardReview/traffic-fixtures.ts`
- `Frontend/tests/e2e/dashboard-traffic.spec.ts`
- `Frontend/docs/validation/FE-021-traffic-trend.md`

Edited:

- `Frontend/components/feature/internal/DashboardReview/DevelopmentDashboardReview.tsx`
- `Frontend/components/feature/internal/DashboardReview/index.tsx`
- `Frontend/package.json`
- `Frontend/pnpm-lock.yaml`
- `Frontend/README.md`
- `Frontend/docs/design-system.md`
- `docs/backlog.md` — FE-021 checkbox only, after successful validation

No deletions, stage, commit or push. FE-022 and later tasks remain unchanged.
Suggested commit: `feat(frontend): implement FE-021 traffic trend with Recharts`
