# FE-026 — Read-only admin summary cards

Validated 2026-10-16. Authorized scope: FE-026 only, dependent on completed
FE-005. All three engineering guides and the relevant Backlog, MVP, UX,
Design System and component cookbook were inspected before implementation.
No Git command was executed. A filesystem SHA-256 baseline and exact text
comparisons were used to preserve existing work and audit this task's changes.

## Delivered behavior

| Acceptance | Implementation/evidence |
| --- | --- |
| One product admin entry | `/admin/users`, inside the existing `(product)/(account)` route groups; no parallel admin dashboard or new shell |
| Total Users | Persian «کل کاربران»; all accounts, active and inactive |
| Active Users | Persian «کاربران فعال»; account `is_active=true`, independent of login recency and GA4 traffic |
| Connections | Persian «اتصال‌های معتبر»; active integrations with valid authorization, without duplicate property counting; failed sync alone does not mean disconnection/revocation |
| Sample Admin confined to review | Only the private development injector selects a sample persona; user/guest fixtures render no counts, invalid/repeated personas fall back to guest |
| Honest product boundary | Product route always retains the existing login access-state pattern until trusted session/aggregation integration; query flags cannot enable fixtures |
| Independent count states | Ready, loading, error, unavailable; explicit zero differs from missing; a connection-count failure preserves known user counts |
| Safe display | Persian numbers, account/connection units, `—` for null/negative/fractional/unsafe integer counts |
| Read-only scope | No table, user action, rule management, analytical data, credentials, fake retry, fetching, polling, mutation or browser storage |

The three counts are complete-summary **presentation inputs**, not an invented API
schema or a domain aggregation implementation. In particular, the frontend does
not count paginated user rows, infer account activation from traffic, or derive
Connections from successful syncs. BE-041 supplies authoritative aggregate semantics;
FE-030/FE-046 supply trusted session/access and real API integration. Private
user/guest scenarios demonstrate UI states, not delivered server authorization.
FE-027 remains unimplemented and unchecked.

## Architecture and review

`components/feature/admin/AdminSummary/` contains pure UI, Persian content,
heading, presentation input/controller and the product injector. The route imports
only the concrete injector. Product modules import no internal review module.
The existing ProductLayout/AccountLayout provide one header, main and footer.
No API contract, data hook, backend code, dependency, global CSS, font or shared
primitive changed.

Private review is `/ui-review/admin/users` with the existing development-only
`UI_REVIEW_ENABLED=1` opt-in. The catalogue receives one additive private link.
The `.review.tsx` guard and existing development-only extension discovery exclude
the route and fixture graph from production, including a build/start with the
flag deliberately enabled. The always-visible note labels both sample counts
and roles; private tools start collapsed.

- `persona=admin|user|guest`; omitted defaults to admin **only in private review**,
  invalid/repeated values fall back to guest.
- `scenario=ready|zero|no-connections|loading|error|partial|unavailable|invalid`;
  unknown/repeated values use ready. Arbitrary URL counts and `role` are ignored.
- The ready snapshot is fixed at 128 total, 103 active and 74 connections.
  No account/website rows or private analytical fixtures are introduced.

The neutral account surface, compact ShieldCheck heading, existing brand-soft
icon containers, rounded-2xl Cards and 30px/40px count typography follow the
Design System without deviation. Cards stack on mobile and use three columns
from md, with intrinsic wrapping/heights. Loading/error states have appropriate
status/alert semantics; no meaning depends on color alone.

## Executed validation

Runtime: existing bundled Node 24.19.0, pnpm 11.25.0 and installed Chrome selected
with `PLAYWRIGHT_CHANNEL=chrome`. Commands run from `Frontend/`, with the bundled
Node directory first on PATH. No dependency was installed or upgraded.

| Command/check | Actual final result |
| --- | --- |
| `pnpm lint` | Passed, including the final production-check script |
| `pnpm exec tsc --noEmit --incremental false` | Passed, including after the production build and restoration of the build-generated next-env import |
| `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test admin-summary.spec.ts ui-review.spec.ts navigation.spec.ts dashboard-redesign.spec.ts recommendation-inline.spec.ts dashboard-recommendation-entry.spec.ts --reporter=list --output=/private/tmp/datano-fe026-regression --global-timeout=600000` | 56 passed, mobile and desktop, 1.7 minutes |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed; `/admin/users` present, no private review route; 17 static pages generated |
| `PLAYWRIGHT_CHANNEL=chrome node tests/production/admin-summary.mjs` | Passed: manifest, 181 server/client JS files, 10 HTML/RSC responses, product access/login with and without JavaScript |
| Exact source-baseline comparison | No file deletions; previous product pages, dashboard/recommendation code/tests, shared layouts/primitives/styles, dependency files, backend and all AGENTS unchanged |

