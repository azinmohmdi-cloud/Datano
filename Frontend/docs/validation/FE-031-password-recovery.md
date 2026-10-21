# FE-031 — password recovery connection

Date: 2026-10-21. Scope: FE-031 only. Initial Git status was clean. Dependencies
FE-012, FE-030 and BE-013 were checked against their implementations and checked
Backlog entries. No backend source/schema, approved form markup/CSS, public
signup gate, dependency or lockfile changed. No Git mutation was performed.

Final follow-up outcome (2026-10-21): all 484 browser tests passed in one complete
run, 678.3 s, with zero failures, skips or flaky results and no retries. The
pre-existing Dashboard assertion and two matching legacy assertions were fixed
only after the owner's explicit approvals. Initial failed/interrupted runs are
retained below as historical evidence, not presented as successful executions.

## Acceptance and implementation

| Criterion | Evidence / status |
| --- | --- |
| Three stages through actual API | Generated from the current FastAPI OpenAPI (17 paths), existing credentialed/CSRF transport; mobile and desktop real-PostgreSQL integration passed |
| Real email and owner-operated recovery | Verified: one request from the production build, Gmail relay accepted DATA; owner explicitly confirmed inbox delivery, password change and successful fresh login on 2026-10-21. Read-only database checks confirmed changed password, consumed code, no remaining grant and a fresh session |
| Expiry | 600-second local code deadline blocks verification, fresh request permitted; validated server grant lifetime expires to Email, clearing code/passwords; server 401 at Reset also restarts Email |
| Attempt limit | Five local rejected verifications block further submits; generic 401 covers invalid/expired/exhausted/consumed proof; server remains authoritative |
| Resend | 60-second local cooldown; successful acknowledgement clears stale code, resets local upper bound/timers; no automatic retry or delivery claim; 429 observes Retry-After |
| Return to Login | Footer works throughout; successful Reset cancels private reads, clears both caches, stores anonymous session and replaces route with Login; real API verifies both prior session types are revoked, old password denied, fresh login succeeds |

The injector owns real operations through `data/feature/recovery/`; the existing
controller owns presentation state and still accepts isolated private preview
fixtures. Pure UI, frame geometry, fields, focus order and responsive design are
reused. All stages stay mounted/inert as before. The real code is cleared on
verification, previous/restart and reset. Passwords are sent exactly as entered;
no trimming or new Unicode transformation is introduced by this task.

Public request responses deliberately hide account eligibility and actual
issuance/delivery. The time display is explicitly approximate and attempt count
an upper bound from this controller, never fabricated server state. Reload or
Back starts at Email, without reading query stage/identity or browser storage.
Reset requires the server grant; browser flags/timers do not authorize it. The
backend's existing SMTP failure semantics and in-process background dispatch are
unchanged. Request acknowledgement is not proof of inbox delivery.

Operations use plain promises, not React Query mutation variables. Codes,
passwords, verification envelope and CSRF token are not cached or persisted.
AbortSignal reaches the generated transport and obsolete replies cannot advance
an unmounted form. A synchronous ref blocks duplicate operations. Error text is
mapped to fixed Persian messages, never raw provider/HTTP response content.
Recoverable failure keeps inputs; consumed/expired grant clears secrets.

## Original FE-031 validation

Runtime: existing Node 24.19.0, pnpm 11.25.0, Playwright 1.62.1, installed Chrome;
no dependencies installed. Node's bundled bin directory was prepended to PATH.

| Check | Actual result |
| --- | --- |
| Red | New product three-stage browser test failed at Email → Code with the old disconnected form (11.2 s), after the initial sandbox server-bind failure was rerun with permission |
| Focused browser tests | 32 passed, 41.2 s, both viewports; new real-flow mocks and all eight prior recovery review tests per viewport |
| Recovery data/security tests | Final run: 6 passed, 625 ms: generated shapes, credentials/CSRF, exact passwords, cancellation, grant lifetime validation, safe errors, failed-reset cache preservation and late-read cancellation |
| Existing transport tests | 33 passed, 738 ms |
| Existing session data tests | 8 passed, 424 ms |
| Real API/PostgreSQL browser tests | 2 passed, 8.1 s; mobile/desktop; captured synthetic mail only, traces/screenshots/video off |
| Complete affected browser regression | 104 passed, 1.8 min: Login, Signup, Profile, Session, Recovery, product Recovery and UI Review in mobile/desktop |
| Unfiltered browser run | Not a pass: stopped after 85 passes, 1 Dashboard test failure, 1 interrupted test and 397 not run (484 collected); see below |
| `pnpm lint` | Final run passed, exit 0, no suppressions |
| `pnpm exec tsc --noEmit --incremental false` | Final run passed, exit 0 |
| `pnpm build` | Passed with network permission for the existing Google Fonts; compiled in 4.5 s, built-in TypeScript passed, 18 static outputs; no UI Review production routes |
| Bundle/source/log security | Final check after the owner's live flow: 924 files scanned against private SMTP, HMAC, CSRF and initial fixture secrets; no matches; no private review/email test markers in production JS |
| `git diff --check` | Passed; no staged files, backend source, CSS or lockfile changes |

