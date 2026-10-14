# FE-016 — HTML ownership verification UI validation

Executed 2026-10-14. Scope: Epic 04 UI, dependent on completed FE-015.
No real challenge, ownership verification, Google connection or Git operation.

## Delivered behavior and acceptance

- `/ui-review/websites/verify`: Persian ownership instructions, displayed hostname,
  read-only HTML code, exact copy, checking, success, failure, expired and
  operational-error states. The page uses the existing account/product shells.
- The unverified FE-014 site navigates to `?site=unverified`; the independently
  selected FE-015 registered fixture links to `?site=new`. Both return to the
  private website list and its existing profile backlink.
- `site=unverified|new` and
  `state=ready|checking|success|failed|expired|expiring|error` are allowlisted.
  Invalid/repeated selectors use the unverified site/ready state. Selector changes
  reset the fixture; arbitrary query hostname/token values are never adopted.
- The HTML guidance explains placing the unchanged code in the initial HTML head
  of the same homepage, publishing it and checking afterwards. `www` and
  subdomains require separate proof. HTTPS-first and explicitly registered HTTP
  behavior follow MVP; no website fetch is implemented in this UI.
- Clipboard writes exactly the supplied meta tag, preserving quotes/brackets.
  Denial or missing Clipboard API selects the read-only text for manual copying
  and displays an accessible error. It never announces success after a failed copy.
- Ready starts a 24-hour local review countdown; `expiring` starts at five seconds.
  Expiry disables copying/checking, hides stale copy feedback and offers a new-code
  request. It also unlocks renewal when expiry occurs during checking/copying.
  Late clipboard completion cannot announce copied after expiry or unmount.
  Timer and async completion guards are cleaned up.
- Check/retry reports actual operational unavailability; no sample HTML can grant
  ownership. Renewal reports unavailability without extending/replacing old code.
- Success is an independently selected fixture, with no connected source/report.
  Its UX-specified dashboard action displays the next source-connection step
  locally until FE-017 exists. It never visits an unfinished page or fabricates a
  ready dashboard. The underlying list remains unchanged and unverified.

## Sample and backend boundary

Private fixtures use the deliberately inert marker
`UI_REVIEW_ONLY_NOT_A_VALID_CHALLENGE`. It is not random or backend-issued; the
private notice explicitly identifies the code as unusable for real verification.
The tag is ordinary React text in a read-only textarea, never a DOM meta element,
raw HTML insertion, generated challenge or API input. No token is accepted from
query parameters, copied into browser storage or sent to a website/backend.

`/websites/[websiteId]/verify` follows the approved Backlog website namespace and
currently displays guest access, Login and a public list backlink. Neither route
IDs nor query flags grant account/site authority or expose sample proof/results.
The old `/sites/[siteId]` scaffold is preserved. Production excludes private
review routes and fixture bundles, including when the review flag is enabled.

FE-035 with BE-020 will supply real account/site-bound 24-hour challenges, digest
storage, verification/renewal responses and ownership updates. BE-019 owns public
DNS/IP checks, HTTPS/HTTP policy, same-host redirects (maximum three), SSRF,
timeouts and HTML parsing. Proof does not grant Google property permission or
report readiness. FE-017/FE-018 and real registration/integration were not started.

## Architecture and design

Routes compose concrete injectors. The controller owns local countdown/copy/status
state; pure UI receives primitive presentation props, translations and callbacks.
Review selectors and fixtures stay in the private injector. The public injector
does not import the sample controller/fixture or invent an API/data hook.

The approved design system is reused without deviation: Vazirmatn, document RTL,
LTR hostname/code isolation, brand/destructive tokens, shared Card/Button/status
primitives, a neutral backdrop and the existing account shell. The inner width
matches Add Website's `max-w-2xl`; controls are at least 48px high with wrapped
labels. Success uses a shield/text and brand-ink instead of a new status color.
No dependency, global primitive, color, gradient, header/footer or profile change.

Automated layouts cover all main states at 320/390/768/1440px, light/dark and 200%
root text without horizontal overflow. Manual screenshot inspection covered ready
desktop/mobile light, expired mobile dark and success desktop light. Code wraps
and retains its exact clipboard value. Screenshots are temporary artifacts under
`/private/tmp/datano-fe-016-results/`; production guest screenshots are
`/private/tmp/datano-fe-016-public-390.png` and
`/private/tmp/datano-fe-016-public-1440.png`.

## Executed validation

Node 24.19.0, pnpm 11.25.0, Playwright 1.62.1, installed Chrome 154.0.8037.98.
Port 3000 was initially unavailable. An owned development server was started with
`UI_REVIEW_ENABLED=1 pnpm dev --hostname 127.0.0.1 --port 3000` and left running
for user review. A temporary `/private/tmp/datano-fe-016.config.ts` imports the
repository Playwright config, overriding absolute test/output paths, reporter,
baseURL and server reuse. The repository test configuration was unchanged.

