# FE-011 — signup form

Validated 2026-10-12. Scope: FE-011 only. Initial HEAD `e62a9ef`, working tree
clean. FE-005 is checked and its development-only catalogue, server guard and
review page-extension policy are intact. The approved FE-010 UI was read and
preserved. No dependency, backend, API, environment or shared primitive changed.

## Outcome and architecture

`/signup` composes the concrete `SignupForm/DatanoSignup.tsx` wrapper through the
existing ProductLayout/PublicLayout. A focused client `SignupFormController.tsx`
owns values, validation, password visibility, submission feedback and focus.
`index.tsx` uses local presentation types and shared Base UI primitives; content
and pure validation helpers remain sibling modules. No data hook, hypothetical
endpoint, successful account, role or auth session is introduced.

| Acceptance | Delivered and verified |
| --- | --- |
| Name/family name/email/password/confirmation | Labeled required controls, correct autocomplete, names stacked on mobile and in a row from sm |
| Approved new-password policy | 15–128 Unicode code points; no forced composition, trim, normalization or truncation |
| Exact password confirmation | Exact comparison including whitespace; independent show/hide controls; changing the original revalidates an existing confirmation |
| Terms acceptance | Required checkbox; public checkbox/submit disabled while approved versioned terms are unavailable |
| No username or role choice | Neither control is rendered; no role/account is inferred from form values |
| Validation/state review | Private interactive, blocked, pending and error scenarios; first-invalid focus and Persian field-linked errors |
| No fabricated integration | Valid private submit reports actual unavailability; no request, account, success, session or storage write |

Names require non-whitespace content, without an invented length limit. Email
uses native type validity forwarded from blur/submit events. `Array.from` counts
Unicode code points consistently with Python string length rather than UTF-16
units. Native minlength/maxlength are omitted so supplementary-plane characters
are not counted twice or truncated. Values remain unmodified; confirmation uses
exact equality. Password match feedback describes the actual entered values,
not registration success. Existing Field components associate descriptions and
errors; submit focuses the first invalid control within its own form.

Public acceptance and submit are permanently blocked in this UI implementation
because approved terms text/version are absent (`EXT-002`). The adjacent message
explains that reason without fabricating legal copy or a terms link/page. URL
query parameters cannot enable preview behavior. Real registration and versioned
legal acceptance remain FE-030/FE-048; this UI gate is not server authorization.

Controls are disabled before hydration and without JavaScript, using the same
React server/client snapshot approach as Login. Native POST avoids credentials
in URL queries; the hydrated submit handler never sends credentials. Passwords,
names and checkbox state live only in component memory. Password-manager/native
autocomplete attributes are preserved. No browser-storage API is used.

Private `/ui-review/signup` reuses the controller and pure UI with an explicit
design-only notice. Interactive checkbox testing does not represent accepted
legal terms. Fixed pending/error values come exclusively from private fixtures.
The blocked scenario renders the public wrapper; selection changes remount the
controller and restore its initial values. Reload reproduces the selected state;
unknown/repeated selections fall back to interactive. The private catalogue adds
one signup-review link. Production never discovers these `page.review.tsx` pages,
even with `UI_REVIEW_ENABLED=1` during build/start.

## Design and preservation

The form retains FE-010's quiet Card, 24px heading, 48px controls, blue primary
action, restrained icon, Vazirmatn and RTL. A wider `max-w-xl` Card accommodates
the name row, full-width email/passwords, matching feedback and terms. Fields
use compact `space-y-4` rhythm. Visibility targets/icons retain fixed 44px/20px
geometry with a 52px inset independent of automatic password text direction.

The new `main:has(.page-surface-signup)` rule reuses existing login gradient
tokens, including their dark adaptation. The login selector and all existing
tokens/rules remain unchanged. No Login, Landing, Services or About component,
route, test, shared header/footer, provider or primitive was edited. Full existing
regressions pass. Catalogue-only changes provide access to the new private review;
README/Design System changes document this task and update the signup destination
status. No charts, marketing sections, new palette or dependency were added.

Screenshots at 1440px and 390px, tablet dark and 200% text were visually inspected
for hierarchy, Persian shaping, names/fields, terms feedback, wrapping and footer
flow. Test captures are outside the repository under `/private/tmp/datano-fe-011-tests`.

## Red, corrections and executed checks

The focused acceptance test ran before implementation and failed because
`/signup` returned 404 instead of 200. That assertion passes after implementation.
Initial runner-start failures were infrastructure/configuration issues, not Red:
the existing server was inaccessible from the sandbox, and composing two configs
retained the original web-server entry. A temporary config now spreads the repo
configuration before overriding only server URL/reuse and artifact paths.

The first focused run passed 12/14. Two fixture-transition tests began typing
before the router completed the scenario remount, losing the first-name edit.
They now await the selected URL and empty initial name before entering data;
no assertion was weakened. Lint caught a ref read during render and ref-record
handling in the new UI. Match feedback now derives purely from values; native
validity/focus are accessed only through actual form events, with no suppression
or rule change. All static and behavioral checks pass on the final source.

