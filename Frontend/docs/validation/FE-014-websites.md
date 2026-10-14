# FE-014 — website list and selection UI

Validated 2026-10-13. Scope: FE-014 only; FE-013 is checked and its existing
source/validation evidence was reviewed. Shared/frontend guides, Backlog,
product/MVP/UX, component cookbook and Design System govern this implementation.
The user's no-Git restriction remains: no Git command was run. A baseline hash
snapshot of 285 workspace files was saved before changes to audit preservation.

## Outcome and acceptance

`/websites` composes `WebsiteList/DatanoWebsiteList.tsx` inside the existing
pathless account group, AccountLayout and ProductLayout. It currently renders
an honest access state with Login. Neither query flags nor private fixtures can
provide account data, authentication, a role or access to website records.

The complete list is privately reviewable at `/ui-review/websites`, accessible
from the catalogue and the private profile account summary. An optional href
passes through the existing profile controller/UI without changing its forms,
public access state or existing authentication behavior.

| Acceptance | Delivered and checked |
| --- | --- |
| Account without sites | Empty state and Add action; no invented record |
| Single-site account | One domain, automatically selected, with ownership/report information |
| Multi-site account | Six independent fixture records; explicit single selection and clear selected-site panel |
| Domain and status | LTR bdi domains, separate ownership/report labels, verified/no-connection/waiting/failed/ready/empty cases |
| Selection and continuation | Unverified → proof; no source → connections; waiting/failure → receiving; ready/valid empty → dashboard destination review |
| Delete confirmation | Exact target domain, source/job cancellation, dependent-data access loss and fresh-proof/history consequences |
| Delete cancellation/failure | Focus returns to trigger; failure never removes the site or changes selection |
| Shared identity | Existing Vazirmatn/RTL/brand/tokens/Lucide/primitives/account shell/header/footer |
| Fixture isolation | Opt-in development route only; absent from production manifest and browser bundles |

The first fixture intentionally has an inconsistent ready report flag with
unverified ownership to test that proof takes precedence. These are presentation
records, not a proposed endpoint schema or a server authorization/readiness check.
The state labelled ready/empty assumes a supplied valid successful sync; no
readiness is inferred merely from ownership and no backend sync is performed.

## Architecture and scope boundaries

The page imports its concrete injector, which currently renders an access
component. The review injector maps allowlisted selectors and deterministic
fixtures into a client controller and pure UI. Presentation types, state labels,
next-step selection, callbacks, focus and status rendering stay outside API
transport. No API hook, schema, endpoint, generated client or dependency is added.

`navigation.ts` selects a semantic next step without inventing API or route
contracts. The review callback displays a labelled local destination rather than
navigating to a missing page. Add never creates a record, and Delete always reports
actual unavailability. FE-015–FE-018 and dashboard UI are not implemented.
Real site integration remains FE-030/FE-034; real deletion remains FE-047/BE-042.

The list route follows Backlog's `/websites` naming. No individual-site route is
created. The existing `/sites/[siteId]` layout remains untouched; its discrepancy
with the approved `/websites/[websiteId]` workspace must be coordinated before
altering that scaffold in a later task. `/account` routing remains FE-030 work.

## Private scenarios, interaction and design

`account=empty|single|multiple` selects the account fixture; default is multiple.
`state=ready|loading|error|delete-confirm|delete-pending|delete-error` selects the
initial scenario; default is ready. Invalid or repeated selectors fall back to
the defaults. Query-supplied site or role flags are ignored. Scenario/account
changes remount the controller and reset selection, confirmation and feedback,
as stated in the private review notice. Reload reconstructs the initial scenario.

Single-site selection is automatic. Multi-site selection uses accessible
aria-pressed buttons, a textual selected state, check symbol and restrained brand
border/background. Choosing another site clears obsolete destination feedback
and confirmation. Report/ownership labels remain independent across records;
valid empty report readiness is distinct from no connection or failed receipt.

Deletion is an inline confirmation group with the explicit target, not a modal.
Opening focuses Confirm; cancellation restores the original trigger without
changing the selected website. Pending scenarios disable actions; confirmation
failure preserves all records and selected-site context. No API request,
session/cookie operation or browser-storage write occurs. Actions are disabled
before hydration; no-JS review retains its Suspense fallback and the product
access-state Login link works without JavaScript.

The existing 1024px account cap and neutral page backdrop are retained. Cards
stack on mobile and form two columns at md; domains wrap inside LTR isolation.
The selected panel uses brand-panel; labels use existing foreground/brand-muted
tokens; failed receipt/delete reuse destructive styling. Controls have 48px
minimum heights and wrapped labels. No new palette, gradient, success/warning
token, modal, shared control, chart, provider logo or sidebar is introduced.
The new private return/catalogue links use brand-ink for readable dark-theme text.

## Red–Green and executed checks

Commands ran from Frontend with Node 24.19.0 and pnpm 11.25.0:

