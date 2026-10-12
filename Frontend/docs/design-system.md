# Datano design system

Established 2026-10-12 from the user-approved FE-007 landing, including the
subsequent header-order correction. Initial source baseline: Git commit `34ff723`.
Paths below are relative to `Frontend/` unless a link specifies otherwise.

This is the visual reference for every future product UI task. It preserves the
approved identity; it does not authorize implementing a page, changing product
scope, installing a library, or adding an API. Read it alongside the
[frontend guide](../AGENTS.md), [component cookbook](cookbook/component-development-framework.md),
[UX specification](../../docs/datano-ux-pages-.md),
[MVP decisions](../../docs/Datano_MVP.md), and [Backlog](../../docs/backlog.md).
Product requirements govern meaning and behavior; this document governs visual
consistency. Existing invoice examples are not the product's visual reference.

## 1. Evidence and design principles

Two labels distinguish evidence from work that has not been implemented:

- **Existing baseline**: values, components, and behavior verified in current
  source. Reuse these rather than creating another implementation or token.
- **Future standard**: a rule or proposed recipe for a later authorized task.
  This does not mean its component, dependency, or behavior exists today.

The identity is Persian, precise, calm, and centered on marketing analytics.
Blue establishes the primary action; purple provides a controlled secondary
accent. Neutral surfaces, readable copy, soft gradients, restrained depth, and
purposeful Lucide icons support the content. Use visualization to explain data
and analysis, while distinguishing conceptual illustrations from real results.

Retain varied compositions: split text/visual sections, a numbered process,
larger illustrated features, quieter supporting rows, and clear final actions.
Do not turn every section into the same icon/title/card pattern. Public pages,
forms, analytics workspaces, and administration share an identity, not an
identical landing layout. No invented customer counts, statistics, successful
connections, sessions, endorsements, or promised growth may be introduced.

### Content Guidelines — permanent product standard

These guidelines apply by default to content generation and review for all current
and future Datano pages in every frontend task.

- **Product value first:** public pages introduce services, capabilities, and
  Datano's verified value in professional, user-centered language. Keep engineering
  progress and development stages out of marketing copy.
- **No automatic disclaimers:** do not add or repeat statements such as «محصول در
  حال توسعه است», «این بخش صرفاً نمایشی است», «قابلیت هنوز عملیاتی نیست», or «داشبورد
  واقعی نیست» throughout public pages or UI sections merely because implementation
  is incomplete. Avoid equivalent recurring development warnings.
- **Technical reporting belongs in documentation:** record development progress,
  API connection status, implementation limitations, and unfinished capabilities
  in project documentation and task reports, rather than repeatedly in site copy.
- **Claims must remain truthful:** never describe an unimplemented capability as
  active or usable, fabricate statistics or results, or show invented success.
- **Clarify previews only when needed:** when users could mistake a preview for
  real data or functionality, use a short, non-repetitive label such as
  «پیش‌نمایش مفهومی». Avoid long explanations and repeated warnings; do not remove
  context necessary for truthful interpretation.
- **Operational states remain explicit:** signup, source connection, and dashboard
  flows must honestly communicate actual unavailability, failures, and relevant
  limitations when they affect the user's action or understanding. Keep the message
  proportionate to that need; never hide an error or simulate success to reduce copy.
- **Natural Persian voice:** use fluent, clear, professional Persian suited to the
  audience. Describe the user's goal and product meaning; avoid developer jargon
  and backend implementation details in marketing language.

Preserve existing approved rules. If an explicit approved requirement conflicts
with this policy, report the specific conflict rather than silently removing or
rewriting that requirement. Historical label examples elsewhere in this document
are not an instruction to add repeated disclaimers. Updating existing UI under
this policy requires that UI to be within the authorized task's scope.

## 2. Colors and tokens — existing baseline

The single runtime source is [app/globals.css](../app/globals.css).
`@theme inline` exposes CSS variables through Tailwind utilities: for example,
`--brand-blue` becomes `bg-brand-blue`, `text-brand-blue`, and
`border-brand-blue`; SVGs use `var(--brand-blue)`. The values in these tables
document that source; they are not a second palette to copy into components.

### Approved brand palette

| CSS variable | Light | Dark | Current role |
| --- | --- | --- | --- |
| `--brand-blue` | `#3956d9` | inherited `#3956d9` | CTA/login fill, mark background, primary SVG stroke |
| `--brand-purple` | `#7350c7` | inherited `#7350c7` | Complementary stroke, evidence accents, subtle borders |
| `--brand-lilac` | `#b9b2ff` | inherited `#b9b2ff` | Mark detail, secondary dashed chart shape |
| `--brand-ink` | `#344ac0` | `#b9c5ff` | Readable accent text/icons, current navigation item |
| `--brand-soft` | `#f0f2fc` | `#22253e` | Icon/badge backgrounds, evidence and selected surfaces |
| `--brand-panel` | `#f8f9fd` | `#191c2c` | Larger supporting sections, KPI/card surfaces |
| `--brand-muted` | `#5b647a` | `#b4bbd0` | Landing secondary text, contextual labels, chart guides |