| Command / check | Result |
| --- | --- |
| Initial `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-016.config.ts website-verification.spec.ts --project=desktop` | Meaningful red: ownership page/instructions absent |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-016.config.ts website-verification.spec.ts add-website.spec.ts websites.spec.ts profile.spec.ts` | 78/82 passed; all 62 regression cases passed. Four new cases failed on test timing/hidden-SSR locator assumptions, corrected below |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-016.config.ts website-verification.spec.ts` after corrections | 20/20 passed; all new verification cases now pass on mobile/desktop |
| `pnpm lint` | Passed, no diagnostics |
| `pnpm exec tsc --noEmit --incremental false` | Passed, no diagnostics |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed; public dynamic verification route present; private routes excluded |
| `node /private/tmp/datano-fe-016-production.cjs` | Passed: manifest/client fixture isolation, 20 HTTP/RSC checks and public navigation/query isolation at 390/1440px |
| Final localhost HTTP check | `/ui-review/websites/verify` returned 200 on port 3000 |

The clock test originally advanced a full day before the checking fixture's timer
effect began after navigation. It now waits for its first visible tick before
advancing. The no-JS test originally counted hidden streamed SSR content; it now
checks accessible region/textbox absence, matching existing review conventions.
No hidden content is treated as a user-visible success. New checks then passed.

Behavior tests cover exact actual clipboard content, denied clipboard/manual
selection and focus, disabled checking, missing-code failure/retry, full lifetime,
short expiry, expiry during checking, late clipboard resolution, unavailable
renewal, independently selected success, no-source readiness, list/add navigation,
query isolation, layout/RTL, no-JS accessibility and unchanged public guest access.
No mutation/API request, cookie, browser-storage write or list ownership change
was observed in tested proof interactions.

Production was tested with `UI_REVIEW_ENABLED=1`; private HTML and RSC URLs still
returned 404 and the inert sample marker was absent from production client code.
The temporary production server on port 3009 was stopped. Build's generated
`next-env.d.ts` route-types reference was restored to its exact pre-task dev value
after confirming that was its only change; direct TypeScript passed afterwards.

No live backend/DNS/ownership/Google test was run: these are absent/out of this UI
task's scope. No unit runner or dependency was added. The affected regression
cases passed, and the corrected new suite was rerun; unrelated suites were not
repeated.

## Changed files

Paths are relative to the repository root.

- `Frontend/app/(product)/(account)/websites/[websiteId]/verify/page.tsx`
- `Frontend/app/ui-review/websites/verify/page.review.tsx`
- `Frontend/components/feature/websites/WebsiteVerification/index.tsx`
- `Frontend/components/feature/websites/WebsiteVerification/WebsiteVerificationController.tsx`
- `Frontend/components/feature/websites/WebsiteVerification/DatanoWebsiteVerification.tsx`
- `Frontend/components/feature/websites/WebsiteVerification/content.ts`
- `Frontend/components/feature/internal/WebsiteVerificationReview/index.tsx`
- `Frontend/components/feature/internal/WebsiteVerificationReview/DevelopmentWebsiteVerificationReview.tsx`
- `Frontend/components/feature/internal/WebsiteVerificationReview/fixtures.ts`
- `Frontend/components/feature/websites/AddWebsiteForm/index.tsx`
- `Frontend/components/feature/websites/AddWebsiteForm/AddWebsiteFormController.tsx`
- `Frontend/components/feature/websites/AddWebsiteForm/content.ts`
- `Frontend/components/feature/internal/AddWebsiteReview/DevelopmentAddWebsiteReview.tsx`
- `Frontend/components/feature/internal/WebsiteListReview/DevelopmentWebsiteListReview.tsx`
- `Frontend/tests/e2e/website-verification.spec.ts`
- `Frontend/tests/e2e/websites.spec.ts`
- `Frontend/README.md`
- `Frontend/docs/design-system.md`
- `Frontend/docs/validation/FE-016-website-verification.md`
- `docs/backlog.md` — only the FE-016 checkbox.

A pre-task SHA-256/source snapshot covered 312 files across Frontend, Backend and
docs. File comparisons and source diffs replace prohibited Git inspection. No
files were deleted; unrelated source, backend, profile flows, shared layout/style,
dependencies and configuration were preserved. All FE-016 UI criteria passed;
only its Backlog checkbox is complete. FE-017 and the rest of the Epic remain
pending; no Git command, stage, commit, push or branch operation was performed.