The first new rejected-code test exposed a blur event clearing the server error;
valid blur now preserves an error until input changes. The initial real-API test
completed reset/revocation but timed out looking for a button named `ورود`; the
existing label is `ورود به حساب`. Only that selector was corrected, then both
full integration journeys passed. No retries, timeout increase or weakened
assertions concealed these failures. CLI NO_COLOR/FORCE_COLOR warnings remain.

The original unfiltered run reached a Dashboard expectation at
`dashboard-shell.spec.ts:126`; its assertion at line 139 required an empty request
list even after navigating to Login. That run was stopped and was never counted
as green. The initial diagnosis was source-based. The separately authorized
follow-up below now provides baseline evidence and a test-only correction.

The first sandboxed build could not fetch the existing Geist Mono/Vazirmatn fonts.
The identical build passed with network execution permission; fonts/design were
not changed. The validation build used only the public loopback test API origin
(`http://127.0.0.1:8021`), with no SMTP/test secrets in public variables. An import
created one untracked root log artifact; it was moved to the private temporary
validation directory and the audit runner now uses the Backend working directory.

## Isolated environment and live-mail record

Task-owned tmpfs PostgreSQL container: `datano-fe031-validation`, using the exact
preserved BE-003 image:
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
Separate `fe031_capture` and `fe031_live` schemas were migrated to head
`0007_password_recovery`. No existing database/volume was attached or modified.
Random database, initial test-account, HMAC and CSRF secrets live only in private
temporary files. SMTP configuration is read directly from the existing ignored
BE-011 file (0600); its values are never printed or copied into product config.
The live sender records only a static SMTP-acceptance marker, never message text
or code. Automated capture tests cannot access the live schema/mail sender.

Live request: production browser reached Code after the actual request API
acknowledgement. The observed SMTP adapter confirmed relay acceptance once, with
no retry/resend. The owner was handed the visible tab to enter the received code,
new password and fresh login personally. No screenshot or page-value inspection
is performed while those fields may contain the owner's secrets.

On 2026-10-21 the owner explicitly confirmed receipt, password change and fresh
login. The final read-only audit found a changed password hash (compared privately,
never printed), exactly one consumed code, zero remaining recovery grants and one
active session created after the password change. Both schemas returned `SELECT 1`
and revision `0007_password_recovery`. These checks read counts/booleans only;
neither the real code nor the new password was inspected, captured or requested.

All FE-031 acceptance criteria are verified; only its Backlog checkbox is now
checked. The capture backend was stopped after automation; the live backend and
production frontend were stopped after the owner's confirmation. The task-owned
auto-remove tmpfs PostgreSQL container was then stopped and removed, discarding
only its explicitly disposable test data. The protected PostgreSQL image and
existing volumes/networks were not removed. The original private BE-011 SMTP
file remains unchanged and ignored. Temporary harness/validation files remain
outside the repository under the private test directory; private settings retain
mode 0600. No further email was sent and no Git mutation was performed.

Backend test suites were not rerun because backend code/contracts did not change;
the real frontend integration exercised its current migrated implementation.
Production HTTPS/deployment configuration remains OPS scope; local tests use the
backend's explicit loopback HTTP cookie exception. No other task is completed.

## Changed files