Brand fill and accent text have different roles. For small text on dark surfaces,
use `text-brand-ink`, not an automatic `text-brand-blue` replacement. Verify
contrast for the actual foreground/background combination and opacity.

### Page background policy — approved public pages

The user's final services revision adds a quiet page-level palette alongside
the unchanged brand colors. Page backdrops do not recolor logos, icons, charts,
controls, cards, the shared header/footer, or the homepage hero.

| Page | Approved backdrop | Runtime status |
| --- | --- | --- |
| Services | Existing pale lavender `#f7f4fd` → icy blue `#f2f8fd`, 135° linear gradient | Applied only to `/services`; unchanged by FE-009 |
| About | Very pale icy blue `#f2f8fd` → lavender `#f7f4fd`, 135° linear gradient | Applied only to `/about` in FE-009; replaces the earlier rose/lavender decision |
| Login | Very pale icy blue `#f2f8fd` → lavender `#f7f4fd`, 135° linear gradient | Applied to `/login` in FE-010 and its private form review; header/footer unchanged |
| Signup | Same quiet icy-blue/lavender gradient as Login | Applied only to `/signup` and its private form review in FE-011 using the existing login backdrop tokens |
| Recovery | Same quiet icy-blue/lavender gradient as Login | Applied to `/forgot-password` and its private form review in FE-012 using the existing login backdrop tokens |
| Dashboard | Very light blue `#f3f7ff`; proposed dark adaptation `#171e2b` | Approved future page standard; not applied or defined as a runtime token yet |
| Profile | Same very light blue as dashboard | Approved future page standard; no profile change here |
| Homepage and other current pages | Existing background | Unchanged |

Existing editorial tokens in `app/globals.css` are
`--page-editorial-start: #fdf7fb` and `--page-editorial-end: #f7f4fd` in light
mode, with `#19171f` and `#1e1b2b` respectively in dark mode. The runtime recipe
is `linear-gradient(135deg, var(--page-editorial-start), var(--page-editorial-end))`.
An explicit `page-surface-editorial` class in the page UI opts its containing
`main` into this backdrop using `main:has(.page-surface-editorial)`. It fills the
content area and gutters without viewport-sized decorative elements or altering
the header/footer. Services overrides the light tokens only on
`main:has(#services-title)`; About uses the reverse color order only on
`main:has(#about-title)`. Both retain the existing dark adaptation. The FE-009
About palette supersedes its earlier pink backdrop without changing Services,
the homepage, shared navigation, or future dashboard/profile policy.

Keep these colors low-saturation and restrained. Dashboard/profile implementation
should introduce one central workspace-background token for the approved blue
standard when needed; do not scatter the value or apply it to AccountLayout or
SiteLayout prematurely. Neither future page is implemented by this policy.

FE-010 centralizes the approved login backdrop as `--page-login-start` and
`--page-login-end`, with dark adaptations `#171e2b` and `#1e1b2b`.
`main:has(.page-surface-login)`, `.page-surface-signup` and `.page-surface-recovery`
opt their containing main into these tokens. Each private review uses its product
form surface; unrelated routes retain their backgrounds.

### Shared surface and interaction palette

All OKLCH values below are the CSS values as written, not estimated hex colors.

| CSS variable(s) | Light | Dark | Role |
| --- | --- | --- | --- |
| `--background` | `oklch(1 0 0)` | `oklch(0.141 0.005 285.823)` | Page/shell background |
| `--foreground` | `oklch(0.141 0.005 285.823)` | `oklch(0.985 0 0)` | Primary text |
| `--card`, `--popover` | `oklch(1 0 0)` | `oklch(0.21 0.006 285.885)` | Shared cards/floating surfaces |
| `--card-foreground`, `--popover-foreground` | `oklch(0.141 0.005 285.823)` | `oklch(0.985 0 0)` | Text on those surfaces |
| `--primary` | `oklch(0.5 0.134 242.749)` | `oklch(0.443 0.11 240.79)` | Existing primitive default button/checked checkbox/link |
| `--primary-foreground` | `oklch(0.977 0.013 236.62)` | same | Foreground paired with primitive primary fill |
| `--secondary`, `--muted`, `--accent` | `oklch(0.967 0.001 286.375)` | `oklch(0.274 0.006 286.033)` | Neutral secondary/hover surfaces |
| `--secondary-foreground`, `--accent-foreground` | `oklch(0.21 0.006 285.885)` | `oklch(0.985 0 0)` | Foreground on neutral actions |
| `--muted-foreground` | `oklch(0.552 0.016 285.938)` | `oklch(0.705 0.015 286.067)` | Primitive descriptions/placeholder text |
| `--border`, `--input` | `oklch(0.92 0.004 286.32)` | `oklch(1 0 0 / 10%)`, `oklch(1 0 0 / 15%)` respectively | Dividers, boundaries, input outline |
| `--ring` | `oklch(0.705 0.015 286.067)` | `oklch(0.552 0.016 285.938)` | Primitive focus border/ring |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Error text/icon, invalid fields, destructive action |

The pre-existing `primary` palette is not identical to `brand-blue`. Preserve
primitive defaults and current consumers. Product CTA styling is a deliberate
composition over `buttonVariants` (section 6); standardizing the brand does not
require recoloring every existing primitive or example.

