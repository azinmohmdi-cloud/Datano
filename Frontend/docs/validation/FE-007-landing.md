# FE-007 — public landing and explanatory preview

Initial validation: 2026-10-11. Authorized scope: FE-007 only.

The initial implementation record below is historical. The **2026-10-12 visual
redesign** section at the end supersedes its descriptions of the header, brand,
colors, illustrations, and test count.

## Prerequisite and implementation

FE-004 is checked complete and its shared shells/header/footer are present in
HEAD `ab9166b` (original layout commit `b2fa37a`). The initial working tree was
clean; baseline lint and TypeScript checks passed. Installed locked dependencies,
Node 24.19.0, and pnpm 11.25.0 were sufficient. No package was added or upgraded.

- `app/(product)/(public)/page.tsx` composes the concrete `DatanoLanding` injector
  and supplies page-specific Persian metadata. The `/` URL is unchanged.
- `components/feature/public/LandingPage/DatanoLanding.tsx` supplies static
  Persian translations, locally typed presentation records, and destinations.
  `index.tsx` renders pure UI, with internal semantic sections and the existing
  Card, buttonVariants, Lucide, and theme-token stack. Both remain server-renderable;
  no new client state, data hooks, API calls, or external visual assets are used.
- The hero, problem, receive/analyze/recommend workflow, five capabilities,
  reasons, audience, explanatory dashboard preview, and final CTA implement the
  approved landing scope. Product-development status is explicit near the hero
  CTAs; capabilities are presented as the intended product, not shipped services.
- Both start-use CTAs point to `/signup`; the services CTA points to `/services`.
  Prefetch is disabled for these pending destinations. The preview CTA stays on
  the landing at `#dashboard-preview`, scrolls to its heading, and focuses the
  labeled section, including without JavaScript.
- The static preview labels itself `نمای توضیحی؛ دادهٔ واقعی نیست`. It contains
  four named/source-labeled metrics with `—`, explanatory report areas, and
  descriptions of future evidence. There are no invented values, plot series,
  recommendation results, source-connection states, or demo controls.
- The existing ProductLayout/PublicLayout supply Persian typography/RTL, the
  single header/main/footer, and the four approved header items. Global fonts,
  tokens, shared layouts, and private-review infrastructure are unchanged.
- Responsive grids, logical spacing, LTR-isolated source names, visible focus,
  enlarged-text wrapping, and light/dark styling are included. Small-screen
  diagram blocks stack rather than compress their labels. Landing accent text
  uses the existing primary-foreground token in dark mode for readable contrast.
- The old invoice-link assertion in `ui-review.spec.ts` now checks the actual
  landing heading, preserving its home/Back and private-review boundary checks.
  Invoice example routes and their data/UI are unchanged. README documents the
  landing, destinations, and preview boundaries.

## Behavioral Red → Green and visual corrections

The new focused acceptance test ran before implementation and failed because
the homepage still had title `دیتانو`, rather than the required landing title.
The implemented page passes the same assertion and the subsequent section,
preview, navigation, and responsive assertions.

Visual inspection identified two issues within the new landing:

1. The preview label's dark-mode contrast measured **2.6489:1**. A focused test
   reproduced the failure against a 4.5:1 readability check. Using the existing
   light foreground token for landing accents fixes it; both themes now pass.
2. At 200% root text size, Hero's overflow-hidden decoration concealed overflowing
   headline/diagram text. The original page-overflow assertion alone could not
   detect this. A stronger test reproduced five overflowing text blocks. Inherited
   wrap-anywhere, mobile typography/spacing, and stacked diagram blocks fix the
   clipping. The strengthened test still asserts readable text within its own
   container, rather than accepting a page with hidden overflow.

## Executed validation

Commands ran from `Frontend/` with the compatible runtime first in PATH:

```sh
export PATH="/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

| Final check | Result |
| --- | --- |
| `pnpm lint` | PASS, exit 0, no diagnostics |
| `pnpm exec tsc --noEmit --incremental false` | PASS, exit 0 |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e` | PASS, 16/16, mobile and desktop; zero failures/skips/retries |
| `pnpm build` | PASS, exit 0; `/` is static, existing invoice/API routes retained; no review route |
| `node /private/tmp/datano-fe-007-production-check.cjs` | PASS, five HTTP checks and no-JS browser checks at 390/1440px |
| `git diff --check` and final file/status audit | PASS; FE-007 changes only |

