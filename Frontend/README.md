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
