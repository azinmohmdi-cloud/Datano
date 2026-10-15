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
navigation. FE-016 opens the private ownership page for an unverified site;
FE-017 opens source connection for a verified site without sources. FE-018 opens
receipt review for waiting/failed sites. FE-019 opens the private dashboard shell
for ready/valid-empty sites, preserving site identity. This is review navigation,
not a real report or server authorization/readiness check.

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
below; FE-016/FE-017/FE-018 add ownership, source connection and receipt review.

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
unverified; FE-016 adds a private ownership-review link without a real token,
ownership check, Google source or report. FE-034 with BE-018 owns real registration,
conflict responses and list/cache integration.

`/websites/new` currently displays honest guest access with Login and a public
list backlink. Query flags cannot supply an account or sample result. Production
excludes the new private route/fixture under the unchanged review policy.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e add-website.spec.ts websites.spec.ts profile.spec.ts`.
See [FE-015 validation](docs/validation/FE-015-add-website.md) for executed evidence.

## HTML ownership verification UI — FE-016

Open `/ui-review/websites/verify` with UI Review enabled. An unverified list site
opens `?site=unverified`; the separately selected registered Add Website fixture
links to `?site=new`. Both return to the existing private list. Domain and
scenario selectors are allowlisted; unknown/repeated parameters fall back to the
existing unverified site and ready state. Changing either selector resets the
fixture. No arbitrary hostname or token can be injected via the URL.

`state=ready|checking|success|failed|expired|expiring|error` covers HTML instructions,
disabled waiting, success, missing code, expiry and operational error. The ready
sample starts a 24-hour local review timer; `expiring` starts five seconds before
expiry. Expiration disables copy/check, clears visible copy confirmation and
offers a new-code action that reports actual unavailability without renewing the
old code. Check/retry also reports unavailability, never simulated ownership.
Success is an independently selected fixture and retains no-source/no-report
status. Its dashboard action opens FE-017's private source connection page for
the same sample hostname; it does not open a fabricated dashboard.

The private code deliberately uses `UI_REVIEW_ONLY_NOT_A_VALID_CHALLENGE`, not a
random token or an issued backend challenge. It is rendered as read-only text,
never an actual meta element. Clipboard copying writes exactly the supplied
meta tag, including ASCII quotes and angle brackets. Denial/unavailability selects
the code for manual copying and displays an accessible error. Late completion
after expiry or navigation cannot announce stale success. Timers/async operations
are cleaned up. Sample copy/results grant no session, site ownership or property
permission and do not mutate the list, request an API or persist browser state.

`/websites/[websiteId]/verify` follows the Backlog website namespace and currently
shows guest access, Login and a public list backlink. Route/query parameters do
not grant identity or expose a challenge/result. The old `/sites/[siteId]` scaffold
is unchanged. Production excludes private review routes/fixtures even with the
review flag enabled. FE-035 with BE-020 will supply actual owner/site-bound,
24-hour challenges and results; BE-019 owns secure HTML fetching/DNS/redirects.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e website-verification.spec.ts add-website.spec.ts websites.spec.ts profile.spec.ts`.
See [FE-016 validation](docs/validation/FE-016-website-verification.md) for executed evidence.

## Google source connection UI — FE-017

Open `/ui-review/websites/connect` with UI Review enabled. GA4, Search Console
and Ads each have an optional card, independent state and a single selected
property/account. Product interactions in one card preserve other cards' drafts,
connections and errors. A waiting/failed source does not block another connected
source. Any one connected source permits previewing receipt; connection itself
never implies a successful sync or report. FE-018 opens the receipt screen with
only eligible connected sources queued; other sources remain disconnected in
that initial receipt preview. No job is actually enqueued.

Independent `ga4`, `gsc` and `ads` selectors accept
`disconnected|authorizing|select|connected|cancelled|no-access|no-resources|revoked|disconnect-confirm|disconnect-pending|error`.
Changing private selectors resets the whole fixture, as the notice states;
ordinary product actions do not. Site selectors are `no-connection`,
`proof-example`, `new`, `unverified` and FE-014's `waiting`, `failed`,
`report-ready`, `report-empty`. The first uses FE-014's verified site;
proof-example/new represent independently selected successful FE-016 proofs.
Unknown/repeated selectors fall back to no-connection/disconnected; arbitrary
property, OAuth code, token or role query parameters are ignored.

