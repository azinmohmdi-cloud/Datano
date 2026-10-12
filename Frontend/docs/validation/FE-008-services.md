# FE-008 — public services page

Validation date: 2026-10-12. Authorized scope: FE-008 only.
Initial HEAD: `3c882f4`; initial working tree clean.

The initial implementation record below is historical. The **Final user-requested
revision** at the end supersedes its descriptions of the services hero, standalone
workflow/dashboard sections, CTA count, page backdrop and current test coverage.

## Prerequisite and acceptance

FE-004 is complete and its ProductLayout/PublicLayout, brand, navigation,
footer and skip link are present. The approved design system and FE-007 provide
the visual baseline. Node 24.19.0, pnpm 11.25.0, and existing locked packages were
sufficient; no installation, dependency/lockfile change or backend was required.

| Acceptance | Delivered evidence |
| --- | --- |
| GA4, Search Console and Ads introduced | Three source cards describe their distinct metrics, constraints and intended roles |
| Dashboard and recommendations introduced | Integrated-dashboard structure and rule/evidence sections, explicitly under development |
| Receive → analyze → recommend | Source-to-dashboard hero diagram and ordered three-step workflow |
| CTAs have clear destinations | Two signup links to `/signup`; local workflow/recommendation anchors; preview to `/#dashboard-preview` |
| Public scope remains truthful | Development notice, labeled conceptual SVGs and `—` placeholders; no actual connection, result, API or generated recommendation |

## Implementation and design-system consistency

- `app/(product)/(public)/services/page.tsx` defines Persian metadata and composes
  the concrete `ServicesPage/DatanoServices.tsx` injector. The existing public
  route group supplies the shared shell. `/services` is statically rendered.
- The injector owns all Persian copy, accessible SVG descriptions, locally typed
  presentation records and destinations. `ServicesPage/index.tsx` is pure UI,
  with internal blocks for hero, sources, workflow, dashboard, evidence and CTA.
  No feature client boundary, data hook or fabricated contract was introduced.
- The approved blue/purple tokens, soft surfaces/gradients, Vazirmatn, Lucide
  symbols, semantic headings, CTA recipe and responsive page widths are reused.
  No new color, font, logo, icon family or chart library was added. ProductHeader,
  ProductFooter, navigation order, shared layouts and global CSS are unchanged.
- Public visualizations have distinct roles: source relationships in the hero,
  conceptual traffic line for GA4, conceptual bars for Search Console, absent-value
  Ads metrics, dashboard KPI structure, and an evidence explanation. No donut,
  actual date series, quantitative scale, successful connection or result appears.
- The original FE-007 SVG geometry was moved to shared
  `components/ui/concept-chart.tsx` because a second public page now needs it.
  Line/bar paths, colors, sizes, guides, gradients and markup behavior are retained.
  LandingPage imports this component instead of its private helper. The props
  require a label for meaningful charts or `decorative: true`; there is no data
  input. This is the only landing-code change and is a justified reuse extraction.
- CTA/internal targets support keyboard and native navigation. Workflow and
  recommendation sections have labeled, focusable hash targets. Signup remains
  pending FE-011; FE-008 does not invent its form or session success.
- Product copy preserves independent optional sources, source/unit/currency
  meaning, partial/empty reports, and the distinction between absent data and
  valid zero. Recommendations depend on valid sufficient evidence and a rule;
  no causal certainty, growth guarantee or automatic action is promised.
- README and the design-system reference were updated for the delivered public
  services page and shared ConceptChart API. No engineering guide was rewritten.
  There is no visual deviation from the approved design language.

## Red → Green and visual review

The focused acceptance test ran before implementation and failed because
`/services` returned **404**, while the test requires 200. After implementation,
the same test passes along with five-capability, workflow, honesty and no-API
checks. This was a behavioral failure, not a tool/network failure.

The first full suite passed 28/28. Visual inspection then found a narrow-screen
layout issue: the hero's three-column source diagram split “Search Console”
inside its word at 320px. Mobile sources now use separate icon/text rows, with
the original three-column connectors retained from sm upward. No hidden overflow
or reduced font was used to conceal it. The final 28-test run also passes.