`chart-1` through `chart-5` are a separate existing teal palette, identical in
both themes: `oklch(0.855 0.138 181.071)`, `oklch(0.704 0.14 182.503)`,
`oklch(0.6 0.118 184.704)`, `oklch(0.511 0.096 186.391)`, and
`oklch(0.437 0.078 188.216)`. They are not used by the landing SVGs and are not
the approved default for future blue/purple analytics. Do not silently replace
them globally. Sidebar variables also exist in CSS; a product sidebar is not
implemented. Map any future analytics/sidebar styling in its authorized task.

### Semantic status colors: implemented and missing

| Meaning | Verified current implementation | Future standard / gap |
| --- | --- | --- |
| Error/invalid | `destructive`; FieldError/ErrorState; invalid control border/ring | Reuse with text and icon; never color alone |
| Information | Landing notice uses `brand-ink` on `background` or `brand-soft` | No shared information Alert or `info` token exists |
| Loading | `muted-foreground` icon/text; LoadingState | Progress is not success |
| Empty/unavailable | Neutral card/text; EmptyState; preview `—` | Missing data is not zero or a failure by definition |
| Success | No dedicated token or shared success component exists | Define/review semantic styling in the task that needs it; no approved green value to extract |
| Warning | No dedicated token or shared warning component exists | Define/review semantic styling in the task that needs it; no approved amber value to extract |

Do not introduce duplicate hardcoded colors or claim the missing status palette
is delivered. When needed, establish one central semantic token per role with
light/dark contrast checks, a written state label, and appropriate iconography.

## 3. Logo and brand — existing baseline

Reuse [ProductBrand](../components/layout/ProductLayout/brand.tsx), currently
shared by the header and footer. The user approves this mark as the visual
reference for this stage. Its earlier provisional comment is historical; this
approval does not establish a separate final brand manual or new asset.

Preserve its exact composition:

- SVG `viewBox="0 0 48 48"`, displayed at **44 × 44 CSS px**, including when
  text is enlarged. The frame radius is 14 SVG units, filled with `brand-blue`.
- Three white rounded strokes, width 5 SVG units, at x=12/23/34; the top detail
  uses `brand-lilac`, width 3, with rounded caps/joins. Do not alter paths, colors,
  proportions, or draw a new version for another page.
- Wordmark `Datano`: `bdi dir="ltr"`, Vazirmatn inherited from the document,
  `text-2xl leading-8 font-extrabold tracking-tight`. It is not a separate Latin
  font. Persian subtitle: `text-xs leading-4 font-semibold text-brand-ink`.
- Mark/wordmark gap `gap-3`; subtitle group `gap-0.5`. Home link accessible name
  is «دیتانو، صفحه اصلی»; the mark is decorative to avoid duplicate announcements.

Header and footer both use this default size. `brand.tsx` is the single control
point; no size prop, compact variant, or standalone public logo file currently
exists. Other placements should reuse the component where a home link makes
sense. A real need for a mark-only or differently sized placement can justify a
minimal shared variant in that task, preserving proportions and the 44px default.
Do not modify each consumer with CSS transforms or duplicate SVG markup.
The starter assets in `public/` are not Datano brand assets.

## 4. Typography — existing baseline

[RootLayout](../app/layout.tsx) loads Vazirmatn with Arabic/Latin subsets through
`next/font/google`; `font-sans` and `font-heading` map to `--font-vazirmatn`.
Geist Mono is only the configured monospace font. Keep the current font loading,
wordmark typography, Persian shaping, and document-level `lang="fa" dir="rtl"`.

Sizes below assume a 16px root for illustration; retain rem-based text scaling.
Explicit line-height classes override Tailwind's default line heights.

| Role / current reference | Size and line height | Weight / color |
| --- | --- | --- |
| Hero h1 | `text-3xl` 30px; `sm:text-5xl` 48px; `lg:text-[3.35rem]` 53.6px; `leading-[1.6]` | 800; foreground with `brand-ink` emphasis; `tracking-tight` |
| Section h2 | `text-2xl` 24px → `sm:text-3xl` 30px; `leading-relaxed` (1.625) | 700; foreground; `text-balance` |
| Feature/workflow/audience heading | `text-lg` 18px; `leading-8` 32px | 700; foreground |
| Problem/reasons heading | `text-base` 16px; `leading-7` or `leading-8` | 700; foreground |
| Shared CardTitle | `text-lg leading-7` (18/28px) | 600; card foreground |
| Section description | `text-base leading-8` (16/32px) | normal; `brand-muted` |
| Hero description | 16/32px → `sm:text-lg sm:leading-9` (18/36px) | normal; `brand-muted` |
| Supporting prose | `text-sm leading-7` or `leading-8` (14/28–32px) | normal; `brand-muted` |
| Eyebrow, badge, metric source/unit | `text-xs leading-5/6/7` (12/20–28px) by context | 500/600 for emphasis; `brand-ink` or `brand-muted` |
| Preview KPI placeholder | `text-3xl leading-10` (30/40px) | 600; `brand-ink` |
| Field label/description/error | `text-sm leading-6` (14/24px) | label 500; descriptions muted; errors destructive |

