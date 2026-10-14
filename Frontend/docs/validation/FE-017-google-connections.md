# FE-017 — Google source connection UI validation

Executed 2026-10-14. Scope: Epic 04 UI, dependent on completed FE-016.
No real OAuth, provider discovery, connection, disconnect, data receipt or Git.

## Delivered behavior and acceptance

- `/ui-review/websites/connect`: three optional, independent GA4, Search Console
  and Ads cards, each with its own state, selection, action and feedback. Product
  interactions preserve other cards' drafts/connections/errors. Waiting or failing
  sources do not block another connected source.
- Each source has one radio-selected property/account, with name and isolated
  identifier. Only eligible sample options can be selected; unrelated choices
  are disabled. Missing selection errors name the requirement, are associated with
  the group and focus its first eligible radio. Drafts survive registration error.
- Source states are `disconnected`, `authorizing`, `select`, `connected`,
  `cancelled`, `no-access`, `no-resources`, `revoked`, `disconnect-confirm`,
  `disconnect-pending` and `error`. Waiting, cancelled OAuth, missing permission,
  empty discovery and revoked permission are distinct. Revoked permission shows
  the previous selection as unusable and cannot enable receipt by itself.
- Cancel on a waiting sample changes only that source to cancelled; it does not
  cancel a real OAuth request or create credentials. Connect/reconnect/register
  actions report actual unavailability without pretending an integration exists.
- Disconnect uses a focused inline confirmation for the selected source. Its
  selected resource stays visible; the explanation limits consequences to this
  source and its dependent receipt. Cancel returns focus; confirm reports
  unavailability and retains the connection. Pending freezes only that card.
  Selecting disconnected in private review displays the disconnected outcome
  independently; a click does not simulate a successful real disconnect.
- Any one eligible connected source permits previewing the receipt step even if
  others fail/wait. Connection itself never creates a sync, data or ready report.
  The receipt destination remains a local notice until FE-018 is authorized.
- Successful FE-016 review navigates to source connection for the same sample
  hostname. The FE-014 verified/no-connection site also opens it. The private list
  backlink and its profile backlink are retained. Unverified ownership disables
  all source actions and offers the existing verification page.

## Review selectors and trusted boundaries

`ga4`, `gsc` and `ads` independently select the states above. Sites are allowlisted:
`no-connection` uses the existing verified FE-014 domain; `proof-example` and
`new` represent independently selected successful FE-016 proofs; `unverified`
retains the original unverified ownership state. Changing private selectors resets
the whole fixture, as its notice explains. Ordinary card actions remain independent.
Unknown/repeated selectors fall back to no-connection/disconnected. Arbitrary
role, permission, property, hostname, OAuth code or token parameters are ignored.

Private IDs use visibly inert `UI-REVIEW-*` identifiers or `.test` URLs. Eligibility
is supplied by deterministic fixtures, not inferred from hostname substrings.
Proof alone does not establish Google permission. Ads account access and association
with this website must both be checked by a future trusted backend. No scopes,
authorization URL, popup, callback route/API, credentials or provider schema were
invented. Sample states grant no product identity, permission or connection.

`/websites/[websiteId]/connect` follows the approved website namespace. It currently
shows guest access with Login and a public list backlink, not sample identities,
source data or query-controlled permission. The old `/sites/[siteId]` scaffold
remains unchanged. Production excludes private review routes and sample bundles
even when `UI_REVIEW_ENABLED=1`.

Actual OAuth/discovery/registration belong to FE-036/FE-038/FE-040 with
BE-022/BE-025/BE-028/BE-031. Real disconnect/replacement belongs to FE-042/BE-034.
Real ownership remains FE-035/BE-020. FE-018 owns receipt/readiness UI; it was not
started. No server API, client generation, environment change or dependency added.

## Architecture and design

Pages compose concrete injectors; the private injector parses allowlisted review
inputs and supplies presentation fixtures. The controller owns immutable local
source state/drafts and focus; pure UI receives primitive presentation props,
translations and callbacks. No fabricated data hook or API contract is introduced.
The public injector imports no private source controller or sample data.

The approved design system is reused without deviation: AccountLayout,
ProductLayout, neutral backdrop, Vazirmatn, Persian/RTL, shared Card/Button, brand
and destructive tokens and existing Activity/Search/Megaphone source symbols.
Cards stack on mobile and form three columns from lg. Resource names/IDs wrap;
technical values use LTR bdi. Native radio labels provide full click targets;
buttons retain 48px minimum heights. No new global primitive, token, gradient,
Google logo, header/footer change or profile redesign.

Automated layout checks cover all source states at 320/390/768/1440px, both themes
and 200% root text without horizontal overflow. Manual screenshot inspection
covered mixed source selection on desktop light, stacked mobile light and focused
disconnect confirmation on mobile dark. Public guest mobile was also inspected.
Screenshots are temporary files under `/private/tmp/datano-fe-017-results/`;
production public screenshots are `/private/tmp/datano-fe-017-public-390.png` and
`/private/tmp/datano-fe-017-public-1440.png`.

