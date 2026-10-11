# FE-003 — shared form and status primitives

Validation date: 2026-10-11. Scope: FE-003 only.

## Prerequisites and implementation

FE-002 is complete in `a50f7e8`; the initial working tree was clean. The existing
Node 24.19.0 / pnpm 11.25.0 environment and frozen installed dependencies were
used. No new prerequisite, dependency, or upgrade was needed.

- `components/ui/input.tsx`: styled Base UI Input with native attributes,
  controlled/uncontrolled values, refs, disabled/invalid/focus styles, and the
  existing document typography/direction rules.
- `components/ui/field.tsx`: Field, FieldLabel, FieldDescription, FieldError.
  Base UI owns generated IDs and label/message associations. External validation
  uses Field's `invalid` and conditionally rendered `FieldError match={true}`.
- `components/ui/checkbox.tsx`: Base UI checkbox with Lucide checked/mixed icons,
  visible keyboard focus, native form participation, and existing Field support.
- `components/ui/card.tsx`: composable card/header/title/description/content/footer.
  The title is an `h2`; content supports long unbroken text.
- `components/ui/status.tsx`: supplied title/description and optional action slots.
  Loading is a polite status with reduced-motion support; empty results remain
  distinct from failures; error messages are alerts. Recovery buttons are only
  supplied by consumers, using the existing Button and a real callback.

All components use shared `cn`, theme tokens, named exports, and the installed
Base UI/Lucide stack. Interactive primitives have focused client boundaries;
card/status presentation does not require its own client boundary. UI components
have no data-layer or domain dependencies. README records composition contracts.

## Static and production checks

Commands were run from `Frontend/`, with Node 24.19.0 first in PATH:

| Check | Result |
| --- | --- |
| `pnpm lint` | PASS, exit 0, no diagnostics |
| `pnpm exec tsc --noEmit --incremental false` | PASS, exit 0 |
| `pnpm build` | PASS, exit 0, all existing routes retained |

The final build includes the card wrapping correction. Lint/typecheck were run
again after that correction. Builds used approved execution with Google Fonts
access, as established in FE-001/FE-002; no font setup was changed.

## Focused behavioral checks

There is no configured project test runner. A temporary executable harness uses
the desktop runtime's Playwright/Chrome and the already-installed transitive
esbuild to bundle the actual primitives. It mounts a deterministic client fixture
into the browser DOM of the production homepage, retaining production CSS/fonts.
The fixture does not create an application route or modify application source.

Temporary files:

- `/private/tmp/datano-fe-003-fixture.tsx`
- `/private/tmp/datano-fe-003-check.cjs`

Invocation:

```sh
/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/datano-fe-003-check.cjs
```

The harness starts Next production on `127.0.0.1:3003`, waits for readiness,
launches headless Chrome, and closes the browser/server in `finally`.

The first meaningful red check failed with **“Visible field error is not linked
to its input via aria-describedby”**: a presentational error div did not register
its message with the field. Switching FieldError to Base UI's Error provided
the association. A later mobile overflow check caught unbroken serialized form
text stretching the card's grid content. CardContent's wrapping fixed that case.

The final run passed at **390, 768, and 1440 pixels**, in both light/dark themes:

- Accessible names, generated label/control IDs, explicit control IDs, label
  activation/focus, descriptions, and error linkage for Input and Checkbox.
- `aria-invalid` while errors are active; removal of resolved errors without
  dangling description IDs; restoration of errors.
- Controlled email updates, exact email/URL values, inherited LTR direction,
  native required input attributes, and input ref focus.
- Checkbox label activation and Space; controlled/uncontrolled/default checked
  and mixed states; disabled input/checkbox semantics and skipped tab stops;
  required checkbox native validity before/after selection.
- FormData containing updated input/checked values and excluding disabled fields.
- Tab order, focus-visible ring, and Button recovery callbacks via Enter/Space.
- Loading's status/live-region semantics, error alert semantics, ordinary empty
  results, and absence of an invented retry button when no action is supplied.
- Card heading semantics, long Persian/unbroken text without page overflow,
  reduced-motion spinner suppression, and no browser console/page errors.

Six screenshots are under `/private/tmp/datano-fe-003-<width>-<theme>.png`.
Mobile light, tablet dark, and desktop dark captures were visually inspected
for Persian shaping, RTL placement, controls, focus/error styles, and wrapping.
These are DOM/keyboard checks; no assistive-technology certification is claimed.

## Regression and boundaries

The existing `/private/tmp/datano-fe-002-check.cjs` was also rerun successfully:
SSR language/direction/metadata, all three existing pages at all three widths,
deterministic personal/admin invoice rows (2/5), email/URL/code isolation,
exact text selection, and real Vazirmatn Persian glyph rendering.

No permanent test runner, browser configuration, private review environment,
fixture route, product form, authentication, or layout shell was introduced.
FE-004/FE-005/FE-006 remain pending. Temporary scripts depend on this workstation's
bundled browser tools; repository-wide reproducible browser tooling remains
FE-006. Validation UI was browser-mounted, while production routes remain unchanged.
Consumers own business validation, translated messages, submission/recovery state,
and callbacks. Native browser validation strings are not automatically localized.

Backend tests/API generation were not applicable. Manifests, lockfile, backend,
engineering guides, and existing demo components are unchanged. No files were
staged, committed, pushed, or deployed.
