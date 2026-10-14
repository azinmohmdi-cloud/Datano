# Datano frontend

Next.js 16.2.6 App Router, React 19.2.4, strict TypeScript, Tailwind 4,
Base UI/shadcn primitives, TanStack Query, Axios, and Orval; pnpm is the package manager.

Read [the shared workspace instructions](../docs/AGENTS.md) and
[the frontend engineering guide](AGENTS.md) before work. Approved product and
technical decisions are in [the MVP document](../docs/Datano_MVP.md), with
[the UX specification](../docs/datano-ux-pages-.md) defining product screens.
The [component cookbook](docs/cookbook/component-development-framework.md)
describes page → injector → data hooks/pure UI composition.

## Current implementation

The application contains Persian public landing and services pages with labeled
conceptual visuals, English invoice examples, shared primitives/providers, mock
invoice hooks, and local health/user routes. The about page, ownership
verification, Google integrations, production authentication, and data-driven
analytical charts are not implemented. Landing SVGs are unscaled conceptual
illustrations. Local user routes have separate
mock arrays and do not implement the FastAPI contract. Invoice outcomes are
randomized examples; routine tests must use deterministic fixtures.

## Development

Run commands from `Frontend/`. Use Node **24.19.0** from `.nvmrc` and pnpm
**11.25.0** from `package.json`. With an existing nvm installation, run
`nvm install` and `nvm use`; another version manager can select the same Node
version. If pnpm is unavailable, install the declared version with
`npm install --global pnpm@11.25.0`. Verify `node --version` and `pnpm --version`
before installing dependencies. Node must be >=22.18.0 for the locked Orval
(Next.js itself needs >=20.9.0). Ensure the selected Node is first in `PATH` so
pnpm scripts and child processes also use it. Preserve the pnpm lockfile and
`pnpm-workspace.yaml` build-script policy.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
pnpm start
```

Development normally serves port 3000; production start requires a successful
build. Installation needs npm registry access, and the existing `next/font/google`
fonts need Google Fonts access on an uncached dev compilation/build. No API URL
or running backend is required for the current homepage and invoice examples.
Playwright browser tests are configured; see [Browser tests](#browser-tests).
No unit/component test runner is configured. See the engineering guide for
runner-neutral TDD and task validation.

The recorded setup, initial diagnostics, and validation results for `FE-001`
are in [the frontend baseline report](docs/validation/FE-001-baseline.md).

## Persian typography and direction

The root document sets `lang="fa"` and `dir="rtl"`. Vazirmatn is loaded once
through `next/font/google` with Arabic and Latin subsets and `display: "swap"`.
Global `font-sans` and `font-heading` tokens use `--font-vazirmatn`; controls
inherit the same typography. The existing Geist Mono token remains available
for technical code. Product layouts inherit this setup without loading fonts
or repeating direction settings. The root title/description are Persian;
page titles can use the shared `%s | دیتانو` template.

Global base styles give email/URL inputs and `code`, `kbd`, `samp`, and `pre`
left-to-right direction with bidi isolation. These defaults respect an explicit
`dir` attribute. For displayed email addresses, URLs, or identifiers inside
Persian prose, isolate the exact value explicitly:

```tsx
<p>
  نشانی: <bdi dir="ltr">person+tag@example.com</bdi>
