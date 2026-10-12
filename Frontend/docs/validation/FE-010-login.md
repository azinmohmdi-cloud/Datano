# FE-010 — login form

Validated 2026-10-12. Authorized scope: FE-010 only. Initial HEAD `2af4d92`;
initial working tree clean. FE-005 is checked in Backlog and its private opt-in
route discovery and fixed fixtures were inspected before implementation.

## Outcome, architecture and acceptance

`/login` composes the concrete `identity/LoginForm/DatanoLogin.tsx` injector
through the existing ProductLayout/PublicLayout. `index.tsx` is pure presentation
with local UI types, translations, callbacks and optional input refs. `content.ts`
provides Persian copy and reserved destinations. The injector owns local values,
validation errors, visibility and focus; no fetching/data hook or API contract is
invented for the later FE-030 session integration.

| Acceptance | Verified behavior |
| --- | --- |
| Email and password | Labeled controls, email LTR isolation, username/current-password autocomplete; no username or role control |
| Password visibility | Named toggle, aria-pressed/controls, keyboard Enter/Space, exact values retained including Persian and surrounding spaces |
| Remember-me | Initially unchecked; label/keyboard operation, disabled in pending; no persisted session or password |
| Signup/recovery links | `/signup` and `/forgot-password` hrefs and actual keyboard/click navigation; destination forms remain FE-011/FE-012 |
| Validation | Required email/password and native email type validity; Persian linked errors, first-invalid focus, correction clears the relevant error |
| Existing-password compatibility | Login accepts nonempty existing passwords without the 15-character new-password minimum and without trimming |
| Pending/error review | Private fixed scenarios at `/ui-review/login?state=pending` or `state=error`; selection/reload deterministic; idle uses the interactive public injector |
| No fabricated auth | Valid public submission shows the actual availability error; no artificial request/delay/success/redirect |
| No token storage | Tests confirm no API/POST requests or cookie/localStorage/sessionStorage changes through submission and review |
| Persian, RTL and design | Vazirmatn/shared shell, quiet icy-blue/lavender main-only gradient, responsive form rather than landing composition |

The page has one compact centered form Card, clear labels, restrained lock icon,
one primary action and a signup row. Reused Base UI controls, Card/ErrorState,
button recipes, Lucide and approved blue/purple tokens preserve the Design System.
The user-approved backdrop is centralized in `--page-login-start/end` with dark
adaptations and selected only by `main:has(.page-surface-login)`. Other page
backgrounds, header/footer and shared primitive defaults remain unchanged.

Before hydration and without JavaScript, controls are disabled via React's
useSyncExternalStore server/client snapshots; a noscript message explains the
required browser setting. This prevents native submission before the handler is
available. POST semantics additionally avoid putting credentials in URL queries.
Native public links remain usable. Password and remember values stay only in the
mounted component's memory, with existing password-manager autocomplete semantics.

Private review has its own injector, pure wrapper and fixture module. The public
form imports none of those modules and ignores fixture query parameters. The
existing catalogue adds one review link. Both private pages use `page.review.tsx`
and the existing server guard; production excludes them even when the server-only
flag is enabled during build/start. No login success or sample role is introduced.

## Behavioral evidence and visual corrections

Before implementation, the focused route test ran with Chrome and failed for the
expected reason: `/login` returned 404 instead of 200. After implementation that
same assertion passes. An initial sandbox run failed to listen on port 3100 with
EPERM; this is an environment failure, not the behavioral Red.

The first focused suite passed eight interaction/fixture cases but found an
overflowing password visibility icon at 200% text in both viewport projects.
The final control uses a fixed 44px target and 20px icon, consistent with the
shared navigation's fixed geometry. Visual review also found the auto-direction
password placeholder could overlap the control. Its physical left inset matches
the RTL wrapper's control while preserving auto direction for the actual value.
Using a fixed 52px inset keeps usable text space at 200%, verified by an added
input-space assertion. No hidden overflow or reduced text size conceals content.

A separate no-JavaScript test first failed because the submit button was enabled
before hydration. The hydration guard fixes this; both projects now verify
disabled credential controls, the explanatory message and working signup link.
Responsive CSS assertions await the actual computed gradient using Playwright's
web-first expectation, rather than a single read during stylesheet startup.

Final desktop/mobile, tablet dark and 200% screenshots were visually inspected
for hierarchy, Persian shaping, spacing, input/control alignment and footer flow.
Screenshots remain ignored outputs under `test-results/`, not product assets.