Future pages should choose the corresponding role rather than inventing a
different scale. Compact forms/admin screens need not use the large hero h1.
Use semantic heading levels: CardTitle emits h2, so use the correct h3/h4 for
nested cards instead of choosing a component solely for its font styling.
Preserve intrinsic wrapping (`min-w-0`, `wrap-anywhere` where needed); do not
conceal overflowing Persian text with `overflow-hidden` or force headings into
fixed heights. Validate 200% text enlargement, not only normal screenshots.

## 5. Icons — existing baseline and reuse rule

Use installed `lucide-react` with its current default stroke width **2**, rounded
stroke style, and consistent viewBox. No second icon family or fabricated Google
logos. Existing source symbols are Activity (GA4), Search (Search Console), and
Megaphone (Ads); these are generic symbols, not official provider marks.

| Role | Current size | Presentation |
| --- | --- | --- |
| Inline action/source/account/KPI | `size-4` = 16px | `brand-ink`, or inherit action foreground |
| Supporting feature/evidence | `size-5` = 20px | Soft blue/purple container where useful |
| Main feature/workflow/status | `size-6` = 24px | `brand-ink`; status uses muted/destructive |
| Larger principles/closing accent | `size-7` = 28px | Restrained brand accent |
| Checkbox indicator | `size-4` inside `size-5` control | Existing check/indeterminate behavior |

Common wrappers: `size-11 rounded-xl bg-brand-soft` for a 20px icon;
`size-14 rounded-2xl border bg-background` for workflow; or `rounded-xl p-2`
with `bg-brand-purple/10`. These are compositions, not a shared IconBadge API.
Use an icon only when it identifies a source, action, state, or concept.
Decorative icons/SVGs use `aria-hidden`; icon-only controls need a Persian name.
Mirror directional navigation where its meaning requires it, not logos, source
symbols, or chronological data.

## 6. Components: what exists and how to compose it

The implementation is Base UI/shadcn, `cn`, and Tailwind theme tokens. Reuse the
following modules rather than introducing a parallel UI library. Landing
helpers are local functions, except ConceptChart, extracted without visual changes
for actual reuse by the FE-008 services page and the landing.

| Element | Current source / availability | Design and behavior reference |
| --- | --- | --- |
| Button/action link | [button.tsx](../components/ui/button.tsx): Button and buttonVariants | Base UI action button; Next Link for navigation; default/outline/secondary/ghost/destructive/link variants |
| Input | [input.tsx](../components/ui/input.tsx): Input | `h-10`, full width, `rounded-lg`, border-input/background, `px-3 py-2 text-base`, shadow-xs, visible focus and invalid state |
| Label/field | [field.tsx](../components/ui/field.tsx): Field, FieldLabel, FieldDescription, FieldError | `gap-2`, associated Base UI control/label/description/error; error role alert |
| Checkbox | [checkbox.tsx](../components/ui/checkbox.tsx): Checkbox | `size-5`, rounded, primary checked/indeterminate fill; check/minus indicator; disabled/invalid/focus states |
| Card | [card.tsx](../components/ui/card.tsx): Card, Header, Title, Description, Content, Footer | `rounded-xl border bg-card py-6 shadow-sm`; inner `px-6`, title 18/28px, prose 14/24px |
| Loading/Empty/Error | [status.tsx](../components/ui/status.tsx) | `rounded-xl border bg-card p-6`, centered icon/text; optional real action; loading polite status, reduced-motion spinner; error alert |
| Table | [table.tsx](../components/ui/table.tsx) | Existing local horizontal-scroll container, caption/headers, separators, hover/selection; check RTL overrides in product consumers |
| Conceptual SVG | [concept-chart.tsx](../components/ui/concept-chart.tsx): ConceptChart | Shared line/bar illustration from FE-007, reused by FE-008; requires a label unless decorative; no data/API contract |
| Select | No shared product Select | Private review uses a native select recipe; it is evidence of styling, not an exported component |
| Badge | No shared Badge | Existing conceptual labels are inline spans/divs; use their recipe when a shared API is unnecessary |
| Alert | No general shared Alert | FieldError/ErrorState exist; landing development note and preview notice are local semantic markup |
| Navigation/Header/Footer | [ProductLayout](../components/layout/ProductLayout/index.tsx) and sibling modules | Shared brand, approved links, skip link, one main and footer; see section 8 |

### Action and surface recipes extracted from the landing

- **Primary product CTA**: `buttonVariants({ variant: "default", size: "lg" })`
  plus `h-auto min-h-12 max-w-full gap-3 rounded-xl px-5 py-3 text-start
  whitespace-normal leading-6 bg-brand-blue text-white shadow-lg
  shadow-brand-blue/15 hover:bg-brand-blue/90`. ArrowLeft is 16px.
- **Secondary CTA**: same dimensions/wrapping, `variant: "outline"`, without the
  brand fill/shadow. Existing keyboard/disabled/invalid styles remain inherited.
- **Text preview link**: link variant, `h-auto p-0 whitespace-normal leading-7
  text-brand-ink`; preserve its focusable in-page target.