- `components/feature/identity/RecoveryForm/DatanoRecovery.tsx`: product injector.
- `components/feature/identity/RecoveryForm/RecoveryFormController.tsx`: real stage/pending/deadline/error/cancellation behavior alongside the existing preview.
- `components/feature/identity/RecoveryForm/content.ts`: fixed Persian operational messages.
- `components/feature/identity/RecoveryForm/errors.ts`: safe error mapping.
- `data/feature/recovery/recovery.ts`: generated calls, grant-response validation and reset cache cleanup.
- `data/feature/recovery/useRecoveryActions.ts`: domain action hook.
- `tests/e2e/recovery.spec.ts`: existing disconnected-API regression now simulates unavailable CSRF explicitly.
- `tests/e2e/dashboard-shell.spec.ts`: owner-approved follow-up correction to the pre-existing Dashboard-to-Login network assertion; no product code/style changes.
- `tests/e2e/data-receipt.spec.ts`: separately approved correction to the same outdated expectation in its public guest scenario.
- `tests/e2e/google-connections.spec.ts`: separately approved correction to the same outdated expectation in its public guest scenario.
- `tests/e2e/recovery-product.spec.ts`: eight product browser scenarios.
- `tests/recovery/recovery.spec.ts`: six data/security tests.
- `tests/recovery/product.browser.spec.ts`: real API/PostgreSQL synthetic-mail journey.
- `playwright.recovery.config.ts`: unit runner.
- `playwright.recovery.integration.config.ts`: integration runner with recording off.
- `package.json`: recovery test commands only.
- `README.md`: behavior, prerequisites and reproduction commands.
- `docs/validation/FE-031-password-recovery.md`: this evidence and limitation record.
- `../docs/backlog.md`: only the FE-031 completion checkbox.

Current Git state: ten modified tracked files, nine untracked task files, no
staged changes. The generated client and private environment remain ignored.
The original incomplete broad test run above remains recorded as a historical
failure, independently of the follow-up results below.

## Dashboard test follow-up — 2026-10-21

The owner requested a diagnosis before any Git action, required explicit approval
for corrections outside FE-031, and then approved changing only the identified
Dashboard test plus rerunning validation. After the full run exposed two matching
legacy tests, the owner separately approved only those two public scenarios in
`data-receipt.spec.ts` and `google-connections.spec.ts`. No Dashboard/Login implementation,
approved UI, API contract, package/lockfile or Playwright configuration was
changed by this follow-up. Existing FE-031 working changes were preserved.

### Exact failure and baseline

Test: `the public dashboard uses the site shell and exposes no sample data,
controls or auth effects`, originally `tests/e2e/dashboard-shell.spec.ts:126`.
The failure was the `expect(requests).toEqual([])` assertion at line 139.
The recorded list contained two `/api/auth/me` requests after clicking the link
to `/login`. The Dashboard is effect-free, but Login deliberately resolves the
server session before rendering a form or choosing a role-based destination.
The old assertion incorrectly extended Dashboard's no-auth-effects requirement
to the destination Login page. Development remount/cancellation can cause more
than one session request; an exact count is not the behavioral contract.

The original historical failure artifacts had been overwritten by the later
104-pass identity run. Fresh JSON, traces and error contexts were therefore
recorded separately under `/private/tmp/datano-dashboard-audit/`.

| Reproduction | Result |
| --- | --- |
| Current FE-031 working tree, five repeats in each viewport | 10 failed, 23.8 s; all at the same assertion with the same two session-check URLs |
| Read-only `HEAD` baseline `70667b5` before uncommitted FE-031 changes, five repeats in each viewport | 10 failed, 24.4 s; same assertion and session-check URLs |
| Corrected test, five repeats in each viewport | 10 passed, 25.1 s; no retries, skips or flaky results |

Baseline was extracted with read-only `git archive HEAD Frontend` into a temporary
directory. Installed dependency files were reused, and the current generated
client (from the same committed BE-013 OpenAPI) was copied. No private env file
was copied. No checkout, branch switch, staging or commit occurred. The first
baseline launch stopped before testing because pnpm's copied-workspace dependency
check wanted a noninteractive reinstall; the subsequent baseline run disabled
that automatic check only via its temporary runner environment, using the same
installed versions. No dependency installation or product configuration change
was performed.

The baseline still renders the disconnected pre-FE-031 recovery injector.
Dashboard test history last points to `c5cb895` (FE-019–FE-023), while Login's
session integration was introduced by `70dfcd4` (FE-030). These paths, the session
data layer and Playwright config have no FE-031 diff. The matching 20 failures
establish that this failure predates FE-031; no flaky behavior was observed in
these samples. This does not claim that every test in the repository is stable.