Final commands ran from `Frontend/` with Node 24.19.0/pnpm 11.25.0:

```sh
export PATH="/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

| Command/check | Result |
| --- | --- |
| Initial `pnpm lint` / `pnpm exec tsc --noEmit --incremental false` | Passed before implementation |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-011.config.ts signup.spec.ts --project desktop --grep 'approved fields'` before implementation | Expected behavioral failure: 404 |
| Same temporary config with `signup.spec.ts` | 14/14 passed after fixture-wait correction, 18.0s |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-011.config.ts` | 62/62 passed on final source, 1.2m; zero failures/retries/skips |
| Final `pnpm lint` | Passed, exit 0 |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed; `/signup` static, private review routes absent |
| `pnpm exec tsc --noEmit --incremental false` after final build | Passed, exit 0 |
| `node /private/tmp/datano-fe-011-production.cjs` | Passed: manifest/client fixture isolation, 17 HTTP/RSC checks and blocked signup/no-JS at 390/1440px |
| `git diff --check`, source preservation, links and Backlog audit | Passed; only FE-011 checkbox updated |

The final full suite includes 14 new signup executions and all 48 existing
Login/public/shell/navigation/private-review cases. New coverage includes blank
and whitespace-only names, invalid email, linked errors/focus, required checkbox,
Unicode boundaries (14/15 emoji; 128/129 characters), nontrimmed whitespace,
independent visibility, exact confirmation and mismatch after original edits,
deterministic pending/error/reload, no auth/storage effects, query isolation,
320/390/768/1440px, both themes, 200% text, usable password input space and no-JS.

The temporary config retains the repository's projects, browser, locale/timezone,
worker/retry policy and assertions. It reuses the already-running opted-in server
on port 3000 to preserve that process and avoid its Next dev lock. No repository
test configuration was changed and no test was skipped. Generated reports/results
are outside the repository. Default repo commands remain valid when no dev server
from the same checkout holds the lock.

The production harness scans manifest/static JavaScript for signup and login
fixture markers, starts its own port-3008 server with the review flag enabled,
and checks five public routes return 200 and six private route/query variants
return 404 for both HTTP and RSC. Normal browser contexts verify blocked terms
and submission despite query flags, intact visibility/values, no requests,
cookies/storage changes or page errors, and native Login navigation. No-JS
contexts verify disabled credential controls and working Login links. One initial
harness assertion read the URL immediately after an App Router click; waiting
for completed navigation fixed the harness without an application change. The
final check passes and its owned server/browser are stopped.

## Changed files

Paths are relative to the workspace root:

1. `Frontend/app/(product)/(public)/signup/page.tsx`
2. `Frontend/components/feature/identity/SignupForm/DatanoSignup.tsx`
3. `Frontend/components/feature/identity/SignupForm/SignupFormController.tsx`
4. `Frontend/components/feature/identity/SignupForm/index.tsx`
5. `Frontend/components/feature/identity/SignupForm/content.ts`
6. `Frontend/components/feature/identity/SignupForm/validation.ts`
7. `Frontend/app/globals.css` — new signup selector only
8. `Frontend/app/ui-review/signup/page.review.tsx`
9. `Frontend/components/feature/internal/SignupReview/DevelopmentSignupReview.tsx`
10. `Frontend/components/feature/internal/SignupReview/index.tsx`
11. `Frontend/components/feature/internal/SignupReview/fixtures.ts`
12. `Frontend/components/feature/internal/UIReview/index.tsx` — catalogue link only
13. `Frontend/components/feature/internal/UIReview/fixtures.ts` — link text only
14. `Frontend/tests/e2e/signup.spec.ts`
15. `Frontend/README.md`
16. `Frontend/docs/design-system.md`
17. `Frontend/docs/validation/FE-011-signup.md`
18. `docs/backlog.md` — FE-011 checkbox only

## Limits, status and review

Chrome 154.0.8037.98 was explicitly used. Matching bundled Chromium was not
executed/downloaded; FE-006 records the distribution-access limitation. Build
used approved network access for the unchanged Google Fonts. Inherited color-env
warnings were non-failing; no diagnostic was suppressed.

Approved legal terms/version remain missing and block real publication of
registration. No legal text or role is invented. Backend tests, OpenAPI/Orval,
database and provider checks do not apply: no corresponding contract/code changed.
No dependency, guide, environment, prior approved page or task was modified.

FE-011 is complete within its UI scope. Other checkboxes/descriptions/IDs remain
unchanged. No stage, commit, push or deployment was performed.

The existing task-owned development server is still running on
`http://127.0.0.1:3000`: `/signup` is the public blocked form and
`/ui-review/signup` supplies private interactive/state inspection. That process
was reused without stopping or restarting it.

Suggested commit: `feat(frontend): implement FE-011 Persian signup form`