Resource selection uses a labeled native radio group: one eligible option per
source, with visible name and isolated identifier. Unrelated choices are disabled;
selection errors focus the first eligible radio and are associated with the group.
Drafts persist on registration error. Private identifiers are visibly inert
`UI-REVIEW-*` strings or `.test` hostnames; no provider API/schema is fabricated.
Permission/site eligibility is supplied by fixtures, never inferred from a
hostname substring. Real discovery and eligibility require trusted backend data.

Local cancellation of a waiting fixture shows cancelled without a popup, callback
or credential. Check access, missing resources and revoked permission are distinct.
Revoked sources show the previous selection but cannot permit receipt by themselves.
Disconnect uses a focused inline confirmation naming the source, with its selected
resource retained. Cancel restores focus. Confirm reports actual unavailability
and keeps the connection; pending is a separately selectable fixture. Real
connect/register/disconnect operations are not simulated as successful.

Successful ownership review and the no-connection list site open their matching
private connection page, with a list backlink. Unverified ownership blocks every
source action and offers the existing private verification route; query flags
cannot bypass that UI guard. `/websites/[websiteId]/connect` currently preserves
guest access, Login and a public list backlink. Public route/query values do not
grant identity/permission or expose fixtures. Shared profile, header/footer and
the old `/sites/[siteId]` scaffold remain unchanged.

FE-036/FE-038/FE-040 with BE-022/BE-025/BE-028/BE-031 implement actual OAuth,
permitted/related resource discovery and connection. FE-042/BE-034 own real
disconnect/replacement. Website proof alone grants no Google property permission;
Ads requires account access and site association. No provider scopes, OAuth URL,
callback API, token storage, data fetch or real permission claim is introduced.
Production excludes this private route/fixture under the existing review policy.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e google-connections.spec.ts website-verification.spec.ts websites.spec.ts add-website.spec.ts profile.spec.ts`.
See [FE-017 validation](docs/validation/FE-017-google-connections.md) for executed evidence.

## Data receipt and report readiness UI — FE-018

Open `/ui-review/websites/receive` with UI Review enabled. Three independent
source cards distinguish disconnected, queued, receiving, failed, successful
empty and successful with data. Report readiness is separate from source status:
verified ownership and any one connected/permitted source with a successful,
complete, final result covering its selected window permit a partial report.
Other disconnected, waiting or failed sources are not counted as zero and do not
hide that result. An all-empty set of valid results is an available empty report;
a mixed empty/data set is an available report with data. Previous valid results
remain available while a new receipt is running or has failed.

Independent `ga4`, `gsc`, `ads` selectors accept
`disconnected|queued|receiving|failed|empty|ready|incomplete|permission-error|wrong-window|refreshing|retry-failed`.
The last three exercise a mismatched successful window, a new receive with a
previous valid result and a failed retry with a previous valid result. Unknown or
repeated values use the selected site's preset: waiting/failed/ready/empty GSC
for the corresponding FE-014 fixture; disconnected for other sources/sites.
Default site is `waiting`. Site selection resets all source scenarios; source
selection resets the presentation and action errors. These are private fixture
selectors, never trusted permission, sync or readiness parameters.

Cards display source civil windows/coverage and timezone, complete/final versus
incomplete/mismatched coverage, and the last successful result/time. Fixed review
windows have 28 final days and intentionally differ across sources. Civil days
are displayed in the Persian calendar without shifting them into UTC/Tehran;
operational UTC success timestamps are displayed in Asia/Tehran. This page does
not introduce a date filter, comparison charts or a 72-hour readiness blocker;
the MVP's 72-hour evaluation condition concerns future recommendation work.

FE-014 waiting/failed sites open this page with the same hostname. Managing
connections preserves that site's connection/revoked/disconnected sample states;
receipt failure remains distinct from disconnection. FE-017 continuation opens
queued receipt for eligible connected sources, without assuming success.
List/profile backlinks remain available. FE-019 report viewing opens the private
dashboard shell with the same site and independent source scenarios; no real
report is created. Refresh/check/retry show actual unavailability and preserve all results,
with no request, timer, fake progression, percentage or ETA.

`/websites/[websiteId]/receive` follows the approved website namespace and keeps
the public guest access, Login and public list backlink. Query flags never expose
sample source results or grant ownership. Production excludes the private route
and fixture bundles even with `UI_REVIEW_ENABLED=1`. Real authorized job status,
receipt, retry and report readiness require BE-023/BE-026/BE-027 and FE-037;
multi-source receipt/refresh follows the later backlog integration tasks.
Presentation types are local inputs, not invented backend contracts. No backend,
provider/client generation, dependency, header/footer or profile change.

The approved AccountLayout, neutral background, Persian/RTL, Vazirmatn,
brand/destructive tokens, shared Card/Button/EmptyState and Lucide symbols are
reused. Cards stack on mobile and form three columns from lg; technical values
are isolated LTR, controls wrap and keep their 48px minimum.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e data-receipt.spec.ts google-connections.spec.ts website-verification.spec.ts websites.spec.ts add-website.spec.ts profile.spec.ts`.
See [FE-018 validation](docs/validation/FE-018-data-receipt.md) for executed evidence.

