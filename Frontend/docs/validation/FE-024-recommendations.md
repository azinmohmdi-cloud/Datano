# FE-024 — Independent site recommendations list

Validated 2026-10-15. The user's final decision replaces the previous UX placement
inside the dashboard. This task changes no FE-019–FE-023 dashboard code or controls.

## Delivered behavior

| Acceptance | Evidence |
| --- | --- |
| Independent site page | `/websites/[websiteId]/recommendations` uses the existing SiteLayout and ProductLayout |
| Central list | One ordered list across sources; stable descending priority and native source filter |
| Required fields | Title, short action summary, source, textual priority and read-only status on each row |
| Optional sources | Default fixture has two recommendations and unconnected Ads; a single-source scenario has exactly one item; no minimum count or evaluation engine |
| Empty explanations | Successful evaluation with no matching condition differs from insufficient, stale, incomplete, provisional, disconnected, pending, source-error and revoked-access states |
| Partial failure | Valid rows remain visible alongside another source's failure |
| Page states | Loading, list failure, forbidden access and unverified ownership do not render rows or a successful-empty claim |
| Site isolation | Route identity passed to the product injector; controller excludes mismatched website IDs and resets filter state by site identity |
| Persian/RTL | Inherited Vazirmatn, Persian numerals, semantic headings/list, labeled 48px filter, explicit LTR domain/source names and textual states |
| Private fixtures | Opt-in development-only `.review.tsx` route; fixture inputs never enter the product import graph |
| FE-025 boundary | Detail URL builder reserved; no detail page, dead detail link, history/evidence UI or tracking mutation |

## Local review

- Existing development server: `http://localhost:3000` with `UI_REVIEW_ENABLED=1`.
- Default review: `/ui-review/websites/recommendations`.
- Source examples: `?scenario=single`, `?scenario=all-sources`, `?scenario=partial`.
- Empty/quality examples: `?scenario=none`, `?scenario=insufficient`, `?scenario=quality`.
- Other states: `source-error`, `pending`, `permission`, `loading`, `error`,
  `forbidden`, `unverified` through the private scenario selector/query.
- Private site selector: `report-ready` / `report-empty`. Navigation from this
  new page preserves that sample site when opening existing review destinations.
- Product route: `/websites/<websiteId>/recommendations`; it displays the existing
  access-state pattern, without accepting query flags as authorization.

The private tools are initially collapsed and explicitly identify all content as
non-real fixtures. No API, data fetching, rule evaluation, auth/session/storage
mutation, backend change, dependency or global style is introduced.

## Architecture and future integration

`RecommendationList/index.tsx` is pure presentation with locally defined UI props,
translations and callbacks. `RecommendationListController.tsx` maps an injected
snapshot to that UI, filters locally and does not mutate its input. The source
filter becomes enabled after hydration. `model.ts` is a hand-maintained view input,
not an API schema. Its read-only `new` / `reviewing` / `reviewed` status vocabulary
is illustrative presentation vocabulary; future adapters must map the actual
backend contract rather than inferring a persistence enum or transitions from it.

`DatanoRecommendationList.tsx` is the product injector boundary; it imports no
private fixture. FE-044 will connect trusted owner/site data through the real
backend/generated client and a site-scoped data layer. FE-025 owns detail/history
and tracking UX; FE-045 owns persisted tracking integration. The reserved detail
path is `/websites/[websiteId]/recommendations/[recommendationId]` and currently 404s.

The new neutral page surface, compact Compass header, brand-soft domain strip,
rounded-2xl central Card, restrained priority accent and quieter source-state
panels follow the Design System. No visual-system deviation is required.

## Validation

Runtime: bundled Node 24.19.0, pnpm 11.25.0, installed Chrome via
`PLAYWRIGHT_CHANNEL=chrome`. All commands run from Frontend with bundled runtime
directories on PATH.

- `pnpm lint` — passed.
- `pnpm exec tsc --noEmit --incremental false` — passed.
- `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe024.playwright.config.ts recommendations.spec.ts`
  — 24 passed, mobile and desktop.
- `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe024.playwright.config.ts recommendations.spec.ts dashboard-redesign.spec.ts`
  — all 14 dashboard regression cases passed; the initial two new no-JavaScript
  cases had an ambiguous multi-row locator, subsequently corrected and passed
  in the complete 24-case FE-024 run above.
- `UI_REVIEW_ENABLED=1 pnpm build` — passed with the new dynamic product route and
  no private review routes. The sandbox attempt could not fetch existing Google
  Fonts resources; the authorized outside-sandbox build succeeded.
- `PLAYWRIGHT_CHANNEL=chrome node tests/production/recommendations.mjs` — passed:
  production manifest, 22 client bundles, 10 HTTP/RSC responses, missing detail
  route, product access and login with/without JavaScript. The script stopped
  only its own temporary production server on port 3101.
- `git diff --check` and scoped diff inspection — passed; no dashboard changes.

The existing server occupies `.next/dev` on port 3000. The temporary Playwright
config imports the checked-in config, keeps both projects and their settings,
sets baseURL to `http://127.0.0.1:3000`, uses the repository test/output directories
and disables webServer startup. It preserves the user's running server. The
checked-in config can otherwise run these same tests on its usual port 3100 when
no other dev server owns that build directory.

TDD evidence: the central-list test failed before implementation because the
new route/heading did not exist, then passed after implementation. Validation
also caught unexpected ordering of tied priorities, an icon component lint diagnostic, a hydration
focus race and two test synchronization/locator issues; these were corrected.

Manual review: inspected desktop and narrow layout in the in-app browser.
Automated layout coverage includes 320/390/768/1440px, both token themes and 200%
root text size. The unchanged shared header has pre-existing page overflow at
320px/200%, reproduced on `/websites`; the new feature itself fits and does not
increase that baseline. Whole-page 390px/200% checks pass. Shared header changes
are outside this task and were not made. This limitation is not claimed fixed.

No Git mutation, commit, backend integration, FE-025 implementation or unrelated
Backlog status change is part of this task.

FE-024 is complete and checked in Backlog; FE-025 remains unchecked.