- **Feature surface**: `rounded-2xl border p-6 sm:p-7`; larger features use
  `bg-brand-panel`, with selective `border-brand-purple/20` emphasis.
- **Concept label**: `rounded-md bg-brand-soft px-2 py-1 text-xs leading-5
  text-brand-ink`; source badge uses `leading-6` instead. The prominent preview
  notice uses `rounded-lg bg-background px-3 py-2 text-xs leading-6` with icon.
- **Private native select recipe**: `h-10 w-full min-w-0 rounded-lg border
  border-input bg-background px-3 text-base outline-none focus-visible:border-ring
  focus-visible:ring-3 focus-visible:ring-ring/30`; associate its label.

Primitive Button defaults remain `rounded-4xl`, h-9 (default), h-6 (xs), h-8 (sm),
h-10 (lg), with primary fill and `/80` hover. Landing CTA overrides are explicit
and should be reused for comparable product actions, not treated as existing
primitive variants. Do not globally modify primitives to achieve one page's look.
Current focus uses border-ring and a 3px `ring/30`; brand links/targets also use
`brand-blue/40`. Preserve visible focus, 50% disabled opacity where defined,
and descriptive validation. Color changes alone must not communicate state.

**Future standard:** create a shared Select/Badge/Alert or extract a landing
recipe only when the authorized page has a real need. Keep it compatible with
existing consumers and the documented tokens. New controls still require their
own keyboard, labeling, pending, empty, failure, and success behavior; a visual
recipe is not proof those behaviors work. Do not import internal UI-review code
or fixtures into product UI.

## 7. Charts and analytical elements

### Existing conceptual SVG baseline

The shared `ConceptChart` in
[components/ui/concept-chart.tsx](../components/ui/concept-chart.tsx)
renders the original FE-007 fixed unscaled geometry. FE-008 extracted it for
reuse without changing paths, colors, dimensions, or accessibility behavior.
It has no numerical axes, legend, Tooltip,
interactive period selector, real account series, or API. Recharts is not
installed. `HeroVisual` and `DashboardPreview` are examples of this composition,
not operational dashboards. The shared SVG API accepts `bars`, and either a
Persian `label` or `decorative: true`; it never accepts analytical data.

| Detail | Exact current SVG implementation |
| --- | --- |
| Line canvas | `viewBox="0 0 440 175"`, responsive width/auto height, `direction="ltr"` |
| Main line | Smooth cubic path, width 3.5 SVG units, rounded cap, blue → purple gradient |
| Secondary shape | Lilac stroke width 2; dash `5 6` |
| Area | Blue opacity `.2` → purple opacity `.01` |
| Line guides | Brand-muted opacity `.14`; dash `3 6`; no numerical tick labels |
| Point | Radius 7, background fill, purple outline width 3 |
| Bar canvas | `viewBox="0 0 300 125"`; bars width 21, radius 5 SVG units |
| Bars | Blue/purple, opacity `.8` or `.4`; illustrative varying heights |
| Bar guides | Brand-muted opacity `.12`; dash `3 5` |
| Spacing | `my-3`; containing panel `p-4 sm:p-5`, `rounded-xl border` |
| Accessibility | Persian SVG title/role img when meaningful; hidden when decorative; unique useId gradient/title IDs |

SVG units scale with the viewBox; they are not universal CSS-pixel dimensions
for a real chart. No animation is used. Labels «نمایش مفهومی»,
«نمای توضیحی؛ دادهٔ واقعی نیست», and «نمودار مفهومی · بدون مقیاس و داده» make
the distinction visible. Do not reuse the current shapes as account data.

Preview KPI cards use a semantic `dl`, source label, unit, icon, and `—` plus an
explicit no-data description. Grid is 1 → 2 at sm → 4 at lg, `gap-3`,
`rounded-xl border bg-brand-panel/70 p-4`. Future real KPIs must retain source,
unit, period, currency/freshness context as required by MVP; absent data is not 0.

### Future visualization standards — not implemented here

Purposeful visualization is a core Datano design principle:

1. Related public pages, including FE-008 services, should use lightweight
   bespoke conceptual SVGs to explain sources, analysis, or capabilities. Vary
   the illustration according to its meaning; do not repeat one chart everywhere.
2. Real dashboards/reports use Recharts in the authorized FE-021 task, following
   page → injector → pure UI/data hooks architecture. Real charts are central
   analytical UI; choose line, bar, distribution, or another chart from the
   approved metric and question. No dependency installation is authorized here.
3. Do not add decorative charts to login, signup, recovery, or profile solely to
   make those pages resemble the landing. A donut requires a meaningful part-to-
   whole denominator; the current landing has no donut or approved distribution.
4. Carry blue/purple strokes, gentle area gradients, rounded bars, subtle guides,
   neutral panels, and the typography above into real charts. Add data-dependent
   series colors centrally when justified; preserve stable source/series identity.
   Distinguish series by text, stroke/dash/shape as well as color. Illustrative
   gradients must not distort reading or make a missing series look populated.