## Executed validation

Node 24.19.0, pnpm 11.25.0, Playwright 1.62.1. Production browser probe reported
installed Chrome 155.0.8059.40. The existing opted-in server at port 3000 was
reused and preserved. Temporary `/private/tmp/datano-fe-017.config.ts` imports the
repository Playwright config, overriding absolute test/output paths, reporter,
baseURL and server reuse; the repository configuration is unchanged.

| Command / check | Result |
| --- | --- |
| Initial `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-017.config.ts google-connections.spec.ts --project=desktop` | Meaningful red: source connection page absent |
| Initial `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-017.config.ts google-connections.spec.ts` | Basic source behavior: 2 passed |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-017.config.ts google-connections.spec.ts website-verification.spec.ts websites.spec.ts add-website.spec.ts profile.spec.ts` | 107/108 passed; all 82 regression cases passed; one mobile keyboard test failed before hydration enabled its button |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config=/private/tmp/datano-fe-017.config.ts google-connections.spec.ts` after adding enabled/focus waits | 26/26 passed on mobile/desktop |
| `pnpm lint` | Passed, no diagnostics |
| `pnpm exec tsc --noEmit --incremental false` | Passed, no diagnostics |
| `UI_REVIEW_ENABLED=1 pnpm build` | Passed; public connection route present, private routes excluded |
| `node /private/tmp/datano-fe-017-production.cjs` | Passed: manifest/client fixture isolation, 25 HTTP/RSC checks and public navigation/query isolation at 390/1440px |
| Final localhost check | `/ui-review/websites/connect` returned 200 on port 3000 |

The keyboard test now waits for enabled and focused before pressing Enter, then
asserts confirmation focus and cancellation focus restoration. No acceptance
assertion was removed. All new cases and affected regression cases passed; the
corrected new suite was rerun without repeating unrelated suites.

Tests cover each source alone, independent choices/errors, exactly one eligible
resource per source, keyboard selection, unrelated options, cancellation, missing
access/resources, revoked permission, disconnect target/consequences/focus,
retention on error, pending independence, ownership gating, query isolation,
matching navigation, RTL/responsiveness, no-JS accessibility and public access.
No mutation/API request, OAuth popup, credential, cookie, browser storage write
or real source/site change occurred in tested interactions.

Production checks intentionally set the review flag. All private HTML/RSC URLs
still returned 404; sample source IDs were absent from production client bundles.
The temporary production server on port 3009 was stopped. Build's only generated
`next-env.d.ts` route-types reference change was verified and restored exactly to
the pre-task dev value; the direct type check passed afterwards.

No real Google, backend, permission, OAuth or sync test was run: these capabilities
are absent/out of this UI task. No unit runner or provider dependency was installed.
No report-readiness or production integration success is claimed.

## Changed files

Paths are relative to the repository root.

- `Frontend/app/(product)/(account)/websites/[websiteId]/connect/page.tsx`
- `Frontend/app/ui-review/websites/connect/page.review.tsx`
- `Frontend/components/feature/websites/GoogleConnections/index.tsx`
- `Frontend/components/feature/websites/GoogleConnections/GoogleConnectionsController.tsx`
- `Frontend/components/feature/websites/GoogleConnections/DatanoGoogleConnections.tsx`
- `Frontend/components/feature/websites/GoogleConnections/content.ts`
- `Frontend/components/feature/internal/GoogleConnectionsReview/index.tsx`
- `Frontend/components/feature/internal/GoogleConnectionsReview/DevelopmentGoogleConnectionsReview.tsx`
- `Frontend/components/feature/internal/GoogleConnectionsReview/fixtures.ts`
- `Frontend/components/feature/websites/WebsiteVerification/WebsiteVerificationController.tsx`
- `Frontend/components/feature/internal/WebsiteVerificationReview/DevelopmentWebsiteVerificationReview.tsx`
- `Frontend/components/feature/internal/WebsiteListReview/DevelopmentWebsiteListReview.tsx`
- `Frontend/tests/e2e/google-connections.spec.ts`
- `Frontend/tests/e2e/website-verification.spec.ts`
- `Frontend/tests/e2e/websites.spec.ts`
- `Frontend/README.md`
- `Frontend/docs/design-system.md`
- `Frontend/docs/validation/FE-017-google-connections.md`
- `docs/backlog.md` — only the FE-017 completion checkbox.

A pre-task SHA-256/source snapshot covered 323 files across Frontend, Backend and
docs. File comparison/source diffs replaced prohibited Git inspection. No files
were deleted; unrelated code, backend, profile, shared layout/style, dependencies
and configuration were preserved. All FE-017 UI acceptance criteria passed, so
only its Backlog checkbox is complete. FE-018 remains pending. No Git command,
stage, commit, push or branch operation was performed.
