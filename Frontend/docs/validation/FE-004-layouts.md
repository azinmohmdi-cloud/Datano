# FE-004 — shared product layouts, header, and footer

Validation date: 2026-10-11. Authorized scope: FE-004 only.

## Dependency and implementation

FE-003 is complete in `ba84e96`. The initial working tree was clean. Existing
Node 24.19.0, pnpm 11.25.0, and frozen installed dependencies were sufficient.
No dependency was installed/upgraded and no additional task was required.

- `components/layout/ProductLayout/` owns the shared header, footer, brand
  wordmark, navigation destinations, skip link, and single main landmark.
- PublicLayout, AccountLayout, and SiteLayout provide responsive content
  containers. Account width is capped at 1024px; public/site width at 1280px
  with the existing default root font size. They inherit Persian typography/RTL
  and render inside ProductLayout without duplicating the document landmarks.
- `app/(product)/layout.tsx` guarantees one shared header/footer for product
  descendants. Inner layouts select public/account/site content scope.
- The starter homepage moved to `app/(product)/(public)/page.tsx`, retaining `/`
  and its invoice links. Its fullscreen sizing was removed so it participates in
  the shared layout. English invoice examples and their existing layout are intact.
- Header navigation has exactly the four approved options, plus the home-linked
  wordmark. Its mobile grid and desktop row keep links directly accessible.
- Footer uses the same ProductFooter implementation in every scope: brand,
  home/services/about quick links, and the exact approved copyright text.
  No confirmed contact details/logo asset exist; the brand is a text wordmark.

Layout components remain server-renderable and add no client state/provider.
Native Next links and `buttonVariants` reuse the existing primitive styling.
No session detection, authorization, account redirects, dashboard navigation,
product page content, or private UI route was introduced. README explains the
route tree, composition contract, destinations, and pending pages.

## Required checks

From `Frontend/`, with Node 24.19.0 first in PATH:

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS, exit 0 |
| `pnpm exec tsc --noEmit --incremental false` | PASS, exit 0 after development type regeneration |
| `pnpm build` | PASS, exit 0, existing route URLs retained |

The first direct typecheck after moving the homepage found a stale reference to
`app/page.js` in ignored `.next/dev/types/validator.ts`. Production build had
regenerated production types, but not that development file. Starting Next dev
and requesting `/` regenerated the development route types; direct typecheck
then passed. No generated type file, config, or rule was manually edited/disabled.

The temporary `/private/tmp/datano-fe-004-dev.cjs` starts Next dev on port 3005,
requests the homepage, verifies Persian HTML with one header/footer, and stops
the server. This passed. Build/dev used approved execution and access to existing
Google Fonts resources.

## Behavioral red/green and browser checks

Before implementation, `/private/tmp/datano-fe-004-check.cjs` failed for the
expected behavior: **“Public homepage must render the shared product header on
the server”**. The starter homepage lacked that header. The final checks pass.

The temporary harness uses bundled Playwright/headless Chrome; it starts Next
production on port 3004, verifies SSR/actual homepage behavior, and also bundles
the actual App Router layout exports with the already-installed transitive
esbuild. Controlled public/account/site content is mounted only in the browser
DOM, retaining production CSS/fonts. No fixture page or browser dependency was
added to the repository. The fixture's standalone bundler defines Next's build
environment constants; its initial missing `process.env` definition was a harness
failure, corrected independently of application code.

Invocation:

```sh
/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/datano-fe-004-check.cjs
```

Companion fixture: `/private/tmp/datano-fe-004-fixture.tsx`.

Passed at **320, 390, 768, and 1440 pixels**, light/dark:

- Actual homepage SSR header/footer and exactly one banner/main/contentinfo.
- Exactly four header options with their reserved hrefs; home-linked wordmark;
  exactly three footer quick links plus brand; exact copyright text.
- All header links have visible geometry and remain within the viewport.
- Skip link receives first keyboard focus, becomes visible, and Enter focuses
  main content. Tab reaches the logo and all four header links with visible focus.
- The actual homepage also passes with JavaScript disabled at 390px.
- Public/account/site layout exports render short/long Persian content with the
  **identical footer HTML** in every scope. Footer follows growing content and
  rests at the viewport bottom for short content; it is neither fixed nor overlaid.
- Content max widths match the intended scopes on desktop. No horizontal page
  overflow for long/unbroken text or with text enlarged to 200%; enlarged header
  text fits within its links. Supplied cards/fields preserve input values and LTR
  URL direction.
- No uncaught page or browser console errors.

Screenshots are under `/private/tmp/datano-fe-004-*`. Production homepage
captures use `production-<width>-<theme>`; fixture captures use the scope name;
enlarged-text captures use `zoom-<width>`. Captures disable finite animations so
theme transitions finish before visual inspection. These are test artifacts,
not product pages. Representative mobile/desktop/zoom images were visually
inspected for readable Persian, RTL placement, spacing, focus, and footer flow.

## Regression and scope limits

The temporary FE-002 typography/pages harness and FE-003 shared-UI harness were
rerun against the resulting production build; both passed (exit 0):

- `/private/tmp/datano-fe-002-check.cjs`: SSR language/direction/metadata; homepage
  and both invoice pages at 390/768/1440px; deterministic invoice rows (2 personal,
  5 admin); LTR fields/code, exact text selection, and actual Persian font rendering.
- `/private/tmp/datano-fe-003-check.cjs`: field label/error linkage and cleanup;
  checkbox/native FormData/required/disabled behavior; keyboard focus/actions;
  cards/statuses, light/dark, wrapping, and reduced motion at the same three widths.

Each was invoked with the same bundled Node executable shown above and cleaned
up its production server/browser after completion. `git diff --check` also passed.

The account/site layouts currently have no leaf pages. Reserved header/footer
destinations `/account`, `/about`, `/services`, `/login` still return 404 until
their explicitly requested tasks are implemented. This task supplies layout
composition and destination contracts; it does not claim those pages or session
routing are functional. FE-030 owns trusted-session account routing. Header links
disable automatic prefetch to pending destinations.

FE-005 private fixtures and FE-006 project browser infrastructure remain pending.
Temporary harnesses depend on workstation tools and are not a configured project
test runner. Backend/API generation were not applicable. Root font/provider setup,
dependencies, lockfile, backend, and engineering guides are unchanged. No files
were staged, committed, pushed, or deployed.
