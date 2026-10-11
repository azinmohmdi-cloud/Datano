# FE-005 — private UI review and deterministic fixtures

Validation date: 2026-10-11. Authorized scope: FE-005 only.

## Dependency and implementation

FE-004 is complete in `b2fa37a`. The initial working tree was clean. Existing
Node 24.19.0, pnpm 11.25.0, and installed locked dependencies were sufficient.
No dependency upgrade, additional task, backend, or API generation was required.

- `app/ui-review/page.review.tsx` composes the concrete DevelopmentUIReview
  injector through Suspense and supplies noindex/nofollow metadata. Its server
  guard requires development mode and `UI_REVIEW_ENABLED=1`.
- `next.config.ts` enables the custom `review.tsx` extension only in Next's
  `PHASE_DEVELOPMENT_SERVER` with that server-only opt-in. The four normal page
  extensions remain supported. Production discovery omits the review page even
  with the flag enabled during build/start, excluding its fixture module graph
  from production client bundles. The phase/config/route-matcher behavior was
  checked against the installed Next 16.2.6 source and the resulting build.
- `components/feature/internal/UIReview/index.tsx` owns local UI props and pure
  presentation; `DevelopmentUIReview.tsx` owns URL selections/reset/focus;
  `fixtures.ts` owns fixed options, translations, and sample values. Only the
  private route imports the injector, and only that injector consumes fixtures.
- Existing ProductLayout and PublicLayout/AccountLayout/SiteLayout supply one
  shared header/main/footer. Existing Input/Field/Checkbox/Card/Table/status and
  Button primitives supply the catalogue. No additional component library is used.
- Scope, state, and sample persona are selected independently. Missing, invalid,
  or repeated values fall back to public/ready/guest. Selections replace query
  parameters without scrolling; reload reproduces the same fixed view.
- Loading is an explicitly selected state, not a random delay. Empty has no rows;
  error has an associated field error and an action that selects the ready fixture;
  ready has two stable rows. Scenario changes/reset remount the sample controls
  with their original values; reset also works at the default URL.
- Scope changes preserve selector focus after the shell remounts. Reset preserves
  focus on its button, and the disappearing error action moves focus to the preview.
- A persistent visible notice labels all information design-only. Sample personas
  are labels, never sessions/permissions. No login success, analytics, API call,
  cookie/storage write, query hook, timer, random data, or product-navigation entry
  was introduced. URL/email/identifier values retain their canonical LTR content.

README documents local opt-in, query options, fixture boundaries, reset, production
exclusion, and the development-only route-file convention. `.env.example` keeps
the opt-in disabled. No real environment file or engineering guide was edited.

## Required checks

From `Frontend/`, with Node 24.19.0 first in PATH:

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS, exit 0 |
| `pnpm exec tsc --noEmit --incremental false` | PASS, exit 0; private source is also typechecked |
| `UI_REVIEW_ENABLED=1 pnpm build` | PASS, exit 0; review route absent |
| `git diff --check` | PASS after removing an extra blank line in `.env.example` |

The final build retained `/`, both invoice examples, and existing local API
routes; no `/ui-review` route was generated. Dev/build used approved local
execution and access to the existing Google Fonts resources.

## Behavioral red/green and route isolation

The temporary `/private/tmp/datano-fe-005-check.cjs` uses bundled Playwright and
headless Chrome. It starts/stops Next development on port 3006 and production
on 3007. It adds no repository dependency, route fixture, or permanent test setup.

Invocation:

```sh
/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/datano-fe-005-check.cjs
```

Before implementation, the disabled route correctly returned 404, then the
opted-in development route failed the expected 200 assertion with 404. This was
a missing-behavior Red. A later focus assertion reproduced loss of selector focus
when changing scope, before the scoped focus restoration was added. Final Green
passed all of the following:

- Development with opt-in disabled: `/ui-review` returns 404. Enabled: 200,
  noindex metadata, public/ready/guest defaults.
- Public/account/site, all four states, and all three sample personas at
  **390, 768, and 1440px**, light/dark. One banner/footer, no horizontal page
  overflow, expected ready rows, disabled loading controls, and correct
  label/description/error association. The table scrolls inside its wrapper.
- Focus survives changing scope. Tab reaches the state selector. Checkbox Space
  toggles the sample control; Enter invokes reset and the error action; resulting
  focus targets and restored values are correct, including reset at the bare URL.
- Ready preview text is identical after reload. Invalid scope/state and repeated
  persona values fall back safely. Fresh browser contexts overriding Math.random
  to 0.1 and 0.9 produce the same two exact fixture rows.
- Switching sample personas and exercising controls causes no `/api/` requests
  or changes to cookies, localStorage, or sessionStorage. No uncaught page errors.
  Returning home shows no review markers or review navigation link.
- Production was built **and started with `UI_REVIEW_ENABLED=1`**. Direct route,
  selected-query route, trailing slash, source-like suffix, and RSC request all
  return 404 without fixture markers. `app-paths-manifest.json` contains no review
  route. Production static JavaScript contains none of the review title, fixture
  email, or fixed row-ID markers. Home and both existing invoice routes return 200
  without these markers.

Native selector option changes use Playwright's selectOption; focus/Tab are tested
with keyboard input. The macOS headless native picker did not commit values with
arrow/Enter in an isolated native-select probe; popup arrow-key selection is not
claimed as covered. Checkbox/button keyboard actions use real Space/Enter.

Screenshots: `/private/tmp/datano-fe-005-<scope>-<width>-<theme>.png`. Representative
public mobile light, account tablet dark, and site desktop dark captures were
visually inspected for readable Persian, RTL alignment, controls, spacing, table
overflow, and shared footer flow. Next/Query development-tool badges are existing
development UI; they are not fixture content or new product controls.

## Regression and scope limits

Both temporary regression harnesses passed against the final production build,
using the bundled Node executable above:

- `/private/tmp/datano-fe-002-check.cjs`: language/direction/metadata, real Persian
  font, LTR fields/code/selection, homepage and both invoice routes at
  390/768/1440px, deterministic controlled example results, light/dark.
- `/private/tmp/datano-fe-004-check.cjs`: actual homepage SSR/chrome/keyboard;
  public/account/site composition at 320/390/768/1440px; identical footer,
  short/long content, light/dark, 200% text, and navigation/skip link without JS.

The harnesses clean up their browsers and local servers. They depend on workstation
tools and are not a configured project runner. FE-006 infrastructure remains
pending. No production login/profile/site/admin/analytics UI or auth integration
is represented as complete. Existing English invoice mocks are unchanged; private
fixtures do not reuse their random data hooks. Dependencies/lockfile, global
fonts/providers, shared primitives/layouts, backend, and engineering guides remain
unchanged. No files were staged, committed, pushed, or deployed.

Backlog validation confirmed that only FE-005's checkbox changed, all 102 task
IDs are unique, dependencies exist and precede consumers without cycles, and
Backlog/README/report links resolve.