</p>
```

Use `dir="auto"` for text of unknown direction. Keep canonical values unchanged;
direction styles do not translate, normalize, or insert characters into them.
The existing English invoice examples retain their demo content.

## Shared forms, cards, and states

Named exports under `components/ui/` provide `Input`, `Checkbox`,
`Field`/`FieldLabel`/`FieldDescription`/`FieldError`, the `Card` parts, and
`LoadingState`/`EmptyState`/`ErrorState`. They use the installed Base UI,
Lucide icons, `cn`, and light/dark theme tokens. No fetching, domain validation,
form library, or product flow is built into these primitives.

Group **one control per Field**. Base UI creates unique control/message IDs and
connects the label, description, and visible errors automatically. An explicit
control `id` is supported. Keep errors inside the same Field; remove them when
resolved so their description references are also removed. For externally
controlled validation, set `invalid` on Field and conditionally render
`FieldError match={true}` with the translated message:

```tsx
import { Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

// Inside a client feature: values and callbacks come from its injector.
<Field name="email" invalid={Boolean(error)}>
  <FieldLabel>ایمیل</FieldLabel>
  <Input
    type="email"
    autoComplete="email"
    required
    value={email}
    onValueChange={onChangeEmail}
  />
  <FieldDescription>نشانی ایمیل خود را وارد کنید.</FieldDescription>
  {error && <FieldError match={true}>{error}</FieldError>}
</Field>
```

Field also preserves Base UI's validation props (`validate`, `validationMode`,
and `disabled`). Supply Persian validation messages; browser-generated messages
are not automatically translated. Input supports native attributes and refs,
`value`/`defaultValue`, and `onValueChange`. Its email/URL direction inherits the
FE-002 global rules. These styled Base UI wrappers accept a string `className`.

Checkbox supports `checked`/`onCheckedChange`, `defaultChecked`, `indeterminate`,
`required`, `readOnly`, `disabled`, `name`, and `value`. Its native input participates
in form submission. Label activation and Space toggle it; disabled controls skip
keyboard navigation. Use the same Field composition for checkbox errors:

```tsx
<Field name="remember">
  <div className="flex items-center gap-2">
    <Checkbox value="yes" />
    <FieldLabel>مرا به خاطر بسپار</FieldLabel>
  </div>
</Field>
```

`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`
compose a Card without owning feature behavior. CardTitle renders an `h2`;
choose heading levels to match the consuming page. Content wraps long unbroken
text rather than stretching the page.

State components require a supplied `title` and accept an optional `description`.
LoadingState exposes a polite status and respects reduced motion. EmptyState
is ordinary empty-result content; ErrorState exposes its message as an alert.
EmptyState/ErrorState accept an `action` node, allowing the existing Button or
links to be reused. Only provide recovery actions backed by a real callback:

```tsx
<ErrorState
  title="دریافت اطلاعات ناموفق بود"
  description="دوباره تلاش کنید."
  action={<Button type="button" onClick={onRetry}>تلاش دوباره</Button>}
/>
```

Form/state components are client primitives where interaction requires it;
Card and status presentation remain usable in server composition. Event callbacks
must originate within a client boundary. The invoice examples keep their existing
feature states. See [FE-003 validation](docs/validation/FE-003-shared-ui.md) for
the focused browser checks and tooling boundaries.

## Product layout composition

`app/(product)/layout.tsx` composes the shared `ProductLayout`: a skip link,
`ProductHeader`, one `main#main-content`, and the single `ProductFooter`.
All product pages belong below this route group. Root providers/fonts remain
in `app/layout.tsx`; the English examples retain their separate ExampleLayout.
Route groups do not change public URLs: the existing homepage remains `/`.

| Content scope | App Router layout | Shared content component |
| --- | --- | --- |
| Public and authentication pages | `app/(product)/(public)/layout.tsx` | `components/layout/PublicLayout` |
| Account, future profile/admin/site list | `app/(product)/account/layout.tsx` | `components/layout/AccountLayout` |
| Individual site workspace | `app/(product)/sites/[siteId]/layout.tsx` | `components/layout/SiteLayout` |

These inner layouts provide responsive content width/padding. They are used
**inside ProductLayout** and do not repeat header/footer/main landmarks.
Account content is capped at `max-w-5xl`; public/site content at `max-w-7xl`.
ProductLayout grows with content and keeps the footer at the viewport bottom on
short pages. Use one scope layout per page; page content should not add another
outer `main` or document-level header/footer.

The header contains only **حساب کاربری**, **درباره ما**, **سرویس‌ها**, and
**ورود**, plus the home-linked Datano wordmark and provisional geometric SVG
mark. Desktop navigation is a single row; smaller screens use native
`details`/`summary` with an accessible menu name and expanded state. A focused
client navigation component adds Escape/focus-return, closure when focus leaves
the menu, and route-based `aria-current`. Native disclosure, links, visible
keyboard focus, and the skip link work without JavaScript. The skip link uses
Next/Link so its hash entry also participates in App Router back navigation.
Styling reuses
`buttonVariants`, `cn`, and the existing theme tokens.

`components/layout/ProductLayout/links.ts` defines the reserved destinations:
`/account`, `/about`, `/services`, and `/login`. The header does not infer a
session/role or implement account redirects. The homepage, `/services`, and `/about`
have product content; `/login` has the FE-010 form UI, while `/account` remains
pending and returns 404. Automatic prefetching of navigation links is disabled. Do not add
placeholder login/profile/dashboard pages or claim authentication to make the
shell appear complete. Account routing from trusted session data remains FE-030.

Every product scope inherits the same footer: Datano wordmark, exactly the three
quick links (home/services/about), and `© 2026 Datano. تمامی حقوق محفوظ است.`
No approved logo asset exists yet. The FE-007 geometric mark is a temporary
visual identity, not the final official logo. No unverified
contact details, social links, or additional sections are supplied.

For isolated composition, such as the private UI review environment:

```tsx
import ProductLayout from "@/components/layout/ProductLayout"
import AccountLayout from "@/components/layout/AccountLayout"

<ProductLayout>
  <AccountLayout>{children}</AccountLayout>
</ProductLayout>
```

The same pattern applies to PublicLayout/SiteLayout. App Router already supplies
the outer ProductLayout; pages in that group must not wrap it a second time.
See [FE-004 validation](docs/validation/FE-004-layouts.md) for production/dev,
browser, keyboard, responsive, and regression checks.

## Public landing

`/` composes `LandingPage/DatanoLanding.tsx` (static Persian copy and destinations)
and its pure UI entry point, using the existing ProductLayout/PublicLayout.
It introduces the product's intended scope and explicitly states that the
operational integrations/dashboard are still under development. No data hook,
API call, sample account, customer claim, or chart dependency is used. The landing
remains server-renderable; only shared navigation needs a client boundary.

The landing includes the hero, problem, receive/analyze/recommend workflow,
capabilities, reasons, audience, explanatory preview, and closing CTA. Start-use
links reserve `/signup` for FE-011 (currently 404); the services CTA opens the
implemented `/services` page from FE-008.
The preview link focuses `/#dashboard-preview` with native navigation even
without JavaScript. The static preview labels its purpose and presents metric
names with `—`, without invented values, connected-source status, or a public demo.
Hand-coded SVG line/area and rounded bar illustrations have explicit conceptual
labels, no numerical scale, unique gradient IDs, and accessible descriptions.
Decorative SVGs are hidden from assistive technology. No chart animations are
used. Dedicated blue/purple brand tokens in `app/globals.css` support light/dark
surfaces without replacing the future analytics palette.
It does not import private UI-review fixtures. The invoice examples retain their
direct URLs and no longer appear in the product homepage.

See [FE-007 validation](docs/validation/FE-007-landing.md) for executed checks.

## Public services

`/services` composes `ServicesPage/DatanoServices.tsx` and its pure UI through
the existing public shell. It introduces GA4, Search Console, Google Ads,
and rule-based recommendations with a labeled source-to-dashboard diagram.
The final page has a centered title/description above its existing diagram,
source cards, recommendation evidence and one closing CTA. Separate workflow
and dashboard sections were removed by user instruction to avoid homepage
duplication. Copy explicitly identifies
these operational capabilities as under development, independent optional
sources, and recommendations that depend on valid sufficient evidence.

The sole content CTA targets `/signup`. Hero has no action links; the shared
header/footer retain their existing links. No new private route,
provider connection, authentication state, or API call is introduced.
`components/ui/concept-chart.tsx` shares the original landing line/bar SVG
geometry with services. Decorative source-flow graphics, absent-value marks,
and visible conceptual labels do not present generated data as real analytics.
No chart library or other dependency is added. Both pages remain server-renderable.

The approved [design system](docs/design-system.md) governs brand, typography,
icons, surfaces and responsive behavior. Services retains its existing subtle
lavender/icy-blue page backdrop. About uses the icy-blue/lavender gradient approved
for FE-009; the light-blue dashboard/profile policy is recorded for future work.
The profile backdrop was subsequently approved as the same quiet blue/lavender
gradient for FE-013. The homepage and shared shell retain their existing backgrounds. See
[FE-008 validation](docs/validation/FE-008-services.md) for executed checks.

## Public about

`/about` composes `AboutPage/DatanoAbout.tsx` and its pure UI through the existing
public shell. A compact editorial layout introduces Datano's purpose, mission,
and approach in short Persian prose. It describes goals and guiding principles,
without claiming operational integrations, inventing company history, team,
customers or contact details, or repeating development-status disclaimers.

The only content link opens `/services`; shared header/footer navigation is
unchanged. The page uses the approved typography and brand colors, with a very
subtle icy-blue/lavender backdrop scoped to its containing main. No charts,
cards, preview, data hook, API request, new dependency or client boundary is added.
The page and links work without JavaScript. See
[FE-009 validation](docs/validation/FE-009-about.md) for executed checks.

## Login form — FE-010

`/login` composes `identity/LoginForm/DatanoLogin.tsx` and its pure UI through
the public/product shells. The narrow centered form uses the approved brand,
Vazirmatn and a quiet icy-blue/lavender backdrop scoped to its containing main.
It supplies email, show/hide password, remember-me, signup (`/signup`) and recovery
(`/forgot-password`) links. Signup and recovery UI are supplied by FE-011/FE-012.

The client injector owns values, field/submission errors and password visibility.
Validation uses the email input's validity and requires a nonempty password;
login does not impose the new-password creation policy or trim a password.
Errors are Persian and linked by the existing Base UI Field; submit focuses the
first invalid field. Editing clears the relevant field/submission error and keeps
other values. Password/remember state is confined to the mounted form.

FE-030 owns real session integration. A valid public submission currently displays
the actual availability error, without an API request, artificial pending delay,
redirect, success, cookie or browser-storage write. Before hydration and without
JavaScript, form controls are disabled; a noscript message explains how to enable
the form, and navigation links remain available. Native POST semantics also avoid
placing credentials in a query string.

With private review enabled, `/ui-review/login?state=pending` and `state=error`
show fixed presentation states. A selector switches to the empty interactive
form (`idle`) or another fixture; reload reproduces the selection. The main
`/ui-review` catalogue links to this review. Fixtures stay outside the product
module graph and are excluded from production by the existing `review.tsx`
discovery policy. Public `/login` never reads fixture query parameters.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e login.spec.ts`.
See [FE-010 validation](docs/validation/FE-010-login.md) for executed evidence.

## Signup form — FE-011

`/signup` composes `SignupForm/DatanoSignup.tsx`, its client form controller and
pure UI through the existing public/product shells. It reuses the approved login
backdrop tokens and control styling without editing the login or public-page
components. A wider centered Card has a responsive given/family-name row, email,
two password fields with independent visibility controls, terms acceptance and
an existing-account link to `/login`.

Names must contain non-whitespace text. Email uses native type validity with
Persian feedback. New passwords contain 15–128 Unicode code points, counted with
`Array.from` rather than UTF-16 length. No composition requirement, trimming,
normalization, truncation or native min/max length attribute is applied. Matching
is exact; editing the password rechecks an already-entered confirmation. Existing
Base UI Field connects labels, descriptions and errors. First-invalid focus is
scoped to the submitted form. Native POST and pre-hydration/no-JavaScript disabling
prevent credential submission before the client handler is ready.

Approved, versioned terms are still absent (`EXT-002`). Public acceptance and
submission therefore stay disabled with a concise reason beside the checkbox.
The form accepts no query flag to bypass that gate and does not supply invented
legal text or a terms page. Real registration and versioned acceptance remain
FE-030/FE-048; no account, role, API request, session or storage write is simulated.

Private `/ui-review/signup` provides interactive validation/checkbox testing,
blocked, fixed pending and fixed error scenarios. Its explicit design-only notice
explains that checkbox interaction is not legal acceptance. Any valid interactive
submission still reports actual unavailability. Fixture values remain private;
the route is excluded from production by the existing `review.tsx` policy.
The catalogue links to this review. No successful-registration scenario exists.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e signup.spec.ts`.
See [FE-011 validation](docs/validation/FE-011-signup.md) for executed evidence.

## Password recovery — FE-012

`/forgot-password` composes `RecoveryForm/DatanoRecovery.tsx`, a client controller
and pure UI through the existing public shell. A shared `AuthFormLayout` provides
one centered `max-w-md` Card, heading/icon slot, three-step indicator and Login
footer link. All stages retain the same frame and primary-action position.
Overlapping intrinsic grid cells reserve the largest heading/form at the current
width; inactive panels stay mounted to preserve values, but are invisible, inert,
hidden from assistive technology and disabled. No fixed card height is imposed.
Errors may grow the form, and narrow/reduced-height viewports remain scrollable.
Login's existing 448px cap and Signup's 576px cap are preserved; recovery follows
Login's cap and reuses the same gradient/control tokens.

The public form validates email and reports real unavailability on valid submit.
It does not advance, read preview query flags, send email, verify a code, change
password, start an auth session or persist credentials. Before hydration and
without JavaScript, controls remain disabled. FE-031 owns the real integration.

Private `/ui-review/recovery?step=email|code|password&state=ready` reviews the
continuous flow with an explicit design-only notice. Other scenarios are
`pending`, `error`, `expired`, `locked`, `resend-ready` and `near-expiry`.
Step changes preserve all input values and focus the active field; changing the
initial scenario intentionally resets its fixture. Codes require exactly eight
digits, preserving a leading zero; Persian/Arabic decimal digits become ASCII
without silently truncating other input. New passwords use the existing approved
15–128 Unicode-code-point policy and exact confirmation, with independent
visibility controls and no trimming/normalization/composition requirement.

The private timer models a 10-minute expiry, 60-second resend cooldown and five
invalid attempts. Resend clears the old sample code and resets counters, with
text explicitly stating that no email was sent. Moving to the next private panel
is UI inspection, never successful verification. Even a valid new password ends
with an availability error, never a successful reset. Production excludes the
review route and fixture values using the unchanged FE-005 policy.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e recovery.spec.ts`.
See [FE-012 validation](docs/validation/FE-012-recovery.md) for executed evidence.

## Profile UI — FE-013

`/profile` uses a pathless `(account)` group and the existing AccountLayout inside
ProductLayout. Until FE-030/FE-032 supply trusted session/account data, it renders
a concise access state with a Login link. Query parameters cannot provide an
account, role or preview state. No private fixture or fake authenticated identity
is included in that route; the existing `/account` routing remains FE-030 work.

The complete UI is available privately at `/ui-review/profile`. It uses the same
shell, Vazirmatn, icons, Card/Field/Input/Button and brand palette. A summary card
shows account name/current email and an inline logout confirmation. The main
column contains editable given/family names and a separate change-email flow;
columns stack in reading order below lg. There is no role, username or account
activation control, invented avatar-upload feature, chart or marketing section.
The page-only `.page-surface-profile` opt-in reuses the established very pale
icy-blue/lavender auth gradient and dark adaptation, as requested for FE-013.

Names require non-whitespace content; changes remain drafts, with first-invalid
focus and linked Persian feedback. Reset restores only names, leaving email/code
drafts intact. No real save or account-summary mutation is simulated. Email
comparison follows MVP trim/lowercase only, without provider-specific dot/plus
rules. The current email remains unchanged through request/code/error states.
Private stage navigation preserves drafts; editing the new address invalidates
its old sample code. Codes accept exactly eight digits, including a leading zero,
with Persian/Arabic decimal digit conversion and no silent truncation. The private
clock models 600-second expiry, 60-second resend cooldown and five invalid attempts.
Resend explicitly states that no email was sent. Valid verification still reports
unavailability; FE-033 owns real ownership proof/email replacement.

`emailStep=request|code` directly selects the private email stage. `state=ready`
provides interaction; other initial scenarios are `loading`, `error`,
`names-pending`, `names-error`, `email-pending`, `email-error`, `code-error`,
`expired`, `resend-ready`, `logout-confirm`, `logout-pending`, `logout-error`.
Changing the initial scenario resets the fixture, with a visible notice; changing
the email stage retains drafts. Logout cancellation returns keyboard focus, while
confirmation reports unavailability and preserves the account and edits. No
request, real logout, redirect, session or browser-storage write is performed.
Controls are disabled before hydration. Private review requires JavaScript and
otherwise stays in its loading fallback; the public Login link works without it.
The unchanged FE-005 policy excludes private routes/fixtures from production.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e profile.spec.ts`.
See [FE-013 validation](docs/validation/FE-013-profile.md) for executed evidence.

## Website list and selection UI — FE-014

`/websites` reuses the pathless `(account)` group and AccountLayout. Until
FE-030/FE-034 supply trusted account/site data, it shows an access state and Login
link. Query flags cannot supply sites, identity, selection or permission. The
existing `/account` routing and `/sites/[siteId]` layout are unchanged. No
individual-site route is added; later workspace routes must follow the approved
Backlog `/websites/[websiteId]` policy with the previously reported layout
discrepancy coordinated before altering that scaffold.

The complete UI is privately reviewable at `/ui-review/websites`, linked from
the review catalogue and the profile's account summary. The profile UI accepts
an optional navigation href; only its private injector supplies a private link.
Existing profile fields and public access behavior remain intact.

`account=empty|single|multiple` selects a deterministic fixture. A single site is
selected automatically; multiple sites require explicit selection. Domain,
ownership and report state are separate. Selecting another site clears obsolete
destination feedback and any open deletion confirmation. Unverified ownership
takes precedence over a report flag. Verified sites route conceptually to sources,
receiving data or the dashboard; successful empty reports also permit dashboard
navigation. The displayed destination is a local review result, not a visit to an
unfinished page, a real report or a server authorization/readiness check.

`state=ready|loading|error|delete-confirm|delete-pending|delete-error` selects the
initial scenario. Invalid/repeated selectors use multiple/ready; changing either
selector resets the fixture, as the review notice explains. Reload reconstructs
the initial scenario without persisting private selections in browser storage.
Delete confirmation names the target and explains cancellation of sources/jobs,
loss of access to dependent data and the need for fresh proof after re-registration.
Cancellation restores focus; confirmation reports actual unavailability and never
removes a site. Pending/error states are selectable, without sending a mutation.

The feature reuses the existing brand, Vazirmatn, RTL, account shell, Card/Button
and Loading/Empty/Error primitives. Controls remain disabled before hydration;
private no-JS review stays in its Suspense fallback. Production excludes review
routes/fixtures under the existing FE-005 policy. Real list/add integration remains
FE-034; deletion remains FE-047. FE-015 adds the private form navigation described
below; ownership, source connection and receipt remain FE-016–FE-018.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e websites.spec.ts`.
See [FE-014 validation](docs/validation/FE-014-websites.md) for executed evidence.

## Add website form UI — FE-015

Open `/ui-review/websites/new` with `UI_REVIEW_ENABLED=1 pnpm dev` or use Add
from the private website list. The existing account shell, neutral background,
Vazirmatn, RTL, brand tokens and shared form primitives are retained.
`state=ready|valid|invalid|duplicate|unavailable|pending|error|registered` selects
a deterministic initial fixture. Changing the selector resets the draft;
ordinary validation/submission errors preserve it. Repeated/unknown selectors
fall back to the empty form. No fixture persists or creates a website.

The form accepts full HTTP(S) homepage URLs with no credentials, custom port,
non-root path, query or fragment. Matching default ports (HTTP 80 / HTTPS 443)
are accepted; a root slash is optional. Syntax validation canonicalizes the
hostname through IDNA, lowercase and removal of its terminal dot. `www` and
subdomains remain independent. IP literals (including alternative IPv4 notation),
localhost, local names and invalid hostname labels/lengths are rejected. This is
client syntax validation, not DNS resolution, availability, SSRF protection or
authorization; backend checks must remain authoritative.

Same-account duplicate fixtures offer the existing list instead of creating a
second record. The unavailable-domain fixture reveals no owner information.
Valid submission reports registration unavailability without a request or false
success. The independently selected registered fixture explicitly remains
unverified; there is no token, ownership check, next-stage route, Google source
or report. FE-016 owns proof UI, and FE-034 with BE-018 owns real registration,
conflict responses and list/cache integration.

`/websites/new` currently displays honest guest access with Login and a public
list backlink. Query flags cannot supply an account or sample result. Production
excludes the new private route/fixture under the unchanged review policy.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e add-website.spec.ts websites.spec.ts profile.spec.ts`.
See [FE-015 validation](docs/validation/FE-015-add-website.md) for executed evidence.

## Private UI review

The opt-in `/ui-review` catalogue renders the existing public/account/site
shells and shared form/card/table/loading/empty/error components with fixed
presentation fixtures. Start it locally from `Frontend/`:

```sh
UI_REVIEW_ENABLED=1 pnpm dev --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000/ui-review`. The server-only flag defaults to disabled
in `.env.example`; restart the development server after changing it. There is
no product navigation entry for this route.

Selectors control `scope` (`public`, `account`, `site`), `state` (`loading`,
`empty`, `error`, `ready`), and `persona` (`guest`, `user`, `admin`). Their query
parameters make a view reproducible, for example
`/ui-review?scope=account&state=error&persona=admin`. Missing, invalid, or duplicate
values fall back to public/ready/guest. Reset restores those defaults and the
original input/checkbox values, including when the URL is already at defaults.
Changing a scenario also restores its fixed values. Loading stays selected
until changed; the error action only selects the ready fixture.

All sample content carries a visible design-only notice. Persona is a display
label and creates no session/permissions; controls issue no API calls and write
no cookies or browser storage. This catalogue supplies the review foundation,
not a login flow, dashboard, or sample analytics in product pages. Fixtures live
only in `components/feature/internal/UIReview/fixtures.ts`; product features
must not import them or the development injector.

`next.config.ts` enables the `review.tsx` page extension **only** for an opted-in
development-server phase. `app/ui-review/page.review.tsx` is therefore absent
from production route discovery and its fixture code is not in production client
bundles, even if `UI_REVIEW_ENABLED=1` during build/start. A server-side guard also
requires development mode and the flag; metadata uses noindex/nofollow. Keep
review-only route pages under this extension rather than a normal `page.tsx`.
The opt-in is a local development switch, not an authentication mechanism.

See [FE-005 validation](docs/validation/FE-005-ui-review.md) for route exclusion,
determinism, keyboard, responsive/theme, and product-isolation checks. Project
Playwright infrastructure is documented below; FE-005 itself added no browser
dependency or test runner.

## Browser tests

The repository pins `@playwright/test` 1.62.1 in devDependencies. From `Frontend/`,
with the declared Node/pnpm versions selected:

```sh
pnpm install --frozen-lockfile
pnpm test:e2e:install
pnpm test:e2e
```

The install script downloads Chromium matching the locked Playwright release;
Linux hosts may additionally need `pnpm exec playwright install --with-deps chromium`.
Browser downloads need access to Playwright's distribution service. Uncached
Next dev startup still needs the existing Google Fonts resources; tests do not
require a running backend or Google API account.

If Chromium download is unavailable and Google Chrome is already installed,
select it **explicitly**:

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e
```

This uses the host Chrome version; it is not a substitute for validating the
default bundled browser. With the variable unset, Playwright uses its matching
Chromium. Other channel values fail configuration rather than silently changing
the browser. Record the selected browser when reporting results.

`playwright.config.ts` starts/stops its own Next development server on
`http://127.0.0.1:3100` with private UI review enabled. It refuses an already-running
server; stop any process occupying that port before testing. Another Next dev
process in this same checkout also holds `.next/dev/lock` and must be stopped.
The configuration never changes `.env` or makes private fixtures available in
production. Locale/timezone/light theme/reduced motion are explicit. One worker,
zero retries, bounded timeouts, and forbidden `test.only` keep failures visible.

The mobile project uses 390×844 with touch/mobile emulation; desktop uses
1440×900. Both use the Chromium engine. Tests live in `tests/e2e/`; the scoped
`fixtures/ui-review.ts` fixture opens public/ready/guest in Playwright's fresh
page/context for each test, with no shared session, backend, random invoice hook,
or import of application fixtures. Assertions use fixed independent expectations.
Coverage includes Persian RTL and canonical LTR values, navigation/keyboard/back,
fixed states/reload/reset without auth effects, and the skip link without JS.

Useful commands:

```sh
pnpm test:e2e --project=mobile
pnpm test:e2e --project=desktop
pnpm test:e2e --repeat-each=2
pnpm test:e2e --list
pnpm exec playwright show-report
```

HTML reports are in `playwright-report/`; failure screenshots/traces in
`test-results/`. These and optional blob reports are Git/ESLint-ignored generated
artifacts. The reporter does not open a browser automatically. A failure trace can
be inspected with `pnpm exec playwright show-trace <trace.zip>`.
See [FE-006 validation](docs/validation/FE-006-playwright.md) for executed results
and the browser-download limitation on the validation workstation.

## API generation and transport

Set `OPENAPI_JSON_URL` to a reachable backend schema, normally
`http://localhost:8000/openapi.json`, then run:

```sh
pnpm api:generate
```

Orval generates functions/hooks/models in Git-ignored `lib/api/v1/`.
Generated endpoint paths already include `/api`; a runtime base URL should
normally be `http://localhost:8000`, without duplicating `/api`.
The fetcher reads `NEXT_PUBLIC_API_URL_V1`; `.env.example` currently lists
`NEXT_PUBLIC_API_URL` instead. This mismatch remains a scoped implementation gap:
use the variable actually read by code until an authorized configuration task fixes it.
The fetcher returns the response body, including its envelope. Credential handling,
auth interceptors, and automatic refresh are not implemented.

The target product uses email login and a revocable server-side session with a
secure cookie. Current backend JWT/refresh behavior is a separate implementation
baseline; do not invent endpoints or treat generation as completed integration.