Generated captures include 320/768/1440px in both themes and 200% root text.
Desktop composition, mobile source diagram, tablet dark, enlarged text, and
production output were visually inspected for Persian shaping, hierarchy,
source-label readability and wrapping. Screenshots are QA artifacts in ignored
`test-results/` or `/private/tmp/datano-fe-008-*`; they are not application assets.

## Final executed validation

Commands ran from `Frontend/` with the compatible runtime first in PATH:

```sh
export PATH="/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

| Check | Result |
| --- | --- |
| `pnpm lint` | PASS, exit 0, no diagnostics |
| `pnpm exec tsc --noEmit --incremental false` | PASS, exit 0 |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e` | PASS, final 28/28 in 29.9s; no skips/retries |
| `pnpm build` | PASS, final exit 0; `/` and `/services` static; private review excluded |
| `node /private/tmp/datano-fe-008-production.cjs` | PASS, 8 HTTP checks and no-JS checks at 390/1440px |
| `git diff --check` and final scope audit | PASS; FE-008 and necessary reuse/docs only |

The permanent new services tests run in mobile and desktop projects and cover:

- Direct route/status/metadata, all five capability headings, ordered workflow,
  development/optional-source notices, two labeled conceptual charts, one set of
  landmarks, no private fixture marker, no API request or uncaught page error.
- Actual home-header → services navigation and current-page indication; exact
  menu order, signup hrefs/navigation, keyboard workflow focus, recommendation
  focus, cross-page dashboard-preview navigation and browser Back.
- Persian document/RTL and Vazirmatn; 320/768/1440px in light/dark, SVG bounds,
  no page overflow, and 200% text without clipping inside its container.
- Server-rendered content and native workflow navigation without JavaScript.

All existing landing, skip-link, shared-shell and private-review tests remain
enabled and pass, including their keyboard, contrast, theme, no-JS and storage
isolation checks. Chrome **154.0.8037.98** was explicitly used. Matching bundled
Chromium is unavailable on this workstation as documented by FE-006; no bundled-
Chromium or cross-browser result is claimed.

The temporary production harness starts/stops its own Next server on port 3008.
It verifies `/`, `/services` and both invoice examples return 200; `/ui-review`
with/without parameters returns 404 even with the runtime flag enabled; pending
`/about` and `/signup` remain 404. No private fixture email appears in responses.
Services SSR contains the correct title, content and CTA hrefs. No-JS browser
checks at 390/1440px verify title/RTL/landmarks, no overflow, local workflow focus
and native navigation/focus of the existing homepage preview. No page errors
were observed; the harness closes its browser and server.

## Changed files and remaining scope

| File | Change |
| --- | --- |
| `app/(product)/(public)/services/page.tsx` | New static route/metadata |
| `components/feature/public/ServicesPage/DatanoServices.tsx` | New concrete injector/copy |
| `components/feature/public/ServicesPage/index.tsx` | New pure UI and local explanatory blocks |
| `components/ui/concept-chart.tsx` | Approved SVG extracted for real reuse |
| `components/feature/public/LandingPage/index.tsx` | Import shared SVG; remove duplicate private helper |
| `tests/e2e/services.spec.ts` | Four acceptance journeys, each run in both projects |
| `docs/design-system.md` | Shared SVG availability/source references |
| `README.md` | Current public routes and services boundaries |
| `docs/validation/FE-008-services.md` | This record |
| `../docs/backlog.md` | Only FE-008 checkbox changed to `[x]` |

FE-009/about, auth forms, account routing, operational charts and provider
integrations remain pending their own tasks. Backend tests, Orval generation,
Google API checks and database checks are not applicable to this static public
frontend task. No API/session/backend contract changed.

FE-008 is marked complete only after the checks above. No other Backlog status,
description or ID changed. No Stage, Commit, Push, deployment or next task was
performed. No unresolved in-scope acceptance failure remains.

## Final user-requested revision — 2026-10-12

The user explicitly requested a shorter services page and revised page-background
standards. This authorization supersedes the original FE-008/UX composition; no
Backlog acceptance text or task status was rewritten for this revision.

### Current result and preservation

- The only content sections are Hero, sources, rule-based recommendations, and
  the original closing CTA, inside the existing shared header/footer.
