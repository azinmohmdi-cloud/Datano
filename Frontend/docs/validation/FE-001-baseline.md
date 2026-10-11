# FE-001 — Frontend environment and baseline

Recorded on 2026-10-11. Scope: the existing frontend and its execution/static
validation blockers. No product pages, Persian typography, private fixture
environment, project test runner, backend changes, or API generation were added.

## Environment and reproducible setup

- Tested on macOS with Node **24.19.0** and pnpm **11.25.0**.
- `.nvmrc` selects the tested Node version; `package.json` records the pnpm
  version and the locked toolchain's Node minimum, **22.18.0**.
- The system-default Node was **22.17.0**, below Orval 8.10.0's engine minimum.
  An already available compatible runtime was selected for this task.
- `node_modules` was initially absent. The existing lockfile was installed
  without dependency upgrades; `pnpm-lock.yaml` and the build-script policy in
  `pnpm-workspace.yaml` remain unchanged.
- No backend process or API environment values are needed for these demo pages.

Portable setup and commands are documented in [the README](../../README.md).
For this local validation session, commands were run from `Frontend/` with:

```sh
export PATH="/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --version
pnpm --version
pnpm install --frozen-lockfile --store-dir /private/tmp/datano-fe-001-pnpm-store
```

The explicit temporary store kept installation writes within the task's allowed
paths; it is not a required project-wide store location. Registry access was
required. A sandbox attempt failed with `ENOTFOUND`; the same locked installation
succeeded with approved network access. A subsequent installation using
`--frozen-lockfile --offline` and the same store also succeeded.

## Initial baseline and fixes

| Check | Initial result | Resolution |
| --- | --- | --- |
| `pnpm lint` | Failed: two `react-hooks/set-state-in-effect` errors and one `@typescript-eslint/no-explicit-any` error | Invoice demo hooks now use the existing TanStack Query stack; fetcher uses the already typed `options?.body` |
| `pnpm exec tsc --noEmit --incremental false` | Passed | No compiler settings weakened |
| `pnpm build` | Sandbox build could not fetch Inter, Geist, or Geist Mono from Google Fonts | The unchanged font setup built successfully with approved network access |
| `pnpm dev --hostname 127.0.0.1 --port 3000` | Sandbox listener denied with `EPERM` | The same command started successfully with approved local-server access |

Both invoice hooks retain `UseGet*InvoicesReturn`, `invoices`, and the
`succeed: boolean | null` contract: pending is `null`, success is `true`, and
failure is `false`. The demo data and randomized success/error condition remain.
Distinct `examples/invoices/me` and `examples/invoices/admin` query keys keep
their data separate. Demo retry and window-focus refetch are explicitly disabled;
successful results use the existing provider's five-minute freshness default.
This avoids direct effect-driven state updates without suppressing lint rules.

The fetcher change only removes a redundant cast. Request body forwarding,
environment variable names, response envelopes, credentials, and Orval adapters'
public signatures are unchanged. Generated-client compatibility and real API
integration are reserved for their later task.

## Final validation

All commands below used the selected Node runtime and ran from `Frontend/`.

| Command/check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --offline --store-dir /private/tmp/datano-fe-001-pnpm-store` | Passed; already up to date |
| `pnpm exec node --version` | `v24.19.0` |
| `pnpm --version` | `11.25.0` |
| `pnpm exec orval --version` | `8.10.0`; no client generation performed |
| `pnpm lint` | Passed; zero errors or warnings |
| `pnpm exec tsc --noEmit --incremental false` | Passed, including a check after the final build |
| `pnpm build` | Passed with Next.js 16.2.6; pages and local route handlers built |
| `pnpm dev --hostname 127.0.0.1 --port 3000` | Ready; HTTP and browser checks passed |
| `pnpm start --hostname 127.0.0.1 --port 3001` | Ready using the final build; HTTP and browser checks passed |
| `git diff --check` | Passed |

### HTTP and browser smoke checks

The temporary script `/private/tmp/datano-fe-001-smoke.cjs` used the preinstalled
Playwright library and headless Chrome. It was run against each server with:

```sh
node /private/tmp/datano-fe-001-smoke.cjs http://127.0.0.1:3000
node /private/tmp/datano-fe-001-smoke.cjs http://127.0.0.1:3001
```

Each run verified:

- HTTP 200 for `/`, `/examples/me/invoices`, `/examples/admin/invoices`,
  `/api/health`, `/api/users`, and `/api/users/1`.
- The health response is `{ "status": "ok" }` and initial invoice HTML contains
  the loading fallback before client hydration.
- Navigation through the homepage's existing invoice links at **1440×900** and
  **390×844** viewport sizes.
- Both successful and failed invoice queries in isolated browser contexts, with
  `Math.random` controlled to `0.5` and `0.1` respectively.
- Two personal rows and five admin rows on success, with the expected invoice
  identifiers and no cross-variant data.
- The error message and absence of a table on failure.
- No uncaught browser `pageerror` events in those scenarios.

Each server passed six HTTP checks and eight browser scenarios. One preliminary
development run had an incorrect smoke-script expectation for a personal invoice
identifier; the harness was corrected to the existing fixture and the complete
run passed. This was not an application failure.

These are automated smoke checks, not a configured repository test suite or a
claim of a behavioral TDD cycle. The script remains temporary; no Playwright
dependency, browser-test configuration, or project test command was introduced.
Repeatable project browser-test infrastructure remains **FE-006**.

## Remaining boundaries

Uncached compilation/build still needs access to the existing Google Fonts.
Persian/RTL/Vazirmatn and product metadata belong to **FE-002**. Invoice randomness
is limited to the existing examples; a private deterministic UI review environment
belongs to **FE-005**. Real API environment alignment and generated-client checks
belong to **FE-029**. None of those tasks were started or marked complete.

The local validation servers were stopped after their checks. No files were
staged, committed, pushed, or deployed.
