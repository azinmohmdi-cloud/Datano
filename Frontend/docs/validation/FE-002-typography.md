# FE-002 — Persian document and typography

Recorded on 2026-10-11. Prerequisite **FE-001** was checked complete and present
in commit `d0d5741`; the working tree was clean before this task.

## Changes

- The root document now declares `lang="fa"` and `dir="rtl"`.
- `next/font/google` loads Vazirmatn once at the root, with Arabic and Latin
  subsets, variable weight support, and `display: "swap"`. Inter and Geist Sans
  were removed from that setup. Geist Mono remains the technical-code font.
- Global `font-sans` and `font-heading` tokens both resolve to
  `--font-vazirmatn`, eliminating the previous self-referencing sans token.
- Root metadata now uses the title `دیتانو`, the page-title template
  `%s | دیتانو`, and a Persian product description. It makes no claims about
  delivered integrations, customer counts, or analytics results.
- Global base styles apply LTR direction, bidi isolation, and logical start
  alignment to email/URL inputs and `code`, `kbd`, `samp`, and `pre` when they
  have no explicit `dir`. Explicit LTR elements are isolated within RTL prose.
- The README documents `<bdi dir="ltr">` for displayed email addresses, URLs,
  and identifiers, and `dir="auto"` for unknown-direction user text.

Canonical text values are not normalized, translated, or modified by these
styles. Existing English demos keep their content. No product forms, layout
shells, routes, fixture environment, API changes, or dependencies were added.

## Validation

All project commands ran from `Frontend/` using Node 24.19.0 and pnpm 11.25.0.
The already available compatible runtime was selected with:

```sh
export PATH="/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

| Command/check | Result |
| --- | --- |
| `pnpm lint` | Passed; no errors or warnings |
| `pnpm exec tsc --noEmit --incremental false` | Passed, including after the build |
| `pnpm build` | Passed with Next.js 16.2.6 and approved Google Fonts access |
| `node /private/tmp/datano-fe-002-check.cjs` | Passed all focused browser acceptance checks |
| `git diff --check` | Passed |

### Focused acceptance: Red and Green

A temporary script started the existing production build on `127.0.0.1:3002`
and asserted Persian root language/direction and non-starter metadata. Before
implementation, it failed for the expected missing behavior:
`root language must be Persian` (the document still used `lang="en"`).
After rebuilding, the script passed, then passed again with additional mixed-URL
and explicit-direction checks. This is a focused acceptance Red/Green result;
it does not establish a repository-wide test runner or the FE-006 infrastructure.

The script used preinstalled Playwright and headless Chrome, with isolated
browser contexts at **390×900**, **768×900**, and **1440×900**. It checked:

- SSR root attributes and absence of the starter title/description.
- `/`, `/examples/me/invoices`, and `/examples/admin/invoices` at every width:
  Persian language, inherited RTL, Vazirmatn font family, and Persian metadata.
- Invoice demo success with controlled randomness: two personal rows and five
  admin rows, without changing the hooks or demo data in this task.
- Email/URL inputs, `code`, `kbd`, `samp`, `pre`, and isolated `bdi` samples for
  email, URL, and identifier values within Persian prose.
- LTR direction and bidi isolation, unchanged input values, exact DOM text
  selection, and left-to-right visual character positions for displayed values,
  including mixed URL punctuation and wrapped surrounding Persian prose.
- Vazirmatn inheritance in email/URL controls and actual custom-font glyph
  rendering for Persian text through Chrome's platform-font inspection; the
  Persian sample used Vazirmatn without a fallback font.
- Explicit RTL overrides on code/input and automatic direction on user text.
- No uncaught browser errors.

Light/dark screenshots were captured for all three widths. Representative
mobile light, tablet dark, and desktop light screenshots were visually inspected
for Persian shaping, punctuation, mixed directions, and text wrapping. Switching
the existing `.dark` class in a test does not add a product theme switcher.

The test-only samples were appended inside the browser DOM and never became
application routes or source fixtures. The script and screenshots remain under
`/private/tmp`. Its production server was stopped after each run. No browser
test configuration or dependency was installed in the project.

## Boundaries and remaining requirements

Uncached font compilation still requires Google Fonts access. Product consumers
must mark displayed email/URL/identifier text with `bdi` or explicit direction as
documented; CSS does not detect or rewrite arbitrary text. Forms and shared
layout shells remain **FE-003** and **FE-004**. The private UI review environment
and repeatable project browser infrastructure remain **FE-005** and **FE-006**.
No backend tests or API generation were run because their code/contracts were
unaffected. Dependencies, lockfile, specialized guides, and backend are unchanged.
No files were staged, committed, pushed, or deployed by this task.