5. **Proposed future Tooltip recipe:** reuse `bg-popover text-popover-foreground`,
   `rounded-xl border p-3 shadow-lg`, 14px/24px text, and an isolated source/unit
   value. A real Tooltip must provide period, metric, value and unit, stay inside
   the viewport, and have an equivalent keyboard/touch-accessible explanation.
   This is a recipe for implementation/review in FE-021, not a delivered Tooltip.
6. **Future axes/legend:** foreground/muted text for readable ticks, brand-muted
   low-opacity guide lines as a starting visual reference, Persian labels, and
   clear units/period. Legends use label + swatch/shape and preserve series
   identity. Neither numerical axes nor an interactive legend exists today.
7. Keep chronological ordering and metric meaning intact under RTL; isolate
   chronological plotting from surrounding RTL copy. Localize display dates
   and numerals deliberately, preserving canonical values. Never flip a time
   series because its surrounding layout is RTL.
8. Reserve responsive chart space in its parent; test narrow screens, long
   labels, zoom, keyboard/touch and light/dark contrast. Provide a meaningful
   text/data alternative; a decorative SVG title is not enough for real analytics.
   Respect reduced motion if an authorized future task introduces animation.
9. Separate loading, no connection, no data, stale/partial data, error, and valid
   zero according to actual contracts. Use shared states where appropriate;
   do not draw a zero baseline as a substitute for missing data or fabricate
   comparisons, dates, conversions, connection states, or recommendations.

## 8. Spacing, surfaces, layout, and navigation

### Existing measurements

Tailwind's installed theme uses `--spacing: 0.25rem`. Common spacing is 2/3/4/5/6/
8/9/10/12 → 8/12/16/20/24/32/36/40/48px at a 16px root. Prefer these utilities
to scattered ad hoc pixel spacing. Landing section rhythm is `space-y-20`
(80px), `sm:space-y-24` (96px), `lg:space-y-28` (112px); compact forms and
workspaces need smaller functional groups, not this marketing-page rhythm.

The root radius is **0.625rem (10px)** and is rem-based:

| Utility | CSS calculation | At 16px root |
| --- | --- | --- |
| `rounded-sm` | radius × .6 | 6px |
| `rounded-md` | radius × .8 | 8px |
| `rounded-lg` | radius | 10px |
| `rounded-xl` | radius × 1.4 | 14px |
| `rounded-2xl` | radius × 1.8 | 18px |
| `rounded-3xl` | radius × 2.2 | 22px |
| `rounded-4xl` | radius × 2.6 | 26px |

These overrides differ from stock Tailwind radii. Hero intentionally uses
`rounded-[2rem]` (32px); do not replace it assuming rounded-3xl is equivalent.
Use lg for controls, xl for compact panels, 2xl for features, and 3xl for larger
sections as the corresponding existing reference, not as an absolute rule for
every container. Borders/dividers are generally 1px; selected emphasis uses
blue/purple at 10–30% opacity. Review contrast when a border conveys state.

Existing depth: primitive shadow-xs/sm; workflow shadow-sm; CTA shadow-lg with
blue/15; floating evidence shadow-lg with purple/10; dropdown shadow-xl.
`landing-depth` is exactly `0 24px 70px -30px
color-mix(in srgb, var(--brand-blue) 35%, transparent)`.
Keep depth selective, rather than applying a large shadow to every card.

`landing-hero` combines a purple 11% radial glow at 12%/40% and blue 8% glow at
90%/5% over brand-panel. `landing-grid` uses blue 6% 1px lines on a 32px grid.
Reuse the named CSS recipes for comparable illustration surfaces; do not copy
their colors into unrelated files or place the illustration grid behind forms.

### Existing shells and composition

| Scope | Shared component | Maximum width / padding |
| --- | --- | --- |
| Public | [PublicLayout](../components/layout/PublicLayout/index.tsx) | max-w-7xl = 80rem/1280px; px-4 → sm:px-6 → lg:px-8; py-8 |
| Account | [AccountLayout](../components/layout/AccountLayout/index.tsx) | max-w-5xl = 64rem/1024px; same padding |
| Site workspace | [SiteLayout](../components/layout/SiteLayout/index.tsx) | max-w-7xl; same padding |
| Outer product | [ProductLayout](../components/layout/ProductLayout/index.tsx) | min-h-dvh flex column; one skip link/header/main/footer |

These are outer limits, not required widths for all content. **Future standard:**
an auth form can use a narrower inner column in PublicLayout; account/profile
can group labeled fields in AccountLayout; dashboards can use KPI/chart/report
grids in SiteLayout; administration can prioritize summaries and tables inside
its approved account scope. No new shell, sidebar, or authentication page is
implemented by those examples. Preserve the shared frame and choose a structure
that serves each page rather than copying the whole landing.

The final services composition deliberately differs from the homepage: a centered
editorial title and description above the unchanged source diagram, with no hero
eyebrow, development note or action. Only source cards, the recommendations/evidence
section and the original closing signup CTA follow it. The standalone workflow
and integrated-dashboard sections are omitted by explicit user instruction to
avoid repeating the homepage. The diagram's own labels remain visible, including
its conceptual/no-real-data caption. Source cards, recommendations, closing CTA
and shared navigation retain their existing content and design. This approved
revision supersedes the original services composition described by older UX and
FE-008 validation records; it does not authorize changing Backlog criteria or
removing those sections from the homepage.

