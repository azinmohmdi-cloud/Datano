# FE-015 — Add website form validation

Executed 2026-10-14. Scope: the Epic 04 UI task, dependent on completed FE-014.
No backend integration, ownership proof, Google connection or Git operation.

## Delivered behavior

- `/ui-review/websites/new`: full form, reached from Add in empty/single/multiple
  private website lists. Its backlink returns to `/ui-review/websites`, which
  retains the existing private profile backlink. Both profile email stages and
  public guest access remain unchanged.
- `/websites/new`: guest access, Login and a public list backlink until trusted
  authentication/registration integration exists. Public query parameters cannot
  enable private fixtures or display invented accounts/results.
- Persian labeled URL field, homepage guidance, Continue, canonical hostname and
  explicit valid/invalid/duplicate feedback. Errors preserve the draft; invalid
  submission focuses the URL. Same-account duplicate samples link to the existing
  list; unavailable-domain feedback discloses no owner information.
- Private `state=ready|valid|invalid|duplicate|unavailable|pending|error|registered`
  fixtures cover empty, validation, conflict, disabled pending, recoverable error
  and a separately selected unverified registration result. Unknown/repeated
  selectors return to ready. Pending fixtures stay pending until selection changes.
- Registration is explicitly separate from HTML ownership proof. Valid submission
  reports actual unavailability; it never creates a site, fakes success, issues a
  challenge, grants ownership or navigates to an unfinished verification page.

## Hostname boundary

Client validation accepts full HTTP(S) URLs, an optional root slash and matching
default ports (80 for HTTP, 443 for HTTPS). Custom ports, credentials, non-root
paths, query/fragment markers (including empty ones), internal whitespace and
backslashes are rejected before URL normalization can hide them.

The platform URL implementation performs IDNA/lowercase normalization; the final
hostname dot is removed. `www`, parent domains and subdomains remain independent.
Invalid labels, labels longer than 63 characters and hostnames longer than 253
characters are rejected. IP literals, short/integer/hexadecimal IPv4 forms,
localhost and its subdomains, `.local` names and single-label hosts are rejected.
Root-path normalization attacks such as `/a/..` are rejected using original input.

This is syntax validation only. Public-looking hostnames can still resolve to
non-public IPs. DNS/IP validation, redirects/SSRF, availability, atomic uniqueness,
same-owner idempotent registration, other-owner conflicts, actual session/owner
authorization and persistence remain backend responsibilities. FE-034 with BE-018
integrates registration; BE-019 secures HTML receipt; FE-016 supplies proof UI.

## Architecture and visual review

Routes compose concrete injectors. The controller owns local draft/validation;
pure UI receives primitive presentation props, translations and callbacks. There
is no fabricated API contract or data hook. Duplicate sample hostnames reuse the
existing FE-014 fixtures exclusively inside private review.

AccountLayout, ProductLayout, shared Field/Input/Button/Card primitives, approved
brand tokens, Vazirmatn and RTL are reused. The neutral background and shared
header/footer are unchanged. URL/hostname content is LTR and isolated; controls
have a 48px minimum height and text wraps. No new dependency, token, primitive,
gradient, challenge, ownership action or unrelated product feature was added.

Browser checks covered 320/390/768/1440px, light/dark tokens and 200% root text.
Manual screenshot inspection covered ready desktop/mobile light, invalid mobile
dark and registered desktop light, with readable text and no horizontal overflow.
Screenshots are temporary artifacts under `/private/tmp/datano-fe-015-results/`;
production guest screenshots are `/private/tmp/datano-fe-015-public-390.png` and
`/private/tmp/datano-fe-015-public-1440.png`.

## Executed validation

Node 24.19.0, pnpm 11.25.0, Playwright 1.62.1, installed Chrome 154.0.8037.98.
The user's opted-in server at `http://127.0.0.1:3000` was reused. A temporary
config `/private/tmp/datano-fe-015.config.ts` imports the checked-in Playwright
config and overrides only absolute test/output paths, reporter, baseURL and server
reuse. The repository configuration and the user's server process were preserved.

| Command / check | Result |
| --- | --- |
| Initial `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-015.config.ts add-website.spec.ts --project=desktop --grep 'URL feedback'` | Meaningful red: the add form was absent |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-015.config.ts add-website.spec.ts websites.spec.ts profile.spec.ts` | 62 passed, mobile and desktop |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-015.config.ts add-website.spec.ts` after simplifying duplicate handling | 20 passed |
| `pnpm lint` | Passed, no diagnostics |
| `pnpm exec tsc --noEmit --incremental false` | Passed, no diagnostics |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed; public `/websites/new` present; all private routes excluded |
| `node /private/tmp/datano-fe-015-production.cjs` | Passed: manifest/client fixture isolation, 15 HTTP/RSC checks, public navigation and query isolation at 390/1440px |

An intermediate test run found ambiguous global alert locators because Next.js
also has a route announcer. Locators were scoped to the form; final runs passed.
Build's generated `next-env.d.ts` route-types reference was restored exactly to
the pre-task development value after verifying it was the only generated change.
The direct type check was rerun successfully afterwards.

Behavior tests cover 30 invalid URL cases, IDNA including Persian, canonical
identity, default ports, independent subdomains, same-account duplicates,
generic conflict, pending/error/registered fixtures, no invented public account,
no JavaScript, keyboard submission, invalid focus, review navigation and existing
profile/list regression. No mutation/API request, cookie or browser storage side
effect was observed in the tested form scenarios. Production checks intentionally
set `UI_REVIEW_ENABLED=1` and still received 404 for private HTML and RSC routes.
The temporary production server on port 3009 was stopped after validation.

No live backend, DNS, Google or ownership integration test was run: those features
are outside this task and are not claimed complete. No unit/component runner was
added. Unrelated browser suites were not repeated; the three affected suites ran.

## Changed files

Paths are relative to the repository root.

- `Frontend/app/(product)/(account)/websites/new/page.tsx`
- `Frontend/app/ui-review/websites/new/page.review.tsx`
- `Frontend/components/feature/websites/AddWebsiteForm/index.tsx`
- `Frontend/components/feature/websites/AddWebsiteForm/AddWebsiteFormController.tsx`
- `Frontend/components/feature/websites/AddWebsiteForm/DatanoAddWebsite.tsx`
- `Frontend/components/feature/websites/AddWebsiteForm/content.ts`
- `Frontend/components/feature/websites/AddWebsiteForm/validation.ts`
- `Frontend/components/feature/internal/AddWebsiteReview/index.tsx`
- `Frontend/components/feature/internal/AddWebsiteReview/DevelopmentAddWebsiteReview.tsx`
- `Frontend/components/feature/internal/AddWebsiteReview/fixtures.ts`
- `Frontend/components/feature/internal/WebsiteListReview/DevelopmentWebsiteListReview.tsx`
- `Frontend/tests/e2e/add-website.spec.ts`
- `Frontend/tests/e2e/websites.spec.ts`
- `Frontend/README.md`
- `Frontend/docs/design-system.md`
- `Frontend/docs/validation/FE-015-add-website.md`
- `docs/backlog.md` — only the FE-015 completion checkbox.

A pre-task SHA-256/source snapshot covered 300 files across Frontend, Backend and
docs. File comparison/unified source diffs were used instead of Git, respecting
the user's prohibition. No files were deleted; unrelated source, profile flows,
shared layouts/styles, backend, dependencies and configuration were preserved.

All FE-015 UI acceptance criteria passed. Only its Backlog checkbox is completed;
the rest of Epic 04 is pending and FE-016 was not started.