## Dashboard shell and period controls — FE-019

`/ui-review/websites/dashboard` reviews the shell with UI Review enabled. It uses
ProductLayout and the existing SiteLayout, a site/domain/ownership panel, period
controls and three source metadata Cards. No KPI, data series, recommendation or
real report operation is implemented by this task.

The default window is 28 inclusive final source days, with an immediately preceding
equal-length comparison enabled initially. Each source keeps its own final end and
timezone. The fixed review clock is 2026-10-14T09:00:00Z; GSC, GA4 and Ads final
ends are respectively October 10, 11 and 12. Unknown/older-than-the-approved-delay
final metadata does not fabricate a default window. Received coverage, intersection
with the requested/comparison windows, actual covered end and final end are distinct.
Unavailable values show `—`; incomplete and provisional coverage retain text labels.
The fixtures contain no previous-period data, so comparison coverage remains absent
until a custom comparison overlaps supplied coverage. A window does not invent data.

Custom solar dates are entered in labeled text inputs as year/month/day, with
Persian, Arabic or ASCII digits and `/` or `-` separators. Intl's Persian calendar
validates civil dates, including leap years; no date library is added. Apply keeps
canonical Gregorian civil days without shifting them to another timezone. Invalid
dates, reversed windows and dates after the previous source day are rejected with
linked Persian errors/focus. Valid windows containing nonfinal days remain provisional;
they are not evidence for recommendation evaluation. Draft editing does not change
the applied window. Comparison can be toggled with keyboard; returning to 28 days
restores per-source defaults. Changing site resets drafts, feedback and comparison.

`site` selects existing allowlisted list/receipt sites, defaulting to `report-ready`.
Independent `ga4`, `gsc`, `ads` scenarios reuse FE-018's selectors; `view=ready|loading|error`
reviews shell loading/failure. Unknown/repeated selectors use defaults. Ownership and
receipt validity gate the private report state; arbitrary URL flags grant no rights.
The list and receipt actions open the matching shell; receipt handoff and backlinks
retain source scenarios. Fixtures and the fixed clock remain exclusively internal.

`/websites/[websiteId]` uses a new pathless `(workspace)` group with SiteLayout,
while existing `(account)` onboarding routes and `/sites/[siteId]` are preserved.
The public injector displays guest access with Login and My Websites links. It
imports no fixture/controller and ignores query-supplied identity or source data.
Real authorization, report data and date-filter/refresh integration remain FE-037/FE-043.
The private route remains excluded from production discovery and bundles.