- Hero is now a centered editorial title/description above the original source
  diagram. The exact requested title is «سرویس‌های دیتانو؛ از داده تا تصمیم»;
  the supplied description is used verbatim. The two title phrases stack below
  sm and flow inline above it. Hero no longer contains an eyebrow, action links,
  development note, or extra labels outside the existing diagram.
- The standalone workflow and integrated-dashboard sections, their unused copy,
  prop types, hash links and preview CTA were removed. The diagram still explains
  source → dashboard → analysis/recommendation and retains its original internal
  labels, icons, paths and conceptual/no-real-data caption.
- Source-card functions, copy, icons, charts and responsive grid are unchanged.
  Recommendations/evidence and closing CTA functions/copy are also unchanged.
  The only content action is the existing signup link to `/signup`, with its
  original text, icon and styles. The shared header/footer links are unchanged.
- Before/after captures and normalized inner-markup comparisons at 390/1440px
  confirm preservation of the sources, recommendations, closing and diagram
  content. SVG useId values are normalized for this comparison. Literal PNG
  equality is not claimed: the requested page backdrop, changed section positions
  and resized hero diagram affect raster output. Final visuals were inspected.
- New editorial colors are centralized in `app/globals.css`: pale rose
  `#fdf7fb` → lavender `#f7f4fd`, with dark counterparts `#19171f` → `#1e1b2b`.
  `main:has(.page-surface-editorial)` applies the 135° gradient only when its page
  opts in. Only services currently opts in; no viewport-sized overflow layer,
  shared-shell change or background change on another route is introduced.
- The Design System records the same background for the future about page and
  light blue `#f3f7ff` for future dashboard/profile, with a proposed dark workspace
  adaptation. Those pages and the workspace token are not implemented or changed.
  The approved brand palette, logo, fonts, shared SVG and icon library remain.
- README and this record describe the final structure. The Design System records
  the explicit user-approved composition/background change; it is not an
  unreported deviation or permission to start another task.

### Executed validation for this revision

Node 24.19.0 / pnpm 11.25.0; commands from `Frontend/`, with the compatible PATH
shown above. Browser: installed Chrome 154.0.8037.98.

| Check | Result |
| --- | --- |
| `pnpm lint` | PASS, exit 0 |
| `pnpm exec tsc --noEmit --incremental false` | PASS, exit 0 |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --config /private/tmp/datano-fe-008-final.config.mjs landing.spec.ts services.spec.ts navigation.spec.ts` | PASS, 20/20 in 22.4s |
| Same temporary config with `services.spec.ts`, after mobile title wrapping adjustment | PASS, 8/8 in 9.9s |
| `pnpm build` | PASS, final exit 0; static `/services`, private review excluded |
| `node /private/tmp/datano-fe-008-production.cjs` | PASS; 8 HTTP checks and no-JS 390/1440px checks for the final structure and sole signup CTA |
| `node /private/tmp/datano-fe-008-preservation.cjs after` | PASS for preserved normalized inner markup across 8 captures; no PNG-equality claim |
| `git diff --check` and documentation/scope audit | PASS |

The services tests now assert exact title/description, four content sections,
absence of the removed standalone blocks, no Hero links/buttons, a preserved
conceptual figure, three source headings, recommendations, no API/errors, and one
signup CTA in the closing section. Navigation, current-page state, keyboard signup,
Back, no-JS signup, both themes, page-only background, header/footer background
isolation, SVG bounds, 320/768/1440px and 200% text remain covered. Existing landing
and skip-link tests pass; homepage does not opt into the new backdrop.

Tests used the already-running development server on port 3000 and a temporary
config outside the repository. The private `/ui-review` catalogue is disabled on
that server (404), so its 8 tests were not rerun in this revision. They passed in
the initial 28-test run above; that historical result is not presented as a new
run. No catalogue, fixture or shared navigation code changed, and the user's
development process was not stopped. Production QA used its own port-3008 server
and closed it afterwards. Bundled Chromium is still not claimed.

Files touched by this final revision: `app/globals.css`, the two ServicesPage
modules, `tests/e2e/services.spec.ts`, `docs/design-system.md`, `README.md`, and
this record. Earlier uncommitted FE-008 work was preserved. FE-008 remains `[x]`;
FE-009 and all other tasks/statuses remain unchanged. No Stage, Commit or Push.
