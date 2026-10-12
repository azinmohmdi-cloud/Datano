# Datano frontend engineering guide

## 1. Scope, sources, and project map

This guide applies to `Frontend/` and its descendants. Follow the user's current
task and any more specific directory instructions. Keep work within the authorized
scope; this guide does not authorize unrelated refactors, dependency upgrades,
backend changes, commits, or deployment.

Before implementing a feature, read the relevant source and
`docs/cookbook/component-development-framework.md`. That cookbook defines the
frontend's component architecture. For product work, consult the sibling workspace
documents `../docs/Datano_proposal.md`, `../docs/Datano_MVP.md`, and
`../docs/datano-ux-pages-.md`. The UX document specifies product screens and flows;
it is not an API contract. Verify backend behavior against its source or OpenAPI.
Do not treat instructions stored under sibling directories as automatically
inherited frontend instructions.

**Implemented baseline:** a Next.js starter homepage, invoice example pages,
shared UI/layout components, mock data hooks, local health/user route handlers,
and configured API generation. Marketing dashboards, website ownership flows,
Google integrations, charts, and production authentication UI are product work
described by the shared documents, not implemented frontend features. Do not
invent endpoints, analytical definitions, or working integrations to fill gaps.

### Stack and responsibilities

Use `package.json` for declared dependencies and `pnpm-lock.yaml` for resolved
versions. The current stack is Next.js **16.2.6** App Router, React/React DOM
**19.2.4**, strict TypeScript (locked **5.9.3**), Tailwind CSS **4** (locked
**4.3.0**), shadcn with **Base UI**, TanStack Query **5.100.10**, Axios **1.16.1**,
Orval **8.10.0**, and ESLint **9** with matching Next.js lint configuration.

All paths below are relative to the frontend root unless prefixed with `../`.

| Path | Responsibility and editing boundary |
| --- | --- |
| `app/` | App Router pages, layouts, global CSS, favicon, and route handlers |
| `app/page.tsx` | Starter links to the two invoice examples |
| `app/layout.tsx` | Root document, fonts, metadata, global styles, query provider |
| `app/examples/` | Example shell and `/examples/me/invoices`, `/examples/admin/invoices` pages |
| `app/api/` | Next.js-local health and mock user endpoints; not FastAPI proxies |
| `components/ui/` | Reusable button/table primitives; no feature data dependencies |
| `components/feature/item/InvoicesTable/` | Reference feature architecture: pure UI, two injectors, formatting, loading/error UI |
| `components/layout/` | Global providers and reusable layout shells |
| `data/feature/invoice/` | Domain-organized mock data hooks with exported return interfaces |
| `lib/types/` | Hand-maintained application types, currently `Invoice` |
| `lib/fetcher.ts` | Shared Axios instance and both Orval mutator adapters |
| `lib/utils.ts` | `cn`, combining `clsx` and `tailwind-merge` |
| `lib/api/v1/` | Generated API functions, query hooks, and models; may not exist until generation |
| `public/` | Current starter SVG assets |
| `docs/cookbook/component-development-framework.md` | Detailed architecture, naming, and feature workflow |
| `orval.config.ts` | OpenAPI source, client targets, shared model directory, mutators |
| `components.json` | shadcn `base-luma`, Base UI styling, Lucide icons, RTL and aliases |
| `app/globals.css`, `postcss.config.mjs` | Tailwind 4 integration, theme tokens, base styles |
| `tsconfig.json`, `eslint.config.mjs` | Strict typing, `@/*` alias, lint rules and exclusions |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Commands, dependency resolution, allowed dependency build scripts |

### Commands and prerequisites

Run commands from `Frontend/`, not the workspace root. Use pnpm; there is no
root build command. The locked Next.js package requires Node **>=20.9.0** and
Orval requires **>=22.18.0**. Use a runtime satisfying the locked toolchain; the
project does not pin a Node version or a `packageManager` field.

| Command | Purpose and prerequisites |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install the locked dependency set; report lockfile incompatibility rather than silently updating it |
| `pnpm dev` | Start Next.js development server, normally `http://localhost:3000` |
| `pnpm lint` | Run the configured ESLint CLI; no automatic fixes |
| `pnpm exec tsc --noEmit --incremental false` | Direct TypeScript check; there is no `typecheck` script |
| `pnpm build` | Production build; installed dependencies and any required external resources must be available |
| `pnpm start` | Serve an already-built production application |
| `pnpm api:generate` | Run Orval; requires `OPENAPI_JSON_URL` and a reachable schema |