The approved pale blue backdrop is centralized in `--page-dashboard` and selected
only by `.page-surface-dashboard` inside main. Both token themes, Persian/RTL,
Vazirmatn, brand symbols, shared controls/cards and the single footer are preserved.
No dependency, backend/API, profile, public-page or navigation design is changed.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e dashboard-shell.spec.ts data-receipt.spec.ts websites.spec.ts ui-review.spec.ts`.
See [FE-019 validation](docs/validation/FE-019-dashboard-shell.md) for executed evidence.

## KPI cards and data freshness — FE-020

The existing private dashboard review now composes a separate KPIOverview injector
through the shell's optional overview slot. The period controller remains the
single source of truth for applied windows and comparison visibility; draft editing
does not change KPI selection. Ownership/readiness/loading/error gates remain intact.
The public `/websites/[websiteId]` access-state injector is unchanged and imports no
KPI fixtures, records or private selectors. Real reporting still belongs to FE-037/FE-039.

Four cards show GA4 whole-window totalUsers, sessions and keyEvents, and GSC aggregate
clicks/impressions CTR. Each retains source, unit, resource, exact query window,
coverage, quality and successful-receipt timestamp. Users are never summed from
daily rows; keyEvents are not Ads conversions; CTR is not an average of row rates.
Only one observation matching site/source/property/metric/window is usable.
Duplicate, mismatched or absent observations produce `—` instead of inferred values.
The supplied counts/ratios are presentation records, not an invented endpoint schema.

Actual numeric zero, missing value, zero CTR denominator, malformed measurement,
loading/error, incomplete/thresholded/provisional quality and stale data remain
distinct. A valid zero click count with positive impressions displays 0%; zero
impressions display `—` with an explanation. Unknown is never converted to zero.
Partial known values retain explicit quality labels; no missing current/comparison
window is fabricated, proportionally scaled or filled from another window.

Successful UTC timestamps display as Persian dates in Asia/Tehran. Age strictly
greater than 72 hours is labeled stale, following the MVP evidence-freshness boundary;
exactly 72 hours remains recent. This is not a new report-visibility or recommendation
engine gate. Values stay visible when old. Missing, malformed or future timestamps
show unknown freshness. Per-value retrieval time is independent of the last successful
source sync, so a newer unrelated sync cannot silently freshen an old value. Failed
syncs with a prior valid result preserve that result and the source's failure label.

`kpi=valid|mixed|zero|missing|zero-denominator|partial|thresholded|stale|loading|error|unknown-time`
selects fixed private scenarios. Unknown/repeated selectors default to valid;
arbitrary URL value/role inputs supply no measurement or authority. Changing site
resets to its preset and valid KPI scenario; changing review scenarios resets the
shell, as its private notice explains. Valid fixtures include only default whole-window
and explicit 2026-09-23–2026-10-10 custom-window aggregates; arbitrary other windows
have no aggregate. Comparison values remain absent unless an exact record exists.

The mixed/stale GA4 fixture ends on 2026-10-10 with a successful receipt at
2026-10-11T08:00:00Z, 73 hours before the fixed review clock. Period controls/source
Cards and KPI Cards consume the same metadata; a stale fixture does not contain
complete civil days after its receipt timestamp. Other sources retain independent
ends/timestamps. Empty successful GA4 fixtures explicitly supply zero counts;
empty GSC supplies zero clicks/impressions and undefined CTR.

Design System identity, Persian/RTL/Vazirmatn, existing Card/status/icon recipes,
both token themes, source-isolated labels and 320/390/768/1440px layouts are preserved.
No new dependency, chart, Search Performance/Ads section, API call, polling, retry
operation, storage effect, global palette or change to earlier pages is introduced.

Focused check: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e dashboard-kpi.spec.ts dashboard-shell.spec.ts data-receipt.spec.ts websites.spec.ts ui-review.spec.ts`.
See [FE-020 validation](docs/validation/FE-020-kpi-freshness.md) for executed evidence.

## Traffic trend — FE-021

`analytics/TrafficOverview` adds the GA4 daily sessions chart below the KPI overview.
It uses Recharts 3.10.1 with the matching React 19.2.4 `react-is` peer. The pure UI,
concrete injector, Persian content and snapshot helpers are separate; the existing
dashboard controller remains the only owner of the applied period/comparison.

Daily snapshots match website, GA4 property, metric and exact query window. Invalid,
duplicate, missing and uncovered days remain gaps; only explicit zero draws zero.
Daily data is never used to reconstruct whole-window unique users. Chronological
plotting is LTR inside the RTL page, with Persian solar dates/numbers and an RTL
tooltip. Current and previous windows align by day index, retain both actual dates
and use solid/dashed lines. A native disclosure exposes a semantic daily table.

The private dashboard accepts `traffic=valid|empty|gaps|comparison`, alongside the
existing `kpi`/source selectors. Unknown/repeated values fall back to valid; changing
site resets the scenario. Daily fixtures exist for the explicit default/custom
windows, not arbitrary queries. The `comparison` scenario adds explicit prior
snapshots and matching source coverage. The default keeps missing comparisons
unavailable. Fixtures, controls and charts remain outside the production route
graph. Real reporting is integrated in FE-037; no data hook/API/storage is invented.

Run `pnpm test:e2e dashboard-traffic.spec.ts dashboard-kpi.spec.ts dashboard-shell.spec.ts`
with the existing browser setup. See [FE-021 validation](docs/validation/FE-021-traffic-trend.md)
for executed checks, runtime details and scope.

## Search Performance — FE-022

