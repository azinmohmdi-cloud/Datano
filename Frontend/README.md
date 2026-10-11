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

The application contains a starter homepage, English invoice examples,
shared primitives/providers, mock invoice hooks, and local health/user routes.
Marketing screens, ownership verification, Google integrations, production
authentication, and charts are not implemented. Local user routes have separate
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
No frontend test runner or test script is configured. See the engineering
guide for runner-neutral TDD and task validation; do not claim nonexistent tests passed.

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
| Public and future authentication pages | `app/(product)/(public)/layout.tsx` | `components/layout/PublicLayout` |
| Account, future profile/admin/site list | `app/(product)/account/layout.tsx` | `components/layout/AccountLayout` |
| Individual site workspace | `app/(product)/sites/[siteId]/layout.tsx` | `components/layout/SiteLayout` |

These inner layouts provide responsive content width/padding. They are used
**inside ProductLayout** and do not repeat header/footer/main landmarks.
Account content is capped at `max-w-5xl`; public/site content at `max-w-7xl`.
ProductLayout grows with content and keeps the footer at the viewport bottom on
short pages. Use one scope layout per page; page content should not add another
outer `main` or document-level header/footer.

The header contains only **حساب کاربری**, **درباره ما**, **سرویس‌ها**, and
**ورود**, plus the home-linked Datano wordmark. Links remain visible in a
two-column grid on mobile and a row on larger screens. Native links, visible
keyboard focus, and the skip link work without JavaScript. Styling reuses
`buttonVariants`, `cn`, and the existing theme tokens.

`components/layout/ProductLayout/links.ts` defines the reserved destinations:
`/account`, `/about`, `/services`, and `/login`. The header does not infer a
session/role or implement account redirects. **Only the homepage currently has
product content**; these destination pages are pending their own tasks and still
return 404. Automatic prefetching of navigation links is disabled. Do not add
placeholder login/profile/dashboard pages or claim authentication to make the
shell appear complete. Account routing from trusted session data remains FE-030.

Every product scope inherits the same footer: Datano wordmark, exactly the three
quick links (home/services/about), and `© 2026 Datano. تمامی حقوق محفوظ است.`
No approved logo asset exists yet, so branding uses a text wordmark. No unverified
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
Playwright infrastructure remains the separate FE-006 task; FE-005 adds no
browser dependency or test runner.

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