FE-009 About uses a compact editorial composition: a right-aligned title beside
a short introduction, followed by mission and approach prose with one services
link. It reuses the public shell, typography and brand accents, with no cards,
charts, dashboard preview, signup CTA, or development-status notices. On narrow
screens the columns stack in their reading order. Its copy describes product
goals and guiding principles, without invented history, team or contact details.

FE-010 Login uses a centered `max-w-md` form Card inside PublicLayout, with a
small lock symbol, 24px title, quiet supporting sentence, labeled fields and one
full-width primary action. A footer row links to signup. It does not use landing
sections, charts, statistics or marketing illustrations. Inputs have a 48px
minimum height, and the password visibility control keeps a fixed 44px target
and 20px icon, like the shared navigation's fixed control geometry. A fixed 52px
left inset reserves room for that control independently of the input's automatic
text direction; rem-based padding on both sides would consume the text area at
200% text size. Its Persian placeholder aligns right. Pending/error presentation reuses existing
primitives, disabled semantics and textual state labels; it adds no status colors.

FE-011 Signup retains the approved login form identity in a wider `max-w-xl`
Card. Given/family names share a row from sm upward and stack in reading order
on mobile; email and the two password controls remain full-width. Independent
visibility controls use the same 44px/20px geometry and fixed text inset as Login.
A short password-policy description and exact-match feedback sit with their
fields. Terms availability/acceptance stays beside its checkbox; no invented
legal page is introduced. The compact form rhythm is `space-y-4` with a single
primary action and a Login footer link. It adds no marketing sections, charts,
status colors, logo changes or changes to the approved Login UI. The new
`main:has(.page-surface-signup)` rule reuses `--page-login-start/end`, preserving
the Login selector and all other page backgrounds.

FE-012 Recovery uses one `AuthFormLayout` with the existing Login `max-w-md`
cap (448px), rounded-2xl Card, restrained brand shadow, 24px heading and 48px
minimum inputs/primary action. The existing Signup `max-w-xl` cap (576px) remains
unchanged; no third auth width or revision to those approved pages is introduced.
The Mail/ShieldCheck/KeyRound icon, heading, description and numbered three-step
indicator share fixed slots and visual recipes across the flow. Progress exposes
`aria-current="step"` and textual labels, independently of color.

Headings and form panels overlap intrinsic grid cells to reserve the largest
content at the current width. This keeps frame geometry and primary-action
placement stable between normal stages without a fixed height. Inactive panels
remain mounted for input retention but are invisible, inert, aria-hidden and
disabled. Compact code/resend rows reduce unnecessary reserved space; errors
and enlarged text can increase intrinsic height without clipping. The previous
action retains its slot during stage one; the Login footer remains common.
Step changes focus the active enabled field. Shared Field connects Persian errors
and descriptions; countdown numbers/codes/emails are isolated from RTL prose.
Timers and advancing stages exist only in the clearly labeled private review.
`main:has(.page-surface-recovery)` reuses the existing auth backdrop tokens.

Current header: max-w-7xl, `min-h-22` (88px), `px-4 sm:px-6 lg:px-8 py-4`,
`gap-4`, border-bottom, background, relative z-20. Brand sits on the right.
The latest source-order correction is **سرویس‌ها → درباره ما → حساب کاربری → ورود**
in [navigation.tsx](../components/layout/ProductLayout/navigation.tsx).
Keep only these four options. Their destinations come from
[links.ts](../components/layout/ProductLayout/links.ts): `/services`, `/about`,
`/account`, `/login`; the account icon stays with its link. No session is inferred.

Desktop uses one row at lg and above. Below lg a native details/summary disclosure
uses a 44px toggle; the dropdown has `inset-x-4 sm:inset-x-6`, `mt-2 rounded-2xl
border bg-background p-3 shadow-xl`. Native operation works without JS; the
focused client boundary adds Escape/focus-return, focus-leave/link closure and
pathname-based aria-current. Current link recipe is rounded-xl, min-h-11,
px-4 py-3, 14px medium; login is blue/white with `/90` hover. Current-page styling
is brand-soft/brand-ink. Never implement order using CSS visual reordering.

Footer: the same ProductBrand, max-w-7xl, `gap-6 py-8`, same horizontal padding;
stacked on mobile, row at sm; quick links home/services/about; exact copyright
`© 2026 Datano. تمامی حقوق محفوظ است.`. No unverified contact/social content.
Product route groups already supply the outer shell: do not repeat its landmarks.

## 9. RTL, responsiveness, and accessibility

Existing Tailwind breakpoints (no project override):

| Prefix | Minimum width | Current usage |
| --- | --- | --- |
| base | below sm | Stacked content, wrapped actions, single-column reports |
| sm | 40rem / 640px | Larger text/padding; two-column KPIs; footer row |
| md | 48rem / 768px | Three-step/audience layout, feature grid, two report panels |
| lg | 64rem / 1024px | Desktop nav, split hero/content, four KPIs |
| xl | 80rem / 1280px | Available; not required by current landing |
| 2xl | 96rem / 1536px | Available; not required by current landing |