The permanent browser tests cover:

- Approved headings/content, page title, explicit development status, one set of
  landmarks, the exact header options, no private fixture marker, and no API
  request or uncaught page error while rendering the landing.
- Two signup hrefs, the services href, real navigation to the reserved signup
  URL, keyboard preview activation/focus/scroll, and browser Back.
- `lang=fa`, `dir=rtl`, inherited Vazirmatn, mobile/desktop projects, plus 320,
  768, and 1440px widths in both token sets. Navigation fits the viewport; page
  overflow and text clipping at 200% are checked. The explanatory label has at
  least 4.5:1 contrast in both themes.
- Server-rendered landing and native preview navigation with JavaScript disabled.
- All existing skip-link/private-review RTL, home/Back, deterministic sample
  state, reset, and cookie/storage isolation regressions.

The temporary production harness starts/stops its own server on port 3008,
using installed Chrome **154.0.8037.98**. It verifies `/` and both invoice pages
return 200; bare/parameterized `/ui-review` return 404 even with the runtime flag
enabled; no private fixture email leaks into those responses. Homepage SSR has
the Persian document, real landing copy, and exact CTA hrefs. Browser contexts
at 390/1440px with JavaScript disabled verify title, landmarks, no horizontal
overflow, preview focus, and four absent-value marks. No page errors were seen.

Full-page light/dark images at 320/768/1440px and enlarged text are generated in
ignored `test-results/`. Representative desktop, mobile, tablet dark, enlarged
text, and production hero/preview captures were visually reviewed for Persian
shaping, wrapping, spacing, hierarchy, and preview-label clarity. QA crops and
production captures remain under `/private/tmp/datano-fe-007-*`; no generated
image is added to application source.

## Environment limits and remaining scope

- The sandbox initially denied the local test server with `listen EPERM` and
  could not fetch the existing Google Fonts for build. Approved execution outside
  the sandbox resolved both; these are environment failures, not behavioral Red.
  Fonts and network policy were not changed to bypass the failures.
- Matching Playwright Chromium remains absent from the local cache; FE-006
  records the official download's HTTP 403/location restriction. These runs
  explicitly use installed Chrome. A bundled-Chromium run is not claimed.
- `/signup` and `/services` remain unimplemented until their own tasks; their
  reserved URLs currently return 404. No placeholder route or authentication
  success was introduced. `/about`, FE-008, FE-009, and later tasks are unchanged.
- Backend tests, Orval generation, provider integration, and database checks are
  not applicable to this static frontend task. No backend/API contract changed.
- Only FE-007's Backlog checkbox is updated after acceptance. No files were
  staged, committed, pushed, or deployed, and no later task was started.


## 2026-10-12 visual redesign — current implementation

The user explicitly authorized redesigning FE-007 and the shared header/brand.
Existing uncommitted FE-007 work was preserved. FE-004 remains the completed
prerequisite; FE-008/FE-009 and authentication work remain outside this change.
No dependency, lockfile, backend contract, route, or product capability was added.

### Design and architecture

- `ProductLayout/header.tsx` remains a server shell. The header has a prominent
  home-linked Datano wordmark at the right, a provisional geometric SVG mark,
  the same four approved navigation options, an account icon, and a blue login
  action. The shared `brand.tsx` also updates the existing footer brand.
  This mark is temporary and is not an approved final logo.
- `ProductLayout/navigation.tsx` is the focused client boundary. Desktop links
  form one row. Mobile/tablet use native `details`/`summary`, which still opens
  without JavaScript. Native open state drives the menu icon. Enhancements add
  Escape with focus return, closure when focus leaves the disclosure or a link
  is selected, and `aria-current` based on pathname. No session/role is inferred.
- The static page → injector → pure landing UI composition is retained.
  The injector supplies Persian copy, accessible chart descriptions, source and
  unit labels, and destinations. No fetching or feature client state was added.
- Hero now uses a blue/purple surface, stronger headline, clear CTA hierarchy,
  a conceptual analytics illustration, and a floating evidence card. Problem
  and reasons use split layouts; workflow has a numbered visual sequence;
  features use two larger illustrated blocks and three secondary blocks;
  audience is a quieter icon-led row; the final CTA has a distinct soft surface.