```sh
export PATH="/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

| Check | Actual result |
| --- | --- |
| Baseline `pnpm lint` and `pnpm exec tsc --noEmit --incremental false` | Passed before implementation |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-014.config.ts websites.spec.ts --project desktop --grep 'public website list'` before implementation | Expected Red: route returned 404 instead of 200 |
| Same config with `websites.spec.ts` on both projects | Green: 20/20 passed, 21.0s |
| Same config with the full suite | 116/116 passed, 1.9m, no failures/retries/skips |
| Same config with `websites.spec.ts ui-review.spec.ts` after the final dark-link correction | 28/28 passed, 26.7s |
| `UI_REVIEW_ENABLED=1 pnpm build` in sandbox | Failed fetching the unchanged Google Fonts resources; not a code pass |
| Same build with approved network access, including final source | Passed; `/websites` static and every private review absent |
| Final `pnpm lint` and `pnpm exec tsc --noEmit --incremental false` after final build | Passed, exit 0 |
| `node /private/tmp/datano-fe-014-production.cjs` on final build | Passed: manifest/client fixture isolation, 26 HTTP/RSC checks, public access/query isolation and no-JS at 390/1440px |
| Filesystem/hash audit | Scoped source/documentation changes; Backend/guides/tooling/previous tests preserved; only FE-014 checkbox changed |

Ten new browser tests run on both projects. The full suite includes all 96 prior
executions. After the final correction to two new link colors, only the affected
website/shared-review tests were repeated, followed by final build, static checks
and production checks; the full suite was not needlessly rerun. No existing test,
lint/type rule, retry policy or warning was weakened or suppressed.

Tests cover empty/single/multiple accounts; ownership-first routing; independent
states and successful empty reports; clearing old selection feedback; different
selection/deletion targets; confirmation consequences/focus/cancellation; pending
and failure; invalid/repeated selectors and reload; private profile/catalogue
navigation; public query isolation; no session/storage/API effects; no-JS; shared
landmarks; RTL; 320/390/768/1440px, both themes and 200% text with no page overflow
or clipped feature text. Screenshots of all three account variants, mobile/desktop
confirmation, narrow dark UI, enlarged text and public production access were
visually inspected. This is not physical-device or assistive-technology certification.

The temporary config spreads the repository's real config and preserves both
projects, one worker, zero retries, locale/timezone and explicit Chrome channel.
It reuses the existing opted-in dev server on port 3000 without stopping it or
changing repository test configuration. Reports/screenshots are under
`/private/tmp/datano-fe-014-tests` and `/private/tmp/datano-fe-014-report`.

Production checks run with UI_REVIEW_ENABLED=1. Eight product routes return 200;
nine private route/query variants return 404 over both HTTP and RSC, totaling 26
checks. Private website/auth fixture markers are absent from public HTML/client
JS and review routes from the server manifest. Browser contexts also verify no
sample rows, account-query injection, API requests, cookies/storage writes,
page errors or overflow on public `/websites`, and working Login with/without JS.
The owned production server on port 3009 and browser were stopped afterward.

## Changed files

Paths are relative to the Datano workspace root:

1. `Frontend/app/(product)/(account)/websites/page.tsx`
2. `Frontend/app/ui-review/websites/page.review.tsx`
3. `Frontend/components/feature/websites/WebsiteList/DatanoWebsiteList.tsx`
4. `Frontend/components/feature/websites/WebsiteList/access.tsx`
5. `Frontend/components/feature/websites/WebsiteList/heading.tsx`
6. `Frontend/components/feature/websites/WebsiteList/index.tsx`
7. `Frontend/components/feature/websites/WebsiteList/WebsiteListController.tsx`
8. `Frontend/components/feature/websites/WebsiteList/navigation.ts`
9. `Frontend/components/feature/websites/WebsiteList/content.ts`
10. `Frontend/components/feature/internal/WebsiteListReview/DevelopmentWebsiteListReview.tsx`
11. `Frontend/components/feature/internal/WebsiteListReview/index.tsx`
12. `Frontend/components/feature/internal/WebsiteListReview/fixtures.ts`
13. `Frontend/components/feature/internal/UIReview/index.tsx` — new catalogue link only
14. `Frontend/components/feature/internal/UIReview/fixtures.ts` — its translated label
15. `Frontend/components/feature/identity/ProfilePage/index.tsx` — optional site-navigation link
16. `Frontend/components/feature/identity/ProfilePage/ProfileController.tsx` — optional href passthrough
17. `Frontend/components/feature/identity/ProfilePage/content.ts` — link label
18. `Frontend/components/feature/internal/ProfileReview/DevelopmentProfileReview.tsx` — private href
19. `Frontend/tests/e2e/websites.spec.ts`
20. `Frontend/README.md`
21. `Frontend/docs/design-system.md`
22. `Frontend/docs/validation/FE-014-websites.md`
23. `docs/backlog.md` — FE-014 checkbox only

## Limits and completion

Explicit Chrome 154.0.8037.98 was used. Bundled Chromium was not downloaded or
run; its previously documented distribution-access limitation remains. Google
Fonts required approved network access. Inherited color-environment warnings
were non-failing and not suppressed. Backend/OpenAPI/Orval/database/Google tests
do not apply because their source, contracts and real operations are untouched.

FE-014 is complete within its UI scope. Only its Backlog checkbox is changed;
FE-015–FE-018 and later integrations remain incomplete. No Git command, stage,
commit, branch, push, merge or deployment was performed. The existing dev server
remains at `http://127.0.0.1:3000`: `/websites` shows the public access state and
`/ui-review/websites` the complete private UI.

Suggested commit: `feat(frontend): implement FE-014 website list and selection UI`