There is no configured frontend test runner, test script, formatter, or CI
workflow. Optional/transitive packages in the lockfile do not establish these
tools as project conventions. Do not claim `pnpm test`, formatting, or CI checks
exist. A fresh checkout may lack `node_modules`, generated clients, and Next.js
generated types. Report missing prerequisites accurately.

## 2. Architecture and component conventions

Preserve this dependency flow for feature work:

```text
App Router page -> concrete feature injector
                   -> domain data hook -> API client/shared fetcher
                   -> formatting helpers
                   -> loading/error UI
                   -> pure feature UI -> shared UI primitives
```

### Routes and layout shells

- Pages compose concrete feature injectors, such as `AdminInvoicesTable`, rather
  than importing feature `index.tsx`, data hooks, or wiring API results themselves.
  Simple page headings, wrappers, and Next.js navigation are consistent with the
  current examples; put feature behavior in injectors.
- Pass route-derived inputs to the injector that needs them. Do not make a
  reusable feature component read unrelated route state.
- Keep layout composition in `components/layout/`; follow `ExampleLayout`'s
  `index.tsx` with sibling `header.tsx` and `footer.tsx` pattern when relevant.
- Route handlers in `app/api/` are server HTTP entry points, not page components;
  the page/injector rule does not apply to their request handling.

### Pure feature UI

- Use a flat feature directory with `index.tsx` default-exporting the rendering
  component. Define/export `<ComponentName>UIProps` locally, or use a small inline
  prop type. Do not import generated API types or application models into it.
- Model presentation data as primitives, callbacks, and locally typed records or
  arrays of primitives. The existing invoice rows demonstrate that
  "primitive-only" does not prohibit structured presentation props.
- Put visible text and accessible labels in `translations`, and event handlers
  in `callbacks` when present. Keep presentation data in clearly named props.
  Use UI-oriented handler names such as `onClickButton`; adapt business operations
  in the injector.
- Shared primitives from `components/ui/`, React rendering utilities, and `cn`
  are valid UI dependencies. "Pure UI" means independent of fetching and
  application orchestration, not isolated from every reusable module.
- Keep substantial logical UI blocks in non-exported functions at the bottom of
  the file when that improves readability. Pass explicit props; do not close over
  parent component state. Reuse parent prop types through indexed access.
- Extract unrelated features into their own directories rather than growing a
  component that owns multiple business concerns.

### Injectors, data hooks, and shared support

- Default-export concrete variants as sibling files, e.g. `AdminInvoicesTable.tsx`
  and `MyInvoicesTable.tsx`. Consumers import the variant; injectors import the
  pure UI through the directory entry point (`.`).
- Injectors call data hooks and shared helpers before branching, own feature UI
  state/wiring, and map raw results into presentation props. Handle loading,
  failure, empty, and successful results deliberately.
- Put fetching/mutation hooks under `data/feature/<domain>/`, default-export them,
  and expose stable `UseXxxReturn` interfaces. Keep contracts stable when replacing
  mocks with real API calls. The invoice contract uses `succeed: boolean | null`
  with `null` for loading; do not change existing consumers silently.
- Query keys, cache invalidation, retries, and optimistic update behavior belong
  in the data layer. Rendering and translations belong outside that layer.
- Keep shared transformation helpers as sibling `use<ComponentName><Logic>.ts`
  modules, following `useFormatInvoices.ts`. They accept data and return derived
  values without fetching, side effects, or mutation of their inputs.
- Use sibling `loading.tsx`/`error.tsx` components for reusable feature states;
  inline fallbacks remain valid for simple variants. These files under
  `components/` are ordinary components, not App Router loading/error boundaries.
  Follow Next.js special-file contracts only when adding those files under `app/`.
- Follow the cookbook's UI-first workflow: establish presentation props, render
  with fixtures, review the design, add shared states/helpers, wire the injector,
  then integrate real data. Use an already-approved design or task authorization;
  do not add repetitive approval gates for ordinary implementation decisions.