Use mobile-first layout, min-w-0, flexible grids and wrapped CTA text. Preserve
logical ps/pe/ms/me/start/end spacing and text-start/end. English brands,
email/URL/code/identifiers use bdi or dir=ltr; unknown-direction user strings can
use dir=auto. Do not mirror analytics meaning or turn canonical API values into
localized identifiers. Product tables should override the primitive's physical
text-left/pr-0 where necessary without rewriting the English examples.

Verify Persian glyph coverage/shaping, light/dark text contrast, visible focus,
landmarks, label/error associations, keyboard order, menu state, narrow viewports
and 200% text. Status must include text or a meaningful symbol as well as color.
The current test matrix includes 390/1440px projects plus 320/768/1440px layout
checks; these are validation widths, not new breakpoints. Keep animation optional
and respect reduced motion. No theme-switcher or accessibility certification is
claimed by the current token sets.

## 10. Reference map and extension rules

| Reference | What to inspect/reuse |
| --- | --- |
| [DatanoLanding](../components/feature/public/LandingPage/DatanoLanding.tsx) | Honest Persian copy, translations, conceptual/source/unit labels, destinations |
| [LandingPage UI](../components/feature/public/LandingPage/index.tsx) | Hero, SectionHeading, ActionLink, process/features and KPI/preview recipes; local helpers, shared ConceptChart import |
| [ConceptChart](../components/ui/concept-chart.tsx) | Unchanged approved line/bar SVG geometry shared by landing and services |
| [ServicesPage UI](../components/feature/public/ServicesPage/index.tsx) | Final editorial hero, preserved source diagram/cards and recommendation evidence, single closing CTA; page-only background opt-in |
| [DatanoAbout](../components/feature/public/AboutPage/DatanoAbout.tsx) and [AboutPage UI](../components/feature/public/AboutPage/index.tsx) | Short goal-based Persian copy, mission/approach prose and compact editorial composition; page-only blue/lavender backdrop |
| [Global CSS](../app/globals.css) | Runtime tokens, themes, gradients/grid/depth recipes |
| [ProductBrand](../components/layout/ProductLayout/brand.tsx) | Approved current mark, typography and default sizing |
| [Private review injector](../components/feature/internal/UIReview/DevelopmentUIReview.tsx) | Development-only shell/control/state inspection; never import into product UI |
| [Login injector](../components/feature/identity/LoginForm/DatanoLogin.tsx) and [Login UI](../components/feature/identity/LoginForm/index.tsx) | Compact auth form, local validation, accessible visibility control and page-only gradient |
| [Login review](../components/feature/internal/LoginReview/DevelopmentLoginReview.tsx) | Private, deterministic pending/error presentation; never import into product UI |
| [Signup injector](../components/feature/identity/SignupForm/DatanoSignup.tsx) and [Signup UI](../components/feature/identity/SignupForm/index.tsx) | Responsive identity fields, independent password visibility, policy/match feedback and blocked public terms |
| [Signup review](../components/feature/internal/SignupReview/DevelopmentSignupReview.tsx) | Private interactive validation, terms checkbox exercise, pending/error and blocked scenarios |
| [Recovery layout](../components/layout/AuthFormLayout/index.tsx) and [Recovery UI](../components/feature/identity/RecoveryForm/index.tsx) | One intrinsic frame and progress indicator across all three auth recovery panels |
| [Recovery review](../components/feature/internal/RecoveryReview/DevelopmentRecoveryReview.tsx) | Private flow, validation, countdown, resend, expiry and attempt-limit inspection without auth effects |
| [Landing tests](../tests/e2e/landing.spec.ts) | Scope, truthful preview, CTA, mobile menu, no-JS, font/RTL, theme/zoom checks |
| [Shared-shell tests](../tests/e2e/ui-review.spec.ts) | Header/footer consistency, scope switching, fields/states and keyboard regression |
| [FE-007 record](validation/FE-007-landing.md) | Historical implementation/validation evidence, not a competing design source |

For every future UI task:

1. Read this reference and the relevant UX/Backlog acceptance before design.
2. Select existing tokens, roles, shell and primitives; add only what the
   authorized page requires. New components are allowed when they serve that
   requirement and follow the same visual language and architecture.
3. Keep one runtime source for colors/brand. Extract a local landing helper only
   when real reuse justifies it, preserving existing appearance and consumers.
   Do not import a private helper as if it were an exported UI component.
4. Verify actual behavior and visuals with applicable existing tests, fonts,
   responsive/RTL/theme checks and screenshots. Do not claim a check from old
   validation records as a new executed result.
5. In the task's final report, confirm consistency with this document and explain
   any necessary deviation with its concrete reason. Record a genuinely new
   accepted token/variant here and in its runtime source within that task's scope.

Do not redesign the approved landing, recolor the logo, add a second palette or
icon library, fabricate missing primitives or analytics, duplicate product
shells, reverse data for RTL, hide overflow to pass a screenshot, or start the
next Backlog task solely because this design reference is now established.