## Executed validation

Final commands ran from `Frontend/` using Node 24.19.0 and pnpm 11.25.0:

```sh
export PATH="/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

| Command/check | Result |
| --- | --- |
| Initial `pnpm lint` and direct TypeScript baseline | Passed before implementation |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e login.spec.ts --project desktop --grep 'approved fields'` before implementation | Expected behavioral failure: 404 |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e` | 48/48 passed, 47.9s; 12 login cases plus all existing public/navigation/private-review regressions |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e login.spec.ts` after final input-space adjustment | 12/12 passed, 16.9s; no failures/skips/retries |
| Final `pnpm lint` | Passed, exit 0 |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed after final source adjustment; `/login` static; private routes absent |
| `pnpm exec tsc --noEmit --incremental false` after final build | Passed, exit 0 |
| `node /private/tmp/datano-fe-010-production.cjs` | Passed: production manifest/client isolation, 14 HTTP/RSC checks and browser interactions/no-JS at 390/1440px |
| `git diff --check`, file-scope and Backlog audit | Passed; only FE-010 status updated |

The full 48-case suite ran before the last password-padding adjustment. The final
12-case login run, lint, typecheck, build and production check validate that final
source; unaffected regressions were not redundantly repeated. Login layout tests
cover 320/390/768/1440px, both token sets, 200% text, no horizontal/clipped-text
overflow, usable input space, error-free rendering, links, state and storage
boundaries. Other acceptance tests cover actual field-error association and focus.

The production harness starts/stops its owned server on port 3008 with the review
flag enabled. `/`, `/services`, `/about`, `/login` return 200. Private review paths
including selected scenarios, trailing slash and RSC requests return 404. No
login fixture email/password marker appears in public HTML or production static
JavaScript; app-paths-manifest contains no review route. Production login behavior
and no-JS protection pass at both widths, without requests, cookies/storage
changes, redirects or uncaught browser errors.

## Changed files

Paths are relative to the workspace root:

1. `Frontend/app/(product)/(public)/login/page.tsx`
2. `Frontend/components/feature/identity/LoginForm/index.tsx`
3. `Frontend/components/feature/identity/LoginForm/DatanoLogin.tsx`
4. `Frontend/components/feature/identity/LoginForm/content.ts`
5. `Frontend/app/globals.css`
6. `Frontend/app/ui-review/login/page.review.tsx`
7. `Frontend/components/feature/internal/LoginReview/index.tsx`
8. `Frontend/components/feature/internal/LoginReview/DevelopmentLoginReview.tsx`
9. `Frontend/components/feature/internal/LoginReview/fixtures.ts`
10. `Frontend/components/feature/internal/UIReview/index.tsx`
11. `Frontend/components/feature/internal/UIReview/fixtures.ts`
12. `Frontend/tests/e2e/login.spec.ts`
13. `Frontend/README.md`
14. `Frontend/docs/design-system.md`
15. `Frontend/docs/validation/FE-010-login.md`
16. `docs/backlog.md` — FE-010 checkbox only

## Limits and review

Tests explicitly used installed Chrome 154.0.8037.98. Matching bundled Chromium
was not executed/downloaded in this task; FE-006 records its distribution-access
limitation. No cross-browser result is claimed. The sandbox build initially could
not fetch the unchanged Google Fonts; approved network execution resolved it.
Inherited FORCE_COLOR/NO_COLOR warnings were non-failing and not suppressed.

Real email login, remember-me session lifetime, role/account routing and auth API
transport remain FE-030 and its dependencies. Signup/recovery forms remain
FE-011/FE-012; no placeholder destination was implemented. Backend tests,
OpenAPI/Orval generation, database migrations and Google integration checks do
not apply: no backend/transport/API contract changed. No dependency was added,
upgraded or installed; no guide or unrelated product component was changed.

FE-010 is complete within its UI scope. No other Backlog checkbox, description,
dependency or ID changed. No staging, commit, push or deployment was performed.

For immediate review, the task-owned development server is running on
`http://127.0.0.1:3000` with `UI_REVIEW_ENABLED=1`. Open `/login` for the public
form or `/ui-review/login?state=pending` for the private state selector. The
Playwright server on 3100 and production-check server on 3008 were stopped.

Suggested commit: `feat(frontend): implement FE-010 Persian login form`