### Server/client boundaries

Keep layouts/pages as Server Components unless their behavior requires a client
boundary. Add `"use client"` at the smallest appropriate entry point for state,
effects, browser APIs, or query hooks. A pure UI imported by an injector is already
in its client module graph; it does not need a redundant directive merely because
its parent is interactive. Do not import server-only code or secrets into that
graph. Props crossing the server/client boundary must be serializable; callback
props belong within the client graph.

Keep `Providers` centralized under the root layout. Preserve one stable
`QueryClient` per mounted provider instead of creating it on every render.
See the [Next.js server/client guidance](https://nextjs.org/docs/app/getting-started/server-and-client-components)
when changing boundaries; verify APIs against the project's installed version.

## 3. Code quality and dependency management

- Preserve `strict: true` and the configured ESLint Next.js Core Web Vitals and
  TypeScript rules. Fix newly introduced diagnostics; do not weaken rules or add
  broad exclusions to make a change pass.
- Narrow `unknown` at external boundaries. Use explicit types for exported
  contracts and type-only imports where appropriate. Do not introduce unexplained
  `any`, non-null assertions, unsafe casts, or suppression comments. If a narrow
  compatibility exception is unavoidable, explain it beside the affected code.
- Existing assertions and `(options as any)?.body` in the fetcher are current
  limitations, not patterns to copy. Address them only in a task touching that
  boundary and verify the generated caller contract.
- Use `@/` for cross-directory frontend imports and relative imports for sibling
  feature modules. Preserve default exports for feature components/hooks and
  existing named exports for primitives/utilities; avoid sweeping export changes.
- Match nearby formatting. Hand-written and generated-style primitive files
  currently differ in semicolon usage; do not reformat unrelated files or introduce
  a formatter as part of a feature without task justification.
- Call hooks unconditionally and before early returns. Include reactive effect
  dependencies and clean up listeners, timers, and subscriptions. Propagate
  cancellation where supported; ignore obsolete async results when necessary.
- Derive presentation values during rendering or in pure helpers instead of
  copying them into state through effects. Use effects for synchronization with
  external systems, not ordinary formatting/filtering.
- Use stable resource IDs for list keys; never generate keys with randomness or
  use indexes for lists that can reorder. Keep transformations immutable.
- Reuse the existing libraries before adding alternatives. Do not introduce a
  parallel query/state manager, HTTP client, styling system, or component library
  without a concrete task need.
- Keep intentional dependency changes synchronized with `pnpm-lock.yaml`. Do not
  add npm/yarn/bun lockfiles. Preserve `pnpm-workspace.yaml`'s allowed build scripts
  (`esbuild`, `sharp`, `unrs-resolver`) and disabled `msw` build script; do not enable
  arbitrary dependency scripts or regenerate the lockfile to bypass a failure.

## 4. API integration and state

### Environment and generation

`lib/fetcher.ts` configures `AXIOS_INSTANCE.baseURL` from
**`NEXT_PUBLIC_API_URL_V1`**. `.env.example` currently lists
**`NEXT_PUBLIC_API_URL`** instead. Use the variable read by the code; do not assume
the example name works. Document a correction when that environment setup is in
task scope. Client-public variables must contain public configuration only.

For the backend's default `make dev` launch, a local runtime base URL is
`http://localhost:8000`, with `OPENAPI_JSON_URL=http://localhost:8000/openapi.json`.
Verify the running server's port rather than assuming it: direct execution of
`../Backend/app/main.py` uses 8004, while its Makefile defaults to 8000. Generated
operation paths carry `/api`; do not accidentally append the prefix twice.

Orval loads its environment through `dotenv` and rejects a missing
`OPENAPI_JSON_URL`. Its two targets generate:

- `lib/api/v1/index.ts`: Axios API functions using `customFetcher`.
- `lib/api/v1/hooks.ts`: React Query hooks using `fetcherHookAdapter`.
- `lib/api/v1/model/`: shared generated schemas.

`lib/api/` is ignored by Git. Do not hand-edit or commit generated output to fix a
contract problem. Change the appropriate schema, generation configuration, or
hand-written adapter within task scope, then regenerate and check its consumers.
The API-function target uses `clean: true`; the hook target uses `clean: false`.
Do not change targets/cleaning policy without checking shared-output behavior.
Generate from a trusted, compatible schema; verify generated signatures rather
than copying the cookbook's illustrative `lib/gen/api/v1` path, which is not the
configured output directory.

### Transport and response contracts

- `customFetcher` returns the HTTP response body (`data`), not an Axios response
  object and not an automatically unwrapped backend `payload`.
- Use the shared fetcher/adapters for API transport. Check method, query params,
  headers, request body encoding, cancellation, and response typing when changing
  them. Preserve both mutators' generated-call compatibility.
- Backend routers register under `/api`, including `/ping`, `/auth/login`,
  `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/permissions`, `/users/`, and
  `/roles/`. Preserve declared trailing slashes and parameter types.
- Backend controller responses use `{ success, message, payload }`; user/role
  list payloads are pagination objects. Verify generated models for exact fields.
  Handle application failure as well as HTTP failure. Do not assume framework
  validation errors or every failure body follow the same envelope.
- Login returns an access-token object with the token at `payload.token`.
  Protected backend routes use bearer access tokens; refresh/logout use the
  HTTP-only `refresh_token` cookie.
- No frontend auth state, bearer interceptor, default cross-origin credential
  setting, or automatic refresh is currently implemented. When implementing auth,
  coordinate credentialed requests, backend CORS, cookie attributes, and origin
  behavior. JavaScript must not attempt to read the HTTP-only refresh cookie.
  Avoid infinite refresh/retry loops and unsafe automatic replay of mutations.

### Query and mutation behavior

The root provider currently sets query `staleTime` to five minutes and `retry` to
one. Preserve these defaults unless a feature needs an explicit override; do not
assume they apply to mutation retry behavior.

- Include request inputs that affect the result in query keys: resource identity,
  filters, pagination, and authenticated identity when relevant. Do not put secrets
  in keys. Keep protected results from being reused across users or access changes.
- Invalidate/update the relevant query data after successful mutations. Use
  optimistic updates only when rollback and authoritative reconciliation are
  defined; do not invent them for every mutation.
- Keep pending submission state distinct from query loading, prevent accidental
  duplicate submissions, and preserve user input on recoverable failure.
- On logout/account changes, cancel and clear appropriate protected cached data.
  If server-side prefetching is added, avoid a process-global query cache containing
  private results from multiple requests.
- Make production data hooks deterministic and use the existing query stack for
  fetching rather than copying example effect-based mocks.

See [TanStack Query's query-key guidance](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys).

### Mock boundaries

The invoice hooks use hardcoded invoices and `Math.random()` to choose success or
failure. The example formatting uses ambient-locale `toLocaleString()`. Neither is
a production data/locale policy; control both explicitly in tests and real work.
No invoice backend endpoint exists in the inspected backend controllers.

Next.js `/api/users` and `/api/users/[id]` hold separate in-module arrays. A created
user in the collection handler is not shared with the detail handler. These mock
routes return shapes different from FastAPI and provide no production persistence
or authorization. Do not treat them as a backend proxy or production user service.

## 5. Security

- Keep credentials, private API keys, refresh tokens, and sensitive user data out
  of committed files, public environment variables, browser bundles, console
  output, query keys, and error reports. Redact sensitive request/response details
  in diagnostics. Never log passwords or bearer tokens.
- Preserve the backend as the authorization authority. Hidden buttons, route
  redirects, and client role checks improve UX but do not protect resources.
  Handle denied access without displaying stale protected data.
- Do not persist session/access/refresh tokens in `localStorage`, `sessionStorage`,
  or browser databases. The actual auth-storage/renewal design must be established
  by the authorized auth task; this guide does not introduce one. See
  [OWASP's browser-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).
- Render untrusted content as text through React. Do not introduce raw HTML
  insertion without a justified sanitization boundary. Validate external URLs and
  redirect targets before using them; avoid open redirects and unsafe schemes.
- Validate user inputs for usable feedback, and require server validation for
  business/security rules. Do not rely on TypeScript casts to validate network
  responses or incoming route-handler bodies.
- When integrating cookie-authenticated operations, evaluate CSRF protection and
  deployment origins with the backend contract. Do not relax SameSite, Secure,
  HttpOnly, or CORS settings in the frontend to make an integration appear to work.
  The current backend refresh cookie uses `secure=False` for development; do not
  describe that setting as production protection.
- Scope requests and caches to the appropriate user/resource. Do not invent
  client-side substitutes for website ownership or membership enforcement.
- Keep dependency changes reviewable; investigate security-related findings that
  affect the task without performing unrelated major upgrades automatically.

## 6. Performance and UI/UX

### Required design reference

Before designing or changing any page or UI component in every future frontend
task, read and follow [the Datano design system](docs/design-system.md), extracted
from the approved FE-007 identity. Keep implemented baselines distinct from future
standards; extend components for approved page needs without redesigning that
identity. In each UI task's final report, confirm design-system consistency and
explain any necessary deviation with a concrete reason.

### UI content generation policy — permanent default

Apply the [Content Guidelines](docs/design-system.md#content-guidelines--permanent-product-standard)
to all current and future Datano pages in every frontend task. Public copy must
be professional, user-centered, natural Persian focused on services, capabilities,
and verified product value. Do not automatically add or repeat development-status,
backend-readiness, demo-only, or incomplete-feature disclaimers across the UI.
Record implementation progress, API connection status, technical limitations, and
unfinished capabilities in project documentation and task reports.

This does not permit presenting unimplemented capabilities as active or usable,
inventing statistics, results, or success, or hiding errors. When a preview needs
clarification to avoid misleading users, use a short, non-repetitive label such as
«پیش‌نمایش مفهومی» rather than lengthy warnings. In operational flows such as signup,
source connection, and dashboards, show actual unavailability and relevant states
honestly, in language proportionate to the user's needs.

Preserve existing rules and report specific conflicts with approved requirements;
do not silently delete or rewrite them. Apply this policy to existing UI only
within an authorized task's scope; it does not authorize unrelated copy changes.

### Shared visuals and accessibility

- Use `cn`, existing primitives, `buttonVariants`, and CSS theme tokens such as
  `bg-background`, `text-foreground`, `border-border`, and `text-muted-foreground`.
  Avoid duplicating shared button/table markup or scattering arbitrary theme
  colors through new features.
- Preserve the configured Base UI/shadcn approach and Lucide icons. Do not assume
  Radix-specific APIs apply to this project. Extend primitives only when multiple
  consumers need the behavior; put feature-specific behavior in the feature.
- Use semantic headings, landmarks, buttons, links, and tables. Give controls
  accessible names, associate form labels/errors with inputs, and make keyboard
  focus visible. Do not communicate state through color or icons alone.
- Preserve keyboard operation and meaningful focus when opening/closing overlays
  or changing routes. For new status updates, expose appropriate accessible status
  or error feedback without repeatedly announcing ordinary rerenders.
- Preserve table captions/headers, stable row identity, and the existing
  horizontal-scroll container. Check long Persian text, narrow screens, zoom, and
  mixed-direction values; avoid forcing the whole page to overflow.
- Define loading, recoverable failure, empty results, and success separately.
  Provide retry actions where an actual recovery operation exists; do not create
  nonfunctional retry buttons. Keep useful existing content during background
  updates when appropriate.
- Build responsive product screens and review mobile, tablet, and desktop layouts.
  Avoid rigid dimensions copied from starter examples when content needs to grow.
  Preserve sufficient contrast and respect reduced-motion preferences in new
  animations. Do not invent a fixed breakpoint or compliance certification policy.

### Rendering and performance

- Keep static shells on the server and client boundaries focused on interactive
  features. Avoid importing large optional libraries into shared entry points;
  load expensive features only when justified by their use.
- Prefer existing Next.js navigation and appropriate image/font facilities.
  Give images meaningful alternatives and stable dimensions. Check asset and
  remote-host configuration before adding external resources.
- Avoid redundant requests and duplicate sources of truth. Use query caching and
  deliberate invalidation; do not add polling without a real freshness requirement.
- Keep render-time formatting deterministic across environments. Do not introduce
  random or time-dependent initial markup that causes hydration differences.
- Profile expensive transformations/rendering before adding memoization,
  virtualization, or extensive code splitting. Report measured findings rather
  than asserting an unmeasured performance improvement or arbitrary budget.

The root layout currently loads Inter, Geist, and Geist Mono through
`next/font/google`, all with Latin subsets. Builds may require access to font
resources. `app/globals.css` defines light/dark tokens with `.dark`, but there is
no implemented theme switcher. Metadata remains the Create Next App starter.
Treat these as current facts; change fonts, theme controls, or product metadata
only when the task calls for them. Ensure new visuals use the existing tokens in
both supported token sets without assuming a theme-selection feature exists.

## 7. Persian and RTL

**New product screens must use Persian copy and RTL.** Existing English invoice
examples may remain examples; do not translate unrelated demo files as incidental
cleanup. Preserve technical brands/identifiers such as GA4 where translation
would obscure their meaning. Product copy must describe verified capabilities;
do not invent customer counts, endorsements, or integration claims.

The current shadcn configuration has `rtl: true`, but root HTML still has
`lang="en"`, no explicit RTL direction, Latin font subsets, and physically aligned
table styles. The configuration alone does not deliver a Persian/RTL product UI.

- Establish `lang="fa"` and `dir="rtl"` at the appropriate document/shared product
  layout boundary when implementing product screens. Centralize direction and
  typography rather than duplicating them across pages.
- Prefer logical utilities/properties (`ms`/`me`, `ps`/`pe`, `text-start`/
  `text-end`, inline-start/end) for direction-dependent spacing and alignment.
  Review the table's current `text-left`, `pr-0`, and example `text-right` classes
  when adapting tables; do not mirror every physical alignment blindly.
- Isolate email addresses, URLs, codes, and identifiers with explicit LTR direction
  or `bdi` as appropriate. Preserve character order and exact copy/paste values.
  Use `dir="auto"` for unknown-direction user text where appropriate. See
  [HTML directionality guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir).
- Mirror directional navigation affordances when their meaning requires it,
  while preserving brand icons, analytical meaning, and chronological ordering.
  If charts are added, check legends, labels, tooltips, axes, and tab order; do not
  reverse data just to mirror a layout. Recharts is described in product documents
  but is not an installed frontend dependency.
- Keep all user-facing strings, including validation and accessible labels, Persian
  through the feature's translation props. Code identifiers and engineering
  documentation remain English. No localization library is currently configured;
  do not introduce one merely to supply static feature translations.
- Choose fonts with verified Persian glyph coverage and readable shaping. Keep
  display numbers/dates separate from canonical API values. Format with explicit
  locale/options, and keep SSR/client output consistent; never convert resource
  IDs or submission payloads to localized strings.
- Use confirmed task/product requirements for calendar, timezone, currency,
  numeral style, and font selection. The shared UX specification contains
  Persian-font/Vazirmatn and solar-calendar requirements for tasks implementing
  that specification; consult its current text. Do not turn demo defaults or
  unconfirmed assumptions into a new global locale/currency policy in this guide.
- Review Persian glyphs, punctuation, mixed-direction fields, logical spacing,
  tables, forms, focus order, and overflow at multiple viewport sizes.

## 8. Testing and TDD

Use **runner-neutral red–green–refactor** for behavioral changes. There is currently
no configured frontend runner, browser-test setup, or test command. Do not claim
tests pass based on linting, typing, manual review, or a package appearing
transitively in the lockfile. Playwright is discussed in product documents but is
not configured here.

For an authorized behavior implementation:

1. Identify observable acceptance criteria and the narrowest useful test boundary.
2. Inspect the current test setup. If still absent, establish the minimal runnable
   setup as part of the authorized task when its scope permits; keep tooling
   choices explicit. If scope forbids setup, report the testing limitation and
   use reproducible manual checks without calling them automated TDD.
3. Write a meaningful test that fails because the behavior is absent or wrong.
   For a defect, reproduce the defect before fixing it; distinguish infrastructure
   failures from a useful red test.
4. Implement the smallest change that satisfies the behavior, run the test, then
   refactor while keeping it passing. Add relevant failure and boundary cases.
5. Run affected regression checks and report the actual commands/results.

### Test boundaries and scenarios

| Boundary | Behavior to verify |
| --- | --- |
| Pure transformations | Formatting/filtering input-output behavior, empty input, immutable inputs, explicit locale handling |
| Pure UI | Supplied text/rows, semantic structure, accessible labels, callbacks, keyboard operation, empty display |
| Injectors | Loading/error/empty/success mapping, variant-specific data, retries or submission states when implemented |
| Data hooks | Stable public return contracts, request inputs, error mapping, query-key separation, invalidation and cancellation when applicable |
| Transport/API | Envelope/pagination handling, HTTP versus application errors, generated caller/adapter compatibility, malformed responses |
| Auth integration | Allowed/denied/expired states, bounded refresh behavior if implemented, logout/cache isolation, credentials |
| Browser journeys | Modified routes, navigation/forms, Persian/RTL rendering, narrow/wide layouts, real integration flows when available |

Use deterministic fixtures. Stub hook contracts or control network responses to
exercise invoice states; do not rely on `Math.random()` for coverage. Freeze or
inject time/locale where behavior depends on them. Use a fresh query client per
test and controlled retry/timer behavior so caches do not couple tests. Isolate
mock data and clear it between tests. Routine unit/component tests must not depend
on live backend/Google services; clearly separate authorized integration checks.

Test observable behavior rather than private implementation details. Use stable
semantic queries when the selected tooling supports them. Do not use snapshots
as the only assertion for interactive behavior. Choose coverage by changed risk;
no numerical coverage threshold is established. Documentation-only changes need
content/path verification, not a newly installed test framework.

## 9. Documentation, Git, and task completion

### Working and documentation practices

- Read affected code, its consumers, and relevant docs before editing. Distinguish
  implemented behavior from intended product behavior and from known gaps.
- Keep changes focused. Respect a task's file restrictions even when this guide
  identifies an adjacent issue. Report out-of-scope gaps instead of repairing them
  opportunistically.
- Within authorized scope, document changed commands, environment setup, API/hook
  contracts, generation steps, and material architectural decisions. Explain why
  a non-obvious boundary exists; avoid comments that merely restate code.
- Keep references current and runnable. The frontend README is still generic
  Next.js starter documentation; do not assume it defines a deployment policy.
- Do not add features, mock production successes, or invent business/API behavior
  from incomplete wireframes. Use existing requirements and report material
  missing contracts while continuing independent authorized work.

### Git conventions

`Frontend/` is its own Git repository. Check its status and diff from that root
before editing and before completing work. Preserve user changes and do not
stage, reset, overwrite, or format unrelated files.

When the user requests commits, keep them focused on a coherent change and use
descriptive imperative messages. There is no established Conventional Commits,
branch naming, PR template, release, or deployment policy in the inspected
frontend; do not claim one. Use existing repository conventions if they later
appear. Do not commit, push, merge, or publish solely because a task is complete.

Review generated/untracked files before staging. Keep `node_modules`, `.next`,
build output, coverage, `lib/api`, TypeScript build artifacts, real environment
files, and keys out of commits according to `.gitignore`. `.env.example` is the
tracked environment template and must contain public placeholders only.

### Validation and completion reporting

- For frontend code changes, run `pnpm lint` and the direct TypeScript check above,
  plus relevant behavioral tests when configured. Run `pnpm build` for routing,
  configuration, dependency, rendering-boundary, or production-build changes.
- After generation/transport changes, generate against the intended schema and
  verify generated consumers where task scope and prerequisites permit.
- For visible changes, check relevant interaction states, keyboard behavior,
  responsiveness, Persian/RTL rendering, and affected navigation.
- Treat tool/network/font/schema failures as failed or blocked checks, not passes.
  Identify existing diagnostics separately from newly introduced ones using
  evidence; do not declare every failure pre-existing without verification.
- For documentation-only work, verify paths, commands, facts, Markdown, and scoped
  diffs. Do not install dependencies or generate clients merely to validate prose.
- Reinspect the final diff/status and confirm only intended files changed. No
  CI pass, production readiness, or completed integration may be claimed without
  the corresponding evidence.

Finish each task with a concise report containing:

1. The outcome and meaningful behavior/documentation changes.
2. The changed files, with usable file links when reporting in chat.
3. Exact validation commands and pass/fail results; label manual checks clearly.
4. Checks skipped or unavailable, with concrete reasons.
5. Remaining limitations, out-of-scope issues, and any required follow-up.
