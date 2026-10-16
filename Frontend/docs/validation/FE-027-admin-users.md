# FE-027 — Read-only admin users, sites and account details

Validated 2026-10-16. Authorized scope: FE-027, dependent on completed FE-026.
The existing `/admin/users` and `/ui-review/admin/users` entries are retained.
No new route, parallel admin page or shell was created. The approved equal-size
summary cards and all six FE-026 modules remain byte-identical to the pre-task
filesystem snapshot. No Git command was executed.

## Acceptance and behavior

| Requirement | Delivered behavior/evidence |
| --- | --- |
| One row per user | One outer row per account; default private list has three accounts, including an account without sites and one with two sites |
| Users without sites | Explicit empty sites render «سایتی ثبت نشده است.» without removing the account; unknown sites are a distinct state |
| Independent site/source statuses | Each account's nested site table aligns Website, GA4, Search Console and Ads columns; domains and ownership labels remain site-specific |
| Correct connection semantics | Valid connection and successful/failed/queued sync are separate labels; unselected, disconnected, revoked and unknown states are distinct |
| View account information | Native disclosure inside the same user row shows supplied first/last name, email, account status and registration time; no extra detail row, modal or route |
| Read-only scope | No edit, block, activation, deletion, role/rule management, source operation or link to another user's private dashboard |
| Account/site metadata only | No analytical values, provider identifiers, tokens or credentials |
| Existing admin boundary | Guest/User sample scenarios hide summaries/list; product route keeps its existing login access state and ignores URL/browser-storage role claims |

Registration metadata uses Persian calendar/numerals and Asia/Tehran time from
supplied UTC timestamps. Missing or invalid timestamp input displays `—`.
An explicit active/inactive/unknown account label is independent of site traffic.

The displayed-row count describes the current list only. Complete FE-026
aggregates are never recalculated from these rows. The private ready sample is a
three-account subset alongside the preserved 128/103/74 summary fixture. Real
aggregation, pagination and server authorization remain BE-041/FE-046; these
TypeScript view inputs are not an API schema or an authorization mechanism.

## Architecture and design

`components/feature/admin/AdminUserList/` has pure UI (`index.tsx`), Persian
content, read-only view inputs and a concrete presentation controller. Native
disclosures own only browser presentation state; there is no mutation, fetching,
polling, query hook, cookie or storage behavior. Product feature modules import
no internal fixture module.

The existing private development injector composes the list below FE-026. Private
fixtures and selector options live only in `AdminReview/user-fixtures.ts`.
`users=ready|empty|loading|error|unavailable|long` selects list states independently
of summary state. Omitted/invalid/repeated values use a summary-compatible preset:
zero → empty, loading/error → matching state, unavailable/invalid → unavailable,
otherwise ready. Changing the summary resets the list to this preset. The
no-connections snapshot maps all site sources to unselected. The visible private
note now explicitly includes sample names and websites.

The list reuses the shared rounded-2xl Card and Table, existing brand/muted/
destructive tokens, Lucide icons and Persian typography. Every meaningful status
has visible text. Table headers have explicit scopes and logical alignment;
email/domain values use LTR bdi isolation. Outer-table local horizontal scrolling
preserves the narrow document width and supports keyboard arrows. Account details
use native Enter/Space operation without navigation. No global CSS, shared
primitive, palette, font, header/footer, existing product page, backend or dependency
changed. This follows the Design System without deviation.

## Executed validation

Runtime: existing bundled Node 24.19.0 and pnpm 11.25.0; installed Chrome selected
with `PLAYWRIGHT_CHANNEL=chrome`. Commands ran from Frontend with the bundled
Node directory first on PATH. No installation or dependency upgrade was performed.

