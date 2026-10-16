# Inline recommendation evidence — FE-024 / FE-025 amendment

Validated 2026-10-16. This report supersedes the standalone navigation described
in `FE-025-recommendation-detail.md`; that report records the earlier implementation.
The starting workspace already contained uncommitted FE-025 work and the unrelated
`.pnpm-store/`. Those changes were preserved. The comparison baseline for this
amendment is the source and browser capture taken before this request's edits,
not Git HEAD (which predates FE-025).

## Delivered behavior and preservation

- Every existing recommendation card retains its original article text, icons,
  classes, colors, padding and content dimensions. One shared outline button,
  «مشاهده دلیل و شواهد», is appended below that article. The button necessarily
  adds its own height and spacing; no claim of identical outer card height to
  the version without a button is made. Closing restores the new closed height.
- The original title remains a styled link. Ordinary activation toggles its own
  panel in place; its destination supports opening/bookmarking the same card.
  The explicit button supports Enter/Space, `aria-expanded`, `aria-controls`,
  and a labeled region. Closed detail bodies are unmounted.
- Reason and analytical evidence appear first, followed by recorded metadata,
  rule/version, unsaved tracking preview and history. Existing FE-025 formatting,
  evidence windows, missing values and error/empty/quality states are reused.
- Cards maintain independent open state and independent private preview state.
  Closing/reopening resets that card's unsaved preview. Opening/closing another
  card does not change it. A site switch resets state and never reuses another
  site's detail. Filtering, source evaluation states, counts, links and the
  original private review toolbar remain available.
- Legacy detail paths redirect to the list with `recommendation` and an anchor.
  A matching private card opens and scrolls into view. An incompatible source
  filter is cleared so it cannot hide the requested card. Unknown targets and
  invalid site identity do not silently open a different recommendation.
- No dashboard, shared layout, global CSS, dependency, API or backend change.
  Product routes retain the existing access gate. Private fixtures and preview
  controls are excluded from production; no persistence, request, cookie or
  browser storage is introduced. Real data integration remains pending.
- Backlog is byte-identical to this amendment's starting snapshot. No task was
  started or status changed. No Git stage, commit, push or branch mutation ran.

## Local review

Development server: `http://localhost:3000`, with `UI_REVIEW_ENABLED=1`.

- List: <http://localhost:3000/ui-review/websites/recommendations>
- All-source closed sample: <http://localhost:3000/ui-review/websites/recommendations?site=report-ready&scenario=all-sources>
- Open GA4 card: <http://localhost:3000/ui-review/websites/recommendations?site=report-ready&scenario=ready&recommendation=UI_REVIEW_RECOMMENDATION_GA4>
- Legacy sample: <http://localhost:3000/ui-review/websites/recommendations/UI_REVIEW_RECOMMENDATION_ADS?site=report-ready&scenario=all-sources>
- Product access gate: <http://localhost:3000/websites/report-ready/recommendations/record-one>

## Validation

Commands run from `Frontend/`, using the installed Node/pnpm runtime and Chrome.
The temporary Playwright config imports the checked-in config, keeps its two
mobile/desktop projects, uses the already-running port 3000 server, and disables
only a second server startup. No dependencies or test framework were installed.