- Hand-coded SVGs render a smooth line, light area fill, a secondary dashed
  shape, a subtle point, and rounded bars. Geometry is fixed illustration, with
  no quantitative scale, tooltip, date series, or generated recommendation.
  Unique `useId` gradients avoid collisions. Meaningful SVGs have Persian titles;
  decorative SVGs/icons are hidden from assistive technology. No animation or
  heavy chart library was introduced. A donut was not used because no meaningful
  source distribution is established for this conceptual preview.
- The explanatory dashboard includes four source/unit-labeled KPI placeholders,
  traffic/search/ads visual areas, an evidence panel, and a noninteractive period
  label. Its explicit notice and caption distinguish illustration from account
  data. Signup/services destinations and the focused preview anchor are retained.
- Brand colors/surfaces/secondary text are centralized in `app/globals.css` with
  light/dark values. Existing analytical chart tokens and unrelated UI defaults
  remain unchanged. Generic Lucide icons identify sources; no Google logo or
  external asset is invented. RTL, Vazirmatn, and isolated LTR source names remain.

### Behavioral evidence and corrections

- Before implementation, the focused mobile-menu test failed because its named
  toggle did not exist. It passes after implementation.
- Initial browser runs found missing explicit role lookup on the native summary,
  compressed floating-card text at 200% font size, and brand/menu geometry that
  overflowed after fonts loaded at 200%. The accessible button role, responsive
  mini-chart visibility, and fixed-size 44px brand/menu controls corrected them.
- The test checks native `details.open` rather than an `aria-expanded` attribute:
  duplicating native state in an SSR attribute could become stale without JS.
  It covers Enter/Tab/Escape, focus return, focus-leave closure, and navigation.
- The added shell regression initially used rapid document navigation between
  review URLs and observed an intermittently closed menu. The final regression
  uses the actual scope selector and awaits the resulting URL/selection, then
  verifies visible links, destinations, landmarks, and overflow in all three
  shells. Diagnostic logging was removed; no private-review application code or
  existing behavioral assertion was disabled.

### Final executed checks

Node 24.19.0 / pnpm 11.25.0; commands from `Frontend/` with the compatible PATH
shown in the initial record. Chrome **154.0.8037.98** was explicitly selected.

| Check | Result |
| --- | --- |
| `pnpm lint` | PASS, exit 0 |
| `pnpm exec tsc --noEmit --incremental false` | PASS, exit 0 |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e` | PASS, 20/20 in 22.1s; no skips/retries |
| `pnpm build` | PASS; homepage statically rendered; private review excluded |
| `node /private/tmp/datano-fe007-redesign-production.cjs` | PASS; five HTTP checks, no-JS browser checks at 390/1440px; no page errors |
| `git diff --check` | PASS |

The suite verifies the approved content, destinations and preview focus, absence
of API requests, conceptual SVG labels, four absent-value KPI marks, Persian/RTL
and Vazirmatn, narrow/tablet/desktop layout, dark/light label contrast >= 4.5:1,
200% text without clipping or page overflow, keyboard/no-JS behavior, and shared
public/account/site shells. Font readiness is awaited for layout measurements.

Production checks confirm `/` and both invoice examples return 200, both private
review URLs return 404 even with the runtime flag enabled, and no private fixture
marker leaks. Production menu and preview remain functional without JavaScript.
Desktop hero/dashboard, mobile menu/hero, 320px mobile, tablet dark, and 200% text
captures were visually inspected. Screenshots are ignored test outputs or local
QA artifacts under `/private/tmp/datano-redesign-*`, not application assets.

### Changed-file map and limits

Current redesign edits: `app/globals.css`; `components/layout/ProductLayout/`
`header.tsx`, `brand.tsx`, new `navigation.tsx`; `components/feature/public/`
`LandingPage/index.tsx` and `DatanoLanding.tsx`; `tests/e2e/landing.spec.ts` and
`ui-review.spec.ts`; `README.md`; and this validation record. The page metadata
file and FE-007 Backlog checkbox are retained from the initial implementation.

Matching bundled Chromium remains unavailable as recorded by FE-006; these are
Chrome runs, not a bundled-Chromium or cross-browser certification. Signup,
services, about, login, and account destination implementations remain pending
and currently return 404. The brand is provisional, charts are conceptual, and
no backend/authentication success or live integration is claimed.

FE-007 remains `[x]`; no other Backlog status changed. No stage, commit, push,
deployment, or later task was performed.