| Command/check | Actual final result |
| --- | --- |
| `pnpm lint` | Passed after the final implementation and production-check changes |
| `pnpm exec tsc --noEmit --incremental false` | Passed, including the final post-build check |
| `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test --config=/private/tmp/datano-fe024.playwright.config.ts admin-users.spec.ts admin-summary.spec.ts ui-review.spec.ts navigation.spec.ts dashboard-redesign.spec.ts recommendation-inline.spec.ts dashboard-recommendation-entry.spec.ts --output=/private/tmp/datano-fe027-final --global-timeout=600000` | 74 passed, mobile and desktop, 2.0 minutes |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed; 17 static pages generated; existing product routes retained; private review routes absent |
| `PLAYWRIGHT_CHANNEL=chrome node tests/production/admin-summary.mjs` | Passed: manifest, 181 server/client JS files, 10 HTTP/RSC responses, product access/login with and without JavaScript |
| Source-baseline comparison | FE-026 modules including equal-card CSS, all routes, earlier product features, shared layouts/primitives/styles, backend, dependency files and all AGENTS unchanged; no deletions |

The 74-case run contains 18 new user-list cases, 18 summary regressions and 38
existing shell/dashboard/recommendation regressions. New checks cover no-site and
multi-site accounts, inactive accounts, per-site independent source labels,
same-row metadata disclosure, keyboard operation and local scrolling, independent
list/summary failures, null versus empty sites, date/email formatting, deterministic
selectors, sample-role denial, no API/cookie/storage effects and forged product
role flags/storage. Responsive checks cover 320/390/768/1440px in both token
themes; 200% text checks preserve feature width and whole-page width at 390/768/
1440px. The previously documented shared-header limitation at 320px/200% is not
claimed fixed or reported as a whole-page pass.

The temporary config imports the checked-in config, retains both projects and
settings, uses the existing opted-in port-3000 development server and disables
only a second server startup. It preserves the running preview. To reproduce
without that server, omit the config override and let the normal config start
its own port-3100 development server when no other dev process owns the checkout.

TDD: the initial focused desktop test failed on the missing user-list heading.
The first 34-case implementation run passed 32 cases; two keyboard cases focused
the streamed details before visibility/focus was established. Adding explicit
visibility/focus assertions fixed test synchronization without changing the
native disclosure. Those cases and the added keyboard-scrolling check passed,
then all 74 final cases passed. The previous summary test's obsolete whole-page
no-table assertion is now scoped to the unchanged summary feature; no other
summary assertion was removed or weakened.

The first build inside the sandbox failed to fetch the unchanged Google Fonts.
The authorized network-enabled rerun passed. Browser/server validation used
authorized outside-sandbox execution. The build-generated next-env import was
restored byte-for-byte to its pre-task content, followed by the passing final
TypeScript check. The production script stopped its own temporary port-3102
server; the existing preview on port 3000 remains running.

Manual screenshot inspection covered desktop light/dark and mobile light,
including the long/unknown-metadata fixture. Captures from the final suite are
`/private/tmp/datano-fe027-390-light.png`, `...-390-dark.png`,
`...-1440-light.png` and `...-1440-dark.png`.

No live backend/Google integration or authenticated Admin/User HTTP authorization
is claimed tested. Backend tests and unrelated page suites were not run because
their code was unchanged. Their real integration remains future authorized work.

## File scope and completion

New files:

- `Frontend/components/feature/admin/AdminUserList/index.tsx`
- `Frontend/components/feature/admin/AdminUserList/AdminUserListController.tsx`
- `Frontend/components/feature/admin/AdminUserList/model.ts`
- `Frontend/components/feature/admin/AdminUserList/content.ts`
- `Frontend/components/feature/internal/AdminReview/user-fixtures.ts`
- `Frontend/tests/e2e/admin-users.spec.ts`
- `Frontend/docs/validation/FE-027-admin-users.md`

Existing changes:

- `Frontend/components/feature/internal/AdminReview/DevelopmentAdminReview.tsx`
- `Frontend/components/feature/internal/AdminReview/index.tsx`
- `Frontend/tests/e2e/admin-summary.spec.ts`
- `Frontend/tests/production/admin-summary.mjs`
- `Frontend/README.md`
- `Frontend/docs/design-system.md`
- `docs/backlog.md` — only FE-027's checkbox

FE-027 is complete within its UI scope. FE-028 remains pending and was not started.
No Stage, Commit, Push, branch change, deployment or Git command was performed.