The 56-case run contains 18 new admin checks and 38 existing regression checks.
Admin coverage includes definitions, zero versus missing, independent failure,
invalid counts, deterministic reload, safe URL parsing, sample-role display
denial, no API/storage/cookie effects, product query tampering, existing account
shell, login without JavaScript and 320/390/768/1440px light/dark layouts.
Text enlargement is 200%; all feature widths fit, with whole-page assertions at
390/768/1440px. The previously documented shared-header limitation at 320px/200%
is not claimed fixed or included as a whole-page pass. No shared-header change
was made. Regression checks retain the dashboard source/control/chart layout,
recommendation entry and inline evidence, private catalogue and keyboard skip link.

TDD: the initial focused desktop test failed because the admin route/heading
did not exist. After implementation, 16 of 18 admin checks passed; the two
no-JavaScript cases used a strict single-element assertion on three cards.
The assertion was corrected to require zero **visible** cards behind Suspense,
without changing product behavior. All 18 then passed within the 56-case run.

The first sandbox E2E launch could not bind the local server (`EPERM`); authorized
outside-sandbox execution ran the meaningful Red and final Green. The first
sandbox build failed fetching the unchanged Google Fonts; the authorized
network-enabled build passed. Neither infrastructure failure is counted as a pass.
The build-generated `next-env.d.ts` import was restored byte-for-byte to its
pre-task content, followed by the successful direct TypeScript check.

Manual visual inspection used the actual browser screenshots at desktop light
and mobile dark. Captures also exist at 390/1440px in both themes under
`/private/tmp/datano-fe026-<width>-<theme>.png`. These are local QA artifacts.
The Playwright config started/stopped its own development server on port 3100;
the production script stopped its own temporary port-3102 server.
After validation, an opted-in development preview was started on port 3000 and
`/ui-review/admin/users` returned HTTP 200. It remains available for local review.

Real backend/Google integration and authenticated Admin/User HTTP authorization
were not tested: those capabilities belong to later integration tasks. Backend
tests and unrelated page suites were not run because their source was unchanged.

## File scope and completion

New files: six modules in `feature/admin/AdminSummary`, three private modules in
`feature/internal/AdminReview`, the product/private route entries, the admin E2E
spec, production isolation script and this validation record.

Existing changes are limited to one private catalogue link and its translation
type/text, the FE-026 README section, Design System recipe and FE-026's Backlog
checkbox. No unrelated task status, acceptance text or earlier product page was
changed. FE-026 is complete within its UI scope; FE-027 remains pending.
No Stage, Commit, Push, branch change, deployment or Git command was performed.

Exact inventory (paths relative to the workspace root):

- `Frontend/components/feature/admin/AdminSummary/index.tsx`
- `Frontend/components/feature/admin/AdminSummary/AdminSummaryController.tsx`
- `Frontend/components/feature/admin/AdminSummary/DatanoAdminSummary.tsx`
- `Frontend/components/feature/admin/AdminSummary/model.ts`
- `Frontend/components/feature/admin/AdminSummary/content.ts`
- `Frontend/components/feature/admin/AdminSummary/heading.tsx`
- `Frontend/components/feature/internal/AdminReview/index.tsx`
- `Frontend/components/feature/internal/AdminReview/DevelopmentAdminReview.tsx`
- `Frontend/components/feature/internal/AdminReview/fixtures.ts`
- `Frontend/app/(product)/(account)/admin/users/page.tsx`
- `Frontend/app/ui-review/admin/users/page.review.tsx`
- `Frontend/tests/e2e/admin-summary.spec.ts`
- `Frontend/tests/production/admin-summary.mjs`
- `Frontend/docs/validation/FE-026-admin-summary.md`
- `Frontend/components/feature/internal/UIReview/index.tsx`
- `Frontend/components/feature/internal/UIReview/fixtures.ts`
- `Frontend/README.md`
- `Frontend/docs/design-system.md`
- `docs/backlog.md`
