# FE-023 — Google Ads Performance

Validated 2026-10-14. Scope: FE-023 only, dependent on completed FE-020.
No Git operation, new dependency, backend/API integration or FE-024 work.

## Outcome and acceptance

| Criterion | Implemented and verified |
| --- | --- |
| Required metrics | Independent cost, clicks, conversions and CPC Cards identify Google Ads and retain source/account/window metadata |
| Original currency | The selected account's ISO currency is preserved; monetary observations must match it; no automatic exchange, rial/toman assumption or cross-currency sum |
| Micros/precision | Cost micros are parsed as nonnegative signed-int64 decimal strings and retained in exact rational arithmetic; display rounding occurs only after division/derivation |
| Fractional conversions | Conversion counts retain valid decimal values, separate from GA4 keyEvents |
| CPC | Cost divided by compatible clicks; zero clicks is undefined, displayed as `—` with a reason |
| ROAS | Compatible conversion value divided by positive cost; requires the same site/account/window/currency/report/basis/coverage/receipt |
| Missing/incompatible | Missing monetary inputs/currency and incompatible ratio inputs show `—`; zero cost does not produce ROAS; zero value with positive cost produces real zero ROAS |
| Independent states | Zero, unavailable, incomplete/provisional/thresholded, stale, loading and error remain textual and independently represented |
| Applied periods | Existing shell owns default/custom/comparison state; draft edits cannot replace displayed values; unmatched exact queries never reuse another window |
| Design | Persian RTL/Vazirmatn, explicit LTR currency codes, existing brand tokens, Card/Lucide patterns, responsive and 200% text validation |
| Production | Private review excluded from manifest; HTML/RSC 404 and private markers absent from server/client JS even with review flag enabled |