| Command / check | Actual result |
| --- | --- |
| `pnpm lint` | Passed |
| `pnpm exec tsc --noEmit --incremental false` | Passed |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe024.playwright.config.ts recommendation-inline.spec.ts recommendation-detail.spec.ts recommendations.spec.ts` | 48 passed: initial 4 inline cases, 20 detail cases, 24 original list cases |
| Same command with `recommendation-inline.spec.ts dashboard-redesign.spec.ts` | 22 passed: expanded 8 inline cases and 14 unchanged dashboard regressions |
| Same command with final `recommendation-inline.spec.ts` | 8 passed after final viewport/screenshot assertions |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed after the existing Google Fonts network fetch required an authorized outside-sandbox retry |
| `PLAYWRIGHT_CHANNEL=chrome node tests/production/recommendations.mjs` | Passed: manifest, 22 client bundles, 12 HTTP/RSC responses, legacy redirects and access gate with JavaScript enabled/disabled |
| `git diff --check`, turn-baseline scope/content review | Passed |

There are **66 distinct passing cases** across the final relevant suites:
8 inline, 20 detail, 24 list and 14 dashboard. They ran in the batches above,
not as one 66-case invocation. Existing state tests cover no recommendations,
insufficient data, errors, incomplete/stale data, source filters and site changes.
Detail regressions retain missing evidence/rule/history, recorded snapshots,
preview isolation, dark mode, responsive sizes and 200% text checks.

TDD: characterization first captured the approved article content and computed
styles at 390/1440px. The new interaction test failed on the absent disclosure
button before implementation, then passed. The permanent golden compares exact
article text, dimensions, child classes/dimensions and SVG markup; it excludes
only the newly appended disclosure. No golden-generation bypass remains.

Manual in-app browser review confirmed in-place opening, unchanged URL and
independent cards. Screenshots: `/private/tmp/datano-inline-before-390.png`,
`/private/tmp/datano-inline-before-1440.png`,
`/private/tmp/datano-inline-closed-390.png`,
`/private/tmp/datano-inline-closed-1440.png`,
`/private/tmp/datano-inline-open-mobile.png`,
`/private/tmp/datano-inline-open-desktop.png`.
The previously documented shared-header limitation at 320px/200% is unchanged
and outside this amendment. Backend integration/persisted tracking were neither
implemented nor represented as tested.

## Files changed by this amendment

Link labels below identify repository-relative paths. This inventory distinguishes
this amendment from earlier uncommitted FE-025 changes visible in Git status.

1. [Frontend/components/feature/recommendations/RecommendationList/index.tsx](/Users/azin/Documents/Datano/Frontend/components/feature/recommendations/RecommendationList/index.tsx)
2. [Frontend/components/feature/recommendations/RecommendationList/content.ts](/Users/azin/Documents/Datano/Frontend/components/feature/recommendations/RecommendationList/content.ts)
3. [Frontend/components/feature/recommendations/RecommendationList/RecommendationListController.tsx](/Users/azin/Documents/Datano/Frontend/components/feature/recommendations/RecommendationList/RecommendationListController.tsx)
4. [Frontend/components/feature/recommendations/RecommendationList/navigation.ts](/Users/azin/Documents/Datano/Frontend/components/feature/recommendations/RecommendationList/navigation.ts)
5. [Frontend/components/feature/recommendations/RecommendationDetail/index.tsx](/Users/azin/Documents/Datano/Frontend/components/feature/recommendations/RecommendationDetail/index.tsx)
6. [Frontend/components/feature/recommendations/RecommendationDetail/content.ts](/Users/azin/Documents/Datano/Frontend/components/feature/recommendations/RecommendationDetail/content.ts)
7. [Frontend/components/feature/recommendations/RecommendationDetail/RecommendationDetailController.tsx](/Users/azin/Documents/Datano/Frontend/components/feature/recommendations/RecommendationDetail/RecommendationDetailController.tsx)
8. [Frontend/components/feature/internal/RecommendationListReview/DevelopmentRecommendationListReview.tsx](/Users/azin/Documents/Datano/Frontend/components/feature/internal/RecommendationListReview/DevelopmentRecommendationListReview.tsx)
9. [Frontend/components/feature/internal/RecommendationDetailReview/InlineRecommendationDetailReview.tsx](/Users/azin/Documents/Datano/Frontend/components/feature/internal/RecommendationDetailReview/InlineRecommendationDetailReview.tsx) (new)
10. [Product legacy detail redirect](</Users/azin/Documents/Datano/Frontend/app/(product)/(workspace)/websites/[websiteId]/recommendations/[recommendationId]/page.tsx>)
11. [Private legacy detail redirect](</Users/azin/Documents/Datano/Frontend/app/ui-review/websites/recommendations/[recommendationId]/page.review.tsx>)
12. [Frontend/tests/e2e/recommendations.spec.ts](/Users/azin/Documents/Datano/Frontend/tests/e2e/recommendations.spec.ts)
13. [Frontend/tests/e2e/recommendation-detail.spec.ts](/Users/azin/Documents/Datano/Frontend/tests/e2e/recommendation-detail.spec.ts)
14. [Frontend/tests/e2e/recommendation-inline.spec.ts](/Users/azin/Documents/Datano/Frontend/tests/e2e/recommendation-inline.spec.ts) (new)
15. [Frontend/tests/e2e/fixtures/recommendation-list-closed-baseline.json](/Users/azin/Documents/Datano/Frontend/tests/e2e/fixtures/recommendation-list-closed-baseline.json) (new)
16. [Frontend/tests/production/recommendations.mjs](/Users/azin/Documents/Datano/Frontend/tests/production/recommendations.mjs)
17. [Frontend/docs/design-system.md](/Users/azin/Documents/Datano/Frontend/docs/design-system.md)
18. [docs/datano-ux-pages-.md](/Users/azin/Documents/Datano/docs/datano-ux-pages-.md)
19. [Frontend/docs/validation/recommendation-inline-evidence.md](/Users/azin/Documents/Datano/Frontend/docs/validation/recommendation-inline-evidence.md) (new)
