# FE-025 — Recommendation detail, history and preview tracking

Validated 2026-10-15 against FE-024 commit `d22e1bc`. The workspace initially had
only the unrelated untracked `.pnpm-store/`; it was preserved. No Git mutation,
backend code, dashboard code, shared layout/CSS or dependency change was made.

## Delivered behavior

- Product route: `/websites/[websiteId]/recommendations/[recommendationId]`.
- Each FE-024 recommendation title links to its detail. The product destination
  builder encodes both identifiers; private destinations preserve the validated
  sample site, list scenario and selected source. The back link returns to that
  same list context without trusting an arbitrary return URL.
- Detail shows title, priority, recorded status, source/domain, reason, rule
  identifier/version/condition, creation time and rule limitations.
- Evidence is an immutable display snapshot with source civil evaluation and
  comparison windows, resource, timezone, scope/filter basis, quality, receipt
  time and measured values. Missing values render `—`; missing snapshots or
  measurements never produce a fabricated zero or an empty unexplained table.
- History is independently ready/loading/error/empty. Ready events are copied
  and ordered oldest to newest without mutating input. Operational times use
  Tehran; source civil dates use Persian display without timezone shifting.
- Non-real detail data has an always-visible private-review label. Only the
  private injector enables tracking preview. Applying/resetting a preview changes
  component-local state only; it does not rewrite recorded status, rule, creation
  time, evidence or history, and does not add a fake recorded event. Leaving the
  page or reloading resets it. No request, cookie or browser storage is involved.
- Loading, retrieval failure, not-found, mismatched site/record identity, forbidden
  access, unverified ownership, absent evidence/rule data, incomplete/provisional/
  unknown-quality evidence and unavailable tracking remain distinct.
- Product routes retain the existing unauthenticated access pattern. URL flags
  cannot activate fixtures or tracking. Actual authorization, missing-record HTTP
  semantics and persistence await the real backend in FE-044/045 and BE-039/040.
  No endpoint, payload, persistence enum or status transition contract was invented.

## Architecture and files

The App Router page passes both route identities into the product injector.
`components/feature/recommendations/RecommendationDetail/` contains the pure UI,
translations, view-input model, local presentation controller and product injector.
Its model extends FE-024's existing display vocabulary; it is not an API schema.
The controller keys local state by site/record, checks both input identities and
enables controls only after hydration. Preview mode defaults to disabled.

Private fixtures and scenario orchestration live exclusively in
`components/feature/internal/RecommendationDetailReview/`; the guarded
`.review.tsx` entry is excluded from production discovery by the existing config.
The FE-024 list receives a detail destination and an optional validated initial
source. Its source filtering, item counts, states and ordering are retained.

The 1.6:1 desktop reason/evidence and rule/tracking layout stacks on mobile;
history spans the page below. Shared Cards, table scrolling, neutral surfaces,
existing blue/purple tokens, Persian/RTL and Vazirmatn follow the Design System.
There is no design-system deviation and no dashboard entry button in this task.
The previous FE-024 report's absent-detail boundary describes its historical
baseline; this task delivers that previously reserved route.

## Local URLs

- List: `http://localhost:3000/ui-review/websites/recommendations`.
- GA4 detail: `http://localhost:3000/ui-review/websites/recommendations/UI_REVIEW_RECOMMENDATION_GA4?site=report-ready&scenario=ready`.
- GSC detail: `http://localhost:3000/ui-review/websites/recommendations/UI_REVIEW_RECOMMENDATION_GSC?site=report-ready&scenario=ready&source=gsc`.
- Ads detail: `http://localhost:3000/ui-review/websites/recommendations/UI_REVIEW_RECOMMENDATION_ADS?site=report-ready&scenario=all-sources`.
- Example product gate: `http://localhost:3000/websites/report-ready/recommendations/record-one`.

Development review requires `UI_REVIEW_ENABLED=1`. The private detail selector
provides `no-evidence`, `no-measurements`, `no-rule`, `history-empty`,
`history-loading`, `history-error`, `incomplete`, `provisional`, `unknown-quality`,
`missing-values`, `tracking-unavailable`, `loading`, `error`, `forbidden`,
`unverified` and `mismatched` through the `view` query. An unknown record never
falls back to the first recommendation. Sample identities are not authorization.

## Validation

Runtime: bundled Node 24.19.0/pnpm 11.25.0 and installed Chrome. Runtime and pnpm
directories were added to PATH; no package installation was needed. Commands
below run from Frontend.

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed |
| `pnpm exec tsc --noEmit --incremental false` | Passed, including final post-build check |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe024.playwright.config.ts recommendation-detail.spec.ts` | 20 passed, mobile and desktop |
| Same command with `recommendation-detail.spec.ts recommendations.spec.ts dashboard-redesign.spec.ts` | All 24 FE-024 and 14 dashboard regression cases passed; two new snapshot assertions failed due to pre-hydration `innerText` whitespace and were corrected, then passed in the complete final 20-case detail run |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed, both dynamic product routes present and private review routes absent |
| `PLAYWRIGHT_CHANNEL=chrome node tests/production/recommendations.mjs` | Passed: manifest, 22 client bundles, 12 HTTP/RSC checks, list/detail access and return/login with JavaScript enabled and disabled |
| `git diff --check` and scoped diff inspection | Passed; no dashboard/layout/CSS changes |

TDD: the list-to-detail browser test first failed on the absent title link before
implementation. The initial history-state test also exposed an ambiguous locator
matching a private option; it was scoped to product content. Snapshot assertions
now wait for hydration and compare exact text content, independently of CSS
whitespace, retaining checks that all recorded fields remain unchanged.

The temporary test config imports the checked-in Playwright config, preserves
both projects, uses `http://127.0.0.1:3000` and disables its separate server startup.
The normal config remains usable on 3100 when no other dev server owns `.next/dev`.
The development server on 3000 remains available for review. The production script
stops only its temporary server on 3101. The sandbox build initially failed to
fetch existing Google Fonts; the authorized outside-sandbox build succeeded.

Manual visual review used the in-app browser and full-page screenshots at 390 and
1440px. Automated layout checks cover 320/390/768/1440px, light/dark tokens and
390px with 200% text. The pre-existing shared-header 320px/200% limitation recorded
in FE-024 remains outside scope; no claim of fixing it is made.

Backend integration and persisted tracking were not tested or implemented because
they are separate authorized tasks. FE-025 alone is marked complete in Backlog;
no other task status changes and no commit/stage/push operations are part of this work.