Product meaning follows [MVP](../../../docs/Datano_MVP.md),
[Backlog](../../../docs/backlog.md), [UX](../../../docs/datano-ux-pages-.md)
and [Design System](../design-system.md). Fields were checked against official
[Google Ads Metrics](https://developers.google.com/google-ads/api/reference/rpc/v22/Metrics)
and [Customer metadata](https://developers.google.com/google-ads/api/reference/rpc/v22/Customer).
Cost uses micros, conversions/conversion value are distinct metrics, and account
currency/timezone are explicit metadata. These references do not select an SDK,
production API version or endpoint contract for this UI task.

## Architecture and arithmetic

`analytics/AdsPerformance` separates pure UI, concrete injector, Persian content
and pure selection/measurement helpers. Local presentation inputs carry website,
Ads source, selected resource, exact window, coverage, currency, receipt, report
identity and measurement basis. The existing shell overview callback supplies
applied period/comparison. Ads source currency is a feature-specific extension of
the existing presentation context, not a new global/API model.

Monetary micros use BigInt rational arithmetic without converting int64 values
to lossy JavaScript numbers. The current TypeScript target is preserved by using
BigInt constructors. Clicks accept safe nonnegative integers; conversions and
conversion value accept finite nonnegative decimals. Decimal/scientific number
representations are converted to rational values for derivation. Invalid shapes,
nonfinite/negative inputs and out-of-int64 micros are rejected. No decimal library
or dependency was added.

Display uses explicit Persian numbers, BigInt integer grouping and currency's
standard fraction digits from Intl. Ratios are computed before formatting. Tiny
positive values have a less-than label, so they cannot appear to be a measured
zero. USD/EUR/JPY/KWD are tested; original ISO codes remain visible and isolated
LTR. No conversion, default currency substitution or mixed-account summation.

Observations must match site, source, account, metric and exact window. Missing
or duplicate records are not selected arbitrarily. Ratios additionally require a
matching nonempty report identity/basis, currency, received coverage and receipt
timestamp. This prevents division across snapshots, time coverage or conversion
date versus interaction-date bases. Unknown basis/coverage is insufficient for a
ratio. The UI explains incompatibility without exposing report IDs or engineering
configuration to product users.

CPC uses cost/clicks; cost zero with positive clicks gives real zero CPC, while
clicks zero is undefined. ROAS uses conversion value/cost and requires positive
cost; conversion value zero is valid and yields zero ROAS. Conversion counts
are not used as monetary value. A conversion-count error does not conceal an
independently valid value-based ROAS. Missing monetary currency affects monetary
and ratio values, while valid clicks/conversion counts remain independently visible.

Quality and freshness are independent of numerical value. Compatible partial
snapshots retain a partial label; stale values remain visible. Derived metadata
only shows shared coverage/receipt when both inputs agree; it never copies one
input's receipt as a successful ratio receipt when they differ. The most relevant
input failure is propagated to the derived metric. No recommendation eligibility
or rule evaluation is introduced.

## Fixtures and design

Review URL: <http://127.0.0.1:3000/ui-review/websites/dashboard?adsMetric=mixed>.
The new `adsMetric` selector is separate from existing source-state `ads`.
Allowlisted scenarios: `valid|eur|jpy|kwd|mixed|zero|zero-clicks|zero-value|missing-value|currency-mismatch|basis-mismatch|coverage-mismatch|unknown-currency|partial|stale|loading|error|comparison`.
Unknown/repeated values fall back to valid; changing site resets all scenarios.
Currency/role/cost query parameters do not manufacture reports or grant access.

Private fixtures provide USD cost 1000, clicks 400, conversions 25.5, CPC 2.5
and ROAS 3 from conversion value 3000. Explicit custom snapshots exist only for
2026-09-23–2026-10-10, with cost 250 and conversions 12.5. Comparison has explicit
prior observations and matching source coverage. Empty source success supplies
actual zeros; unavailable source/query data does not. Stale Ads ends on October 10
with receipt at October 11 08:00 UTC, after measured days and 73 hours before the
fixed review clock. Other sources retain their independent metadata.

Four primary Cards reuse the 1 → 2 at sm → 4 at lg grid. A separate ROAS Card
and short explanatory panel describe the conditional ratio and distinguish it
from net profit. Existing rounded-2xl surfaces, 30px/40px values, brand-ink/soft,
semantic headings/dl, textual quality/freshness, reduced-motion loaders and alert
errors are retained. Megaphone/Coins/MousePointerClick/Flag/TrendingUp use the
existing icon family; no provider logo, status palette, font, shell or primitive
change. Design-system consistency is preserved without deviation.

No fetching hook, API request, polling, session success or storage mutation is
added. Public guest dashboard behavior is unchanged. Real Ads ingestion/report
integration remains later Backlog work; sample data is private UI acceptance.

## Executed validation

Node 24.19.0 selected first on PATH, pnpm 11.25.0, Playwright 1.62.1 and installed
Chrome 155.0.8059.40. No bundled Chromium download/run. The existing opted-in
development server on port 3000 was reused and preserved. Temporary Playwright
config imports repository settings with local baseURL/reuse/output overrides;
repository tooling is unchanged.

| Command/check | Actual result |
| --- | --- |
| Initial desktop `dashboard-ads.spec.ts` | Meaningful Red: Ads section heading absent |
| Initial mobile/desktop smoke tests | 2/2 passed |
| Expanded Ads suite | 24/24 passed in 30.5s |
| Final `pnpm lint` | Passed, no diagnostics |
| Final `pnpm exec tsc --noEmit --incremental false` | Passed, including repetition after restoring generated route reference |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-023.config.ts dashboard-ads.spec.ts dashboard-search.spec.ts dashboard-traffic.spec.ts dashboard-kpi.spec.ts dashboard-shell.spec.ts` | 112/112 passed in 2.5m; no retries/skips/failures |
| `UI_REVIEW_ENABLED=1 pnpm build` in sandbox | Failed downloading existing Geist Mono/Vazirmatn Google Fonts |
| Same build with allowed network access | Passed compilation, TypeScript, static generation and route assembly |
| `node /private/tmp/datano-fe-023-production.cjs` | Passed manifest, server/client marker scans, 34 HTTP/RSC checks, guest query/storage/navigation at 390/1440px and no-JS |
| `node /private/tmp/datano-fe-023-visual.cjs` | Passed focused final 320px dark cost/ROAS and desktop valid captures; manually inspected |
| Baseline content/hash/diff audit | Only listed task files changed; no deletion, dependency change or unrelated Backlog update |

Twelve new cases run in both viewport projects. They cover full int64 monetary
precision, rounding across currency fraction digits, tiny nonzero values,
fractional/scientific conversions, zero/undefined/missing/invalid values, exact
identity/window/provenance/currency/basis/coverage/receipt compatibility, duplicate
records, immutable inputs, partial/stale/unknown freshness, independent loading/
error, original currency preservation, zero-value ROAS, comparison/keyboard,
custom Apply versus drafts, missing exact queries, denied permission, selector
reload/reset, guest isolation and no API/cookie/storage effects. Existing
FE-019/020/021/022 tests were preserved and passed in the final combined run.

Responsive checks cover 320/390/768/1440px, both themes, explicit Vazirmatn/RTL,
LTR currency codes and 200% text without page overflow. Final manual inspection
covered desktop mixed/valid data and narrow dark cost/ROAS Cards. Screenshots,
scripts and results remain in `/private/tmp/datano-fe-023-*`, not project source.

Production checks intentionally enable UI_REVIEW_ENABLED=1; review routes remain
404 for HTML/RSC and Ads/private fixture markers are absent from server/client JS.
Guest query parameters expose no sample Cards or private controls. The owned
production server on port 3009 was stopped after verification. Build's only
next-env.d.ts change was verified as the generated route reference, restored to
baseline, then followed by a passing TypeScript check.

Provider/authenticated-report/database/ingestion tests belong to later tasks and
were not run. These checks establish local UI acceptance, not live Ads reporting
readiness or physical-device/assistive-technology certification.

## Files and completion

Created:

- `Frontend/components/feature/analytics/AdsPerformance/index.tsx`
- `Frontend/components/feature/analytics/AdsPerformance/DatanoAdsPerformance.tsx`
- `Frontend/components/feature/analytics/AdsPerformance/content.ts`
- `Frontend/components/feature/analytics/AdsPerformance/measurements.ts`
- `Frontend/components/feature/internal/DashboardReview/ads-fixtures.ts`
- `Frontend/tests/e2e/dashboard-ads.spec.ts`
- `Frontend/docs/validation/FE-023-google-ads.md`

Edited:

- `Frontend/components/feature/internal/DashboardReview/DevelopmentDashboardReview.tsx`
- `Frontend/components/feature/internal/DashboardReview/index.tsx`
- `Frontend/README.md`
- `Frontend/docs/design-system.md`
- `docs/backlog.md` — only FE-023 checkbox after successful checks

The 383-file pre-task content/hash snapshot preserves all prior changes under
the retained no-Git restriction. Dependencies, backend, guides, APIs, public routes,
layouts, primitives, previous analytical implementation and previous tests are
unchanged. No stage, commit or push. FE-024 and later tasks remain unchanged.

Suggested commit: `feat(frontend): implement FE-023 Google Ads Performance`