### Minimal approved correction

The test retains all no-sample-data, shell, no-cookie, no-storage and page-error
assertions. It now asserts zero auth requests **before leaving Dashboard**,
provides a controlled anonymous 401 for `/api/auth/me`, waits for that response
and the actual Login email field, then permits only `GET /api/auth/me` requests.
Unexpected endpoints and modifying requests still fail. It does not disable
session detection, broaden an application allowlist or merely remove the failing
assertion. No screenshot/layout/style changes are involved.

### Follow-up validation

| Check | Actual result |
| --- | --- |
| Targeted repeated Red/Green | 20 matching Red failures across baseline/current; 10 Green passes after correction |
| Additional public receipt/source scenarios | 12 baseline failures; 12 passes after their separately approved corrections, 24.8 s |
| `pnpm test:recovery` | 6 passed, 682 ms |
| `pnpm test:session` | 8 passed, 686 ms |
| `pnpm test:transport` | 33 passed, 982 ms |
| `pnpm lint` | Passed, exit 0 |
| `pnpm exec tsc --noEmit --incremental false` | Passed, exit 0 |
| Full browser suite after Dashboard-only fix | 480 passed, 4 failed, 638.8 s; no skips or flaky results; all four failures were the two additional legacy tests in both viewports |
| Full browser suite after all three approved test corrections | 484 passed, 678.3 s, exit 0; zero failures/skips/flaky results, no retries; includes all related Dashboard, receipt, sources and identity scenarios |
| Final scoped diff / Git audit | Passed `git diff --check`; this follow-up changes only the three approved test scenarios and this report; no staged files or Git mutations |

Commands used the installed Node 24.19.0, pnpm and Chrome. Targeted tests used
`PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e dashboard-shell.spec.ts --grep 'the public dashboard' --repeat-each=5`.
The full run uses `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e --global-timeout=1200000`
with isolated diagnostic output. Only the total budget for all 484 tests changes
from five to twenty minutes; individual test/expect timeouts (30 s/10 s), one
worker and zero retries remain unchanged. The full suite includes all Dashboard,
Login, Session and Recovery regressions. No actual SMTP/email, backend source or
database was used/changed during this test-only follow-up. Build and live-email
checks above remain the earlier FE-031 evidence; they are not rerun for a test-only
change.

### Two matching legacy assertions discovered by the full run

The first complete run finished rather than being stopped at the initial failure.
It exposed only these additional failures:

| Test | Original failing assertion | Baseline evidence |
| --- | --- | --- |
| `data-receipt.spec.ts:150`, public receipt guest-only scenario | Line 163 expected `requests=[]` after visiting Login | All 6 repeats failed on `HEAD` (3 per viewport), with the same two `/api/auth/me` URLs |
| `google-connections.spec.ts:136`, public source-management guest scenario | Line 151 expected `requests=[]` after visiting Login | All 6 repeats failed on `HEAD` (3 per viewport), with the same two `/api/auth/me` URLs |

Combined baseline: 12 failed, 25.8 s, no retries/skips/flaky results. Baseline JSON
is `/private/tmp/datano-dashboard-audit/related-baseline.json`; first complete
run JSON is `full.json` in that directory. These tests had no FE-031 changes.
Their correction was prepared as a review-only patch and was applied only after
the owner's second explicit approval. As with Dashboard, they retain the public
page's no-effects/sample-data/cookie/storage checks, then use a controlled
anonymous session response and require the real Login form to appear. No other
test scenarios or product files were changed.

The two additional corrected tests then passed all 12 repeats (3 per viewport per
scenario), 24.8 s, with no skips/retries/flaky results. Final lint and direct
TypeScript checks also passed after these last edits. The final complete run
finished with 484 passes, zero failures/skips/flaky results, exit 0, in 678.3 s.
Its JSON evidence is `/private/tmp/datano-dashboard-audit/final.json`; diagnostic
output is kept outside Git. The first complete run's four failures remain
recorded as failures, not retrospectively reported as a pass.

The original Dashboard concern and both separately approved matching legacy
failures are resolved. FE-031 remains checked; this follow-up makes no further
Backlog changes and starts no other task. No source/style/API changes, live-email
send, stage, commit, push or branch change occurred. Existing FE-031 work is
preserved. No known failing test remains in the executed frontend suites.