`analytics/SearchPerformance` adds four independent Search Console metrics below
TrafficOverview: clicks, impressions, aggregate CTR and source aggregate position.
The pure UI and concrete injector consume presentation observations scoped to the
website, property and exact applied window. Missing values display `—`; zero,
undefined CTR, partial/thresholded/provisional data, loading/error and stale values
retain distinct text and per-value receipt metadata. Existing period/comparison
state stays in the dashboard shell.

Top query rows are a separate input and table, explicitly identified as a subset.
No aggregate is computed from their sums, ratios or average positions. Finalized
rows do not imply a comprehensive query list. Row availability/failure is independent
of aggregate metrics. The existing CTR overview and this section share the same
private observation, including review scenario changes.

Private review adds `search=valid|mixed|zero-denominator|partial|stale|loading|error|no-totals|empty-rows|rows-error|comparison`.
Unknown/repeated selectors use valid; changing site resets scenarios. Review data
is deterministic and confined to the internal graph. No dependency, API, fetching
hook, session/storage behavior or prior feature redesign was added. Real Search
Console ingestion/report integration remains later Backlog work.

Run `pnpm test:e2e dashboard-search.spec.ts dashboard-traffic.spec.ts dashboard-kpi.spec.ts dashboard-shell.spec.ts`.
See [FE-022 validation](docs/validation/FE-022-search-performance.md) for executed
results and the exact local review URL.

## Google Ads Performance — FE-023

`analytics/AdsPerformance` adds cost, clicks, conversions, CPC and conditional
ROAS. It consumes local presentation observations, separate from GA4 keyEvents
and Search Console. The existing dashboard controller supplies applied periods
and comparison; no fetching hook, API, dependency or session behavior is added.

Cost micros are validated as nonnegative signed-int64 decimal strings and kept
in exact rational arithmetic. Click counts are safe integers; conversions and
conversion value retain their supplied decimal precision. Currency comes from
the selected Ads account and must match monetary observations. Display formatting
uses its currency fraction digits, Persian numerals and explicit LTR ISO code,
without exchange or rial/toman assumptions. Rounding happens only at display;
small positive values use a less-than label instead of apparent zero.

CPC divides cost by matching clicks; zero clicks is undefined. ROAS divides a
matching conversion value by positive cost. The same website/account/window,
currency, report identity, basis, receipt and coverage are required for ratios.
Missing/incompatible inputs display `—` with a reason. Zero conversion value with
positive cost gives a real zero ROAS. Quality/freshness are independent of value;
old values remain visible and unrelated sources retain their metadata.

Private review adds the allowlisted `adsMetric` selector, separate from the existing
`ads` connection/receipt selector. Scenarios cover USD/EUR/JPY/KWD, partial/stale,
zero/zero-clicks/zero-value, missing value, currency/basis/coverage mismatch,
unknown currency, independent loading/error and comparison. Unknown/repeated
values fall back to valid; changing site resets scenarios. All fixtures remain
private; real Ads ingestion/report integration belongs to later Backlog work.

Run `pnpm test:e2e dashboard-ads.spec.ts dashboard-search.spec.ts dashboard-traffic.spec.ts dashboard-kpi.spec.ts dashboard-shell.spec.ts`.
See [FE-023 validation](docs/validation/FE-023-google-ads.md) for executed evidence.

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

### Dashboard redesign: FE-019–FE-023 (2026-10-15)

The opted-in development page `/ui-review/websites/dashboard` now contains three
independent metric-selectable Recharts plots, compact expandable KPIs, separate
site and period Cards and the preserved top-query table. The final same-day UI
amendment replaces the former overview/freshness list with three GA4 KPIs above
the existing traffic chart. All plots share the full content width and 20rem
height; Search's unchanged query card follows its chart without a two-column gap.
Earlier task sections above describe their historical baselines. Review tools are initially
collapsed under «ابزار بررسی خصوصی UI». Existing scenario selectors remain.
`?trend=empty`, `?trend=gaps`, `?trend=loading`, and `?trend=error` exercise daily
GSC/Ads states independently of their KPI aggregates. Existing `traffic`, `search`,
`adsMetric` scenarios and custom exact-window fixtures remain available.

Public product pages still require a trusted session/report integration. No API
endpoint or backend code is introduced. Data requirements are recorded in MVP
and BE-024/026/027/029/030/032/033, FE-037/039/041; fixtures stay excluded from
production. See `docs/validation/dashboard-redesign.md` for redesign validation
and [final UI adjustments](docs/validation/dashboard-final-ui-adjustments.md)
for the subsequent scoped layout amendment and its checks.
