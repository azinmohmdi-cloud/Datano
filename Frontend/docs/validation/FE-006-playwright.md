# FE-006 — minimal Playwright infrastructure

Validation date: 2026-10-11. Authorized scope: FE-006 only.

## Dependency, setup, and scope

FE-005 is complete in `770c3ed`; the initial working tree was clean. Node 24.19.0
and pnpm 11.25.0 from the established baseline were used.

- Added exact dev dependency `@playwright/test@1.62.1` and synchronized the pnpm
  lockfile. Only four new package versions were added: Playwright test, Playwright,
  Playwright core, and its optional Darwin fsevents. No existing package version
  was upgraded/removed. pnpm regenerated optional/transitive peer references
  (including Next's optional Playwright peer and supports-color bindings) and
  refreshed ESLint's deprecation metadata; these are not dependency upgrades.
- Added `test:e2e` and `test:e2e:install` commands. The latter installs matching
  Chromium; browser installation is separate from package installation.
- `playwright.config.ts` owns an opted-in Next dev server on 127.0.0.1:3100,
  refuses existing-server reuse, and bounds startup/test/assertion/run timeouts.
  It uses one worker and no retries by default, rejects focused tests, and fixes
  locale/timezone/light theme/reduced motion. Optional explicit Chrome selection
  does not silently replace the default bundled Chromium.
- Mobile (390×844, touch/mobile emulation) and desktop (1440×900) run the same
  tests with the Chromium engine. Reports do not open a browser automatically;
  failed tests retain traces/screenshots. Generated reports/results are ignored
  by Git and ESLint; source tests/config remain linted and typechecked.
- `tests/e2e/fixtures/ui-review.ts` opens a fixed public/ready/guest review
  scenario in the test-scoped page/context supplied by Playwright. Expectations
  are independent literals; it imports no application fixture or random invoice
  hook. No shared session/page, real backend, or Google API is required.
- README documents setup, channel choice, projects, repeat runs, server ownership,
  diagnostics, and resource prerequisites. No CI workflow, additional browser
  engine, unit runner, product page, or backend/API integration was introduced.

Implementation references: official [configuration](https://playwright.dev/docs/test-configuration),
[fixtures](https://playwright.dev/docs/test-fixtures),
[web server](https://playwright.dev/docs/test-webserver), and
[browser installation/channels](https://playwright.dev/docs/browsers). Options were
also checked against the installed 1.62.1 types/source.

## Meaningful navigation Red → Green

The initial runnable suite passed RTL and sample-state tests but failed the
navigation test at both sizes. After activating the native skip link, navigating
home, and going Back, the URL returned to `/ui-review?...#main-content` while the
DOM still showed the homepage. The expected sample-email control was absent.

Removing a redundant test navigation did not resolve this. A focused diagnostic
showed `history.state` was an App Router entry initially, but `null` at the native
skip-link hash entry. Installed Next's popstate handler returns early for a null
state, explaining the mismatch. This was a real navigation defect, not a missing
runner/browser or an assertion removed to obtain a pass.

The necessary scoped correction changes only ProductLayout's skip anchor to the
existing Next/Link with the same href/text/styles and prefetch disabled. App Router
now maintains the hash history entry. The original failing navigation assertion
passes unchanged; a dedicated no-JavaScript test also verifies that the native
href and focus behavior remain functional. No separate product feature/task was
implemented. Diagnostic console logging was removed.

## Executed checks

Commands below ran from `Frontend/`, with the baseline Node first in PATH.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --offline --store-dir /private/tmp/datano-fe-001-pnpm-store` | PASS, exit 0; frozen manifest/lockfile agreement |
| `pnpm test:e2e --list` | PASS; eight tests, two files, mobile/desktop |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e` | PASS, six/six before adding the no-JS regression |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --repeat-each=2 --workers=2` | PASS, sixteen/sixteen; all eight final tests twice with two workers |
| `pnpm lint` | PASS, exit 0 |
| `pnpm exec tsc --noEmit --incremental false` | PASS, exit 0 |
| `UI_REVIEW_ENABLED=1 pnpm build` | PASS, exit 0; review route still absent |
| `git diff --check` | PASS |

Both viewport projects passed:

1. Persian document language/direction, inherited RTL navigation, four visible
   approved header links, one set of landmarks, intact email/URL values with LTR
   isolation, two fixed rows, and no horizontal page overflow.
2. First Tab/Enter skip-link focus; real footer navigation home; private preview
   absent from product content; browser Back restores the review and fixed email.
3. Sample admin/empty/error/ready selection, recovery action/focus, deterministic
   reload, edited email/checkbox reset, no API requests during interactions, and
   unchanged empty cookies/browser storage. No role/session is created.
4. Native skip-link focus and RTL product document with JavaScript disabled.

Playwright creates new contexts for tests and repeated runs; the two-worker repeat
run verifies that modified sample controls/personas do not couple tests. All
servers/browsers are stopped by the runner. Tests use web-first assertions and
bounded waits, without sleeps, random outcomes, or real backend requests.

The temporary FE-004 production regression harness was also rerun against the
final build with the bundled Node executable, and passed (exit 0):
`/private/tmp/datano-fe-004-check.cjs`. It covers actual homepage SSR/keyboard,
public/account/site composition at 320/390/768/1440px, light/dark, shared footer,
short/long content, 200% text, and navigation/skip link without JS. Its captures
remain under `/private/tmp/datano-fe-004-*`; this is supplementary regression,
not the new repository runner.

## Environment failures and validation limits

- The first pnpm command used a different store from the existing installation;
  reusing the FE-001 store resolved this without reinstalling/upgrading the stack.
  A small incidental workspace store was moved intact to
  `/private/tmp/datano-fe-006-unused-store-20261011`, leaving no generated root
  files. Sandbox registry DNS failed; approved network execution installed the
  requested package.
- `pnpm test:e2e:install` failed: Playwright's distribution returned HTTP 403 with
  a location restriction for Chrome for Testing 151.0.7922.34, Chromium v1234.
  **Matching bundled Chromium was not installed or executed.** Final browser tests
  instead explicitly used installed Google Chrome **154.0.8037.98** through the
  documented `PLAYWRIGHT_CHANNEL=chrome` option. Default Chromium selection remains
  configured; its download/run needs an environment with distribution access.
  No alternate mirror, executable-path fallback, or browser upgrade was performed.
- An initial run and file write hit ENOSPC. Approved deletion of only the ignored,
  reproducible `Frontend/.next` cache/output freed space; Next regenerated it and
  final build/tests passed. No user source/data or unrelated cache was deleted.
- Initial diagnostics identified the fixture callback name `use` being mistaken
  for React's hook and reducedMotion belonging under contextOptions in this
  version. Both were corrected without weakening lint/type rules. These setup
  failures are not claimed as behavioral Red tests.
- Inherited FORCE_COLOR/NO_COLOR produced non-failing Node warnings. No console
  warning was suppressed by changing project rules.

This is development UI test infrastructure, not proof of auth/API/Google integration
or production readiness. The private-route discovery policy, fixtures, dependencies
other than Playwright, global fonts/providers, backend, and engineering guides are
unchanged. No files were staged, committed, pushed, or deployed. Later tasks remain
unauthorized until explicitly requested.

Final bookkeeping verified that only FE-006's Backlog checkbox changed, all 102
task IDs remain unique, dependency order/DAG and documentation links are valid,
and new tracked candidates are scoped test/config/documentation source files.

## Revalidation after freeing disk space — 2026-10-11

This is a new execution of the checks after the reported disk exhaustion. Previous
results above are retained as history. The filesystem reported 101 GiB available
before and after validation; none of these executions reported ENOSPC.

### Backlog acceptance audit

| Acceptance | Current evidence |
| --- | --- |
| FE-005 prerequisite | Complete in HEAD `770c3ed`; Backlog remains checked. Private route discovery and opt-in configuration are intact. |
| Repeatable browser execution | Runner owns its dev server; fixed locale/timezone/scenario, no retries or sleeps, fresh test contexts. All eight cases ran twice with two workers: 16 passed, zero failures/flaky/skipped. |
| Independent fixture | Test-scoped `reviewPage` and literal expectations import no application fixtures or randomized invoice hooks. Cookie/storage/API assertions pass. |
| Mobile and desktop | The same four scenarios pass at 390×844 (mobile/touch) and 1440×900 (desktop), twice each. |
| Meaningful navigation and RTL | Keyboard skip link, real home navigation and browser Back, no-JS navigation, `lang=fa`/RTL, isolated email/URLs, visible header links and overflow assertions all pass. |

### Commands actually rerun

All pnpm commands used Node 24.19.0 first in PATH and pnpm 11.25.0, from
`Frontend/`. Browser and build commands ran with the necessary host permissions.

| Command/check | Actual result |
| --- | --- |
| `pnpm install --frozen-lockfile --offline --store-dir /private/tmp/datano-fe-001-pnpm-store` | PASS, exit 0, already up to date; no manifest/lockfile change. |
| `pnpm store status --store-dir /private/tmp/datano-fe-001-pnpm-store` | FAIL, exit 1, reporting only `esbuild@0.27.7`; investigated below, not claimed as a clean store-status pass. |
| `pnpm test:e2e --list` | PASS, exit 0; eight cases across two files and two viewport projects. |
| `pnpm test:e2e:install` | FAIL, exit 1; repeated HTTP 403/location restriction from the official distribution, not a disk-write failure. |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --repeat-each=2 --workers=2` | PASS, exit 0; 16/16 in 12.7 s, zero retries, failures, flaky cases or skips. |
| `pnpm lint` | PASS, exit 0. |
| `pnpm exec tsc --noEmit --incremental false` | PASS, exit 0. |
| `UI_REVIEW_ENABLED=1 pnpm build` | PASS, exit 0; compiled, checked types, generated all eight static pages and finalized output; review route absent. |
| Production HTTP smoke, `/private/tmp/datano-fe-006-production-audit.cjs` | PASS, exit 0; newly built homepage 200 with Persian RTL/shared landmarks and no sample email; both plain and parameterized review URLs 404 even with runtime flag enabled. Temporary owned server stopped. |
| Dependency/source/report integrity and `git diff --check` | PASS; details below. |

### Installation and output integrity

- All 24 declared dependency/dev-dependency manifests are readable with matching
  package names/versions; recursive inspection found no broken `node_modules`
  symlinks. All 12 changed/untracked source files are present and nonempty. Frozen
  offline installation accepts the exact lockfile. No dependency was upgraded or
  reinstalled unnecessarily during this audit.
- The store-status warning was narrowed by decoding esbuild's local SQLite store
  index and comparing SHA-512 digests of each installed package file. The only
  difference is `bin/esbuild`: the published 9,350-byte JavaScript wrapper was
  replaced with the 10,385,234-byte native binary. The installed `install.js`
  explicitly performs this optimization with `linkSync`/`renameSync`.
  Both installed esbuild binary paths share the same inode; the native binary
  matches its SHA-512 content-addressed store object. All other esbuild package
  files match the package index. Its actual TypeScript transform also passes.
  This evidence explains the warning as the expected postinstall optimization;
  it does not indicate truncated installation or require a forced reinstall.
- The fresh HTML report's embedded ZIP passes its integrity check and contains
  `total=16`, `expected=16`, `unexpected=0`, `flaky=0`, `skipped=0`, `ok=true`.
  The regenerated `.last-run.json` reports `passed` with no failed tests. Results
  and production output were regenerated successfully, rather than relying on
  artifacts from the disk-exhausted run.
- Matching Playwright Chromium remains unavailable: the official installer still
  returns the location-restricted HTTP 403. The browser cache has no installed
  Chromium payload. Browser tests explicitly used installed Chrome; the default
  bundled Chromium run is still unvalidated. This is the remaining environment
  limitation, independent of free disk space.

No source/configuration correction was needed during revalidation. Only this
report was updated. FE-006 remains complete in the Backlog on the acceptance
evidence above, with the explicit Chromium-download limitation recorded. Only
FE-006's checkbox differs from HEAD; future task statuses are unchanged. Nothing
was staged, committed, pushed or deployed, and no later task was started.
