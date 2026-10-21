# BE-011 — outbound email adapter; verified real SMTP delivery

Implementation date: 2026-10-19. Final validation: 2026-10-21.
Dependency FE-030 is checked and its current integration record
was inspected. Initial Git status was clean. All changes are limited to backend
mail infrastructure, its tests and documentation; no frontend, API route,
database schema, lockfile or Git state mutation is included.

## Status and acceptance

**BE-011 is complete.** One authorized Gmail submission succeeded, the owner
confirmed Inbox receipt and correct message rendering, and the final regression
and security checks passed. No second real message was sent during finalization.
Only BE-011's checkbox is changed; later email workflows remain unstarted.

At the initial implementation stage, the owner stated that private SMTP
settings and an approved recipient are not available, authorized completing the
independent implementation/tests, and prohibited selecting/activating an external
service or claiming real delivery. At that stage no external mail service was selected,
configured, contacted or activated. No `Backend/.env` or real SMTP configuration
was created. `.env.example` contains a disabled flag, transport defaults and
empty commented private fields only. The subsequent owner-approved Gmail
preparation and completed real-delivery verification are recorded below.

| Acceptance | Evidence / status |
| --- | --- |
| Private SMTP adapter/configuration | Verified; owner-provided App Password is loaded internally from the ignored mode-`0600` file. Credentials use `SecretStr`, private fields are hidden from repr, and enabled configuration is validated at startup. |
| Controlled real send | Verified; exactly one approved Gmail STARTTLS submission returned exit code `0` with relay acceptance; the owner separately confirmed Inbox receipt and correct rendering. |
| Distinguishable failure | Typed safe failure reason, retryability and unknown-delivery flags; configuration, TLS, AUTH, envelope/DATA refusal, timeout/network and protocol cases tested |
| No credential/code in public output or logs | HTTP-boundary, exception-context, CLI, config repr/JSON, caplog and loopback tests; application log/OpenAPI audit passed |

## Changed files and behavior

- [Application mail port](../../app/application/use_cases/auth/email.py):
  `IEmailSender`, frozen `OutboundEmail` with hidden content in repr, safe
  `EmailFailure` / `EmailDeliveryError`; no framework/SMTP dependency in the port.
- [SMTP adapter](../../app/infra/services/smtp_email_service.py): verified
  STARTTLS or implicit TLS, TLS 1.2 minimum, AUTH only after TLS, explicit envelope,
  Unicode MIME with quoted-printable transfer, UTC Date and sender-domain Message-ID,
  one recipient, header-injection rejection and worker-thread socket I/O.
- [Config](../../app/infra/core/config.py): disabled-by-default SMTP settings,
  secret fields, bounded port/socket timeout and hidden validation input values.
  `hide_input_in_errors` also keeps configuration diagnostics from echoing a
  sensitive value accidentally supplied to the wrong field.
- [Application lifespan](../../app/main.py) and
  [dependency](../../app/interface/dependencies/email_dependencies.py): enabled
  configuration fails before DB access when invalid; startup performs no SMTP
  connection/send. Disabled mail is unavailable explicitly, never a fake success.
- [Private smoke CLI](../../scripts/send_test_email.py): offline validation by
  default; one harmless message only with an explicit recipient and `--send`;
  safe exit/status output. SMTP DATA acceptance is not claimed as inbox receipt.
- [Environment template](../../.env.example) and [README](../../README.md):
  setup fields, boundaries, commands and the pending real-service handoff.
- Tests:
  [configuration](../../tests/unit/test_smtp_config.py),
  [adapter](../../tests/unit/test_smtp_email.py),
  [dependency/CLI](../../tests/unit/test_email_dependencies_and_smoke.py),
  [startup/public error boundary](../../tests/integration/test_email_boundary.py),
  [loopback SMTP/TLS](../../tests/integration/test_smtp_wire.py).

No retry is performed automatically. A timeout/disconnect while sending may have
an unknown delivery result; it is marked non-retryable for automatic callers.
QUIT/socket-close errors after accepted DATA do not cause duplicate sends.
Upstream exception text, response, recipient and message are absent from the
raised error, including its exception cause/context. There is no SMTP debug mode
or public send/check endpoint.

## TDD and independent validation

Runtime: Python 3.12.14, PDM 2.29.2, existing locked dependencies. No package was
installed. Production transport uses only standard-library SMTP/TLS/MIME. The
wire fixture generates temporary certificates using the already-locked
`cryptography` 46.0.3 dependency; it is not an external email service.

Red evidence:

1. Two config tests failed because existing Config did not accept SMTP fields
   and exposed supplied values in validation text. New fields/redaction made
   these pass.
2. Two authenticated-TLS delivery tests exercised the port scaffold and failed
   with `NotImplementedError`; transport behavior then made them pass. There was
   no missing dependency/import fixture failure counted as behavioral Red.
3. The failed-cleanup test reproduced raw `OSError` escaping after accepted
   DATA. Cleanup was corrected without turning an accepted message into retry.
4. Enabled incomplete SMTP initially reached database construction. The startup
   test failed its DB-access sentinel, then passed after lifespan validation.
5. Standard-header tests failed on missing Date/Message-ID, then passed after
   those headers were supplied.

The first loopback run could not bind sockets in the sandbox and was rerun with
local execution permission. A later wire-fixture error treated SMTP command names
case-sensitively; the fixture was corrected, not the production TLS policy. All
five loopback cases then passed. No verification/hostname checks were disabled,
and no retries, skips or warning suppressions were added to pass the tests.

Executed results:

| Command / check | Actual result |
| --- | --- |
| `pdm run python --version`; `pdm lock --check` | Python 3.12.14; locked environment check passed |
| Focused config/adapter/dependency/HTTP tests | Final focused run: 54 passed in 0.76 s |
| `pdm run pytest tests/integration/test_smtp_wire.py -q` | 5 passed in 3.65 s; real local STARTTLS/implicit TLS, Persian DATA and negative certificate/AUTH/STARTTLS cases |
| Full suite with scoped mail coverage | **535 passed in 83.63 s**; 59 new email tests plus 476 existing tests, including PostgreSQL migrations/constraints/session regressions |
| Scoped coverage | **189/192 statements, 98.44%** overall; SMTP adapter 118/119, 99.16%; dependency 100%; CLI 97%; port 96% |
| `pdm run python -m compileall -q app scripts/send_test_email.py` | Passed |
| `pdm run python -m scripts.send_test_email --help` | Passed; command entry point available; no network/send |
| OpenAPI/log inspection | 14 existing paths; no SMTP secret schema field or send/debug route; 243 application log files checked, zero SMTP fixture credential/code hits |
| Real DB + lifespan health check | PostgreSQL 17.11, `SELECT 1`, existing revision `0005_opaque_sessions`; disabled/enabled test configurations started, pinged and cleaned up; SMTP client constructors were mocked and never called at startup |
| `git diff --check` | Passed; no Frontend/Backlog/lockfile/Git-staged changes |

The full-suite command was run from `Backend/` through the existing PDM binary
with `DATANO_TEST_DATABASE_URL` supplied privately by a wrapper outside the repo:

```sh
pdm run pytest --cov=app.application.use_cases.auth.email \
  --cov=app.infra.services.smtp_email_service \
  --cov=app.interface.dependencies.email_dependencies \
  --cov=scripts.send_test_email --cov-report=term-missing
```

Uncovered lines are the abstract port's `NotImplementedError`, a defensive empty
mailbox guard behind the standard parser, and the CLI's `__main__` guard (the
actual command was separately exercised). No coverage threshold was invented.
The repository has no full backend lint/type-check tool; compileall is a syntax
check, not a claim that such tooling exists. Frontend checks were unnecessary
because the frontend and public HTTP contract were unchanged.

PostgreSQL used a task-owned tmpfs container and a new `datano_test_be011`
database. The exact BE-003 image was reused:
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
No pre-existing volume was mounted or modified. The six existing volumes and
the protected image are retained; only the task-owned disposable container is
stopped after testing. No global cleanup is used.

## Private provisioning checklist (fulfilled for the controlled send)

For another environment, the owner must supply the following through a private
ignored file or secure local environment. These requirements were fulfilled for
the controlled Gmail verification below:

1. SMTP hostname, actual port and required mode (`starttls` or implicit `tls`).
2. Private SMTP AUTH username and password/app password/provider SMTP credential;
   this adapter supports username/password AUTH, not OAuth-only authentication.
3. The sender mailbox authorized by that provider; any provider-required sender
   or domain verification must already be satisfied.
4. One explicitly approved test recipient and a way for its owner to confirm
   receipt; no recipient is inferred from the sender/username.
5. A trusted CA bundle only if the server uses a private CA. Optional timeout can
   retain the technical default.

Set `SMTP_ENABLED=true` intentionally with these valid private values. Do not put
the password in chat, committed files, command arguments or `NEXT_PUBLIC_*`.
After offline validation, run the documented one-message CLI against the approved
recipient. Record the safe relay result, then independently confirm inbox receipt.
On failure, record only the safe classification/unknown-delivery state; do not
publish provider responses or repeat an ambiguous send blindly. Only with this
evidence can the remaining acceptance criterion and BE-011 checkbox be completed.

BE-012/013/014/016 code challenges, recovery, admin email proof and email changes
were not started. No SMTP credentials or send result have been fabricated.

## Owner-approved Gmail preparation — 2026-10-19

The owner subsequently approved `smtp.gmail.com:587` with STARTTLS, a specific
Gmail sender/AUTH account and the same explicitly authorized test recipient.
Their personal mailbox is stored only in the ignored local configuration, not
this versioned record. No App Password was requested in chat or generated.

`Backend/.env.be011.local` was created with mode `0600`, approved non-secret
parameters and an empty `SMTP_PASSWORD=` line for the owner to fill privately.
The existing `Backend/.gitignore` rule `.env.*.local` was verified with
`git check-ignore`; the file is not tracked. An existing file would be preserved
rather than overwritten. No program source or test fixture was changed for this
preparation, and no tests were rerun solely for documentation/private-file setup.

The existing CLI reads the absolute path using `--env-file`, and constructs
`Config(_env_file=...)`; the App Password never needs a command-line argument or
public variable. Pydantic process environment precedence must be checked without
printing values before sending. Offline validation has no SMTP I/O; `--send`
and the approved `--to` will be used only after the owner's next confirmation.
This dedicated file does not become the serving app's default `.env`.

Gates at this historical preparation stage: App Password entry **pending**, explicit approval to send
**pending**, real relay acceptance **unverified**, recipient confirmation
**unverified**. After successful relay submission, wait for the owner's inbox
confirmation, then finalize regression/security checks and only mark BE-011
complete if every criterion is verified. Backlog remained unchanged at that stage.

## Final real-delivery and acceptance verification — 2026-10-21

The owner confirmed privately entering the App Password and explicitly authorized
exactly one message to the previously approved mailbox. Offline preflight passed:
the settings matched the approved Gmail host, STARTTLS mode, port, AUTH account
and sender; the password was nonempty, the file was regular with mode `0600`,
and no inherited `SMTP_*` environment variables overrode the private file.
No password, personal mailbox, raw provider response or message body is recorded here.

The existing `python -m scripts.send_test_email` CLI was invoked once through
PDM with `--env-file`, the approved `--to`, and explicit `--send`. It returned
exit code `0` and the safe status:

```text
SMTP relay accepted one test message; inbox receipt must be confirmed separately
```

This establishes successful SMTP connection, verified STARTTLS, authentication
and message acceptance through the adapter's success path. No raw Gmail response
code or queue identifier was captured or inferred. The owner subsequently
confirmed the message titled «آزمایش تنظیمات ایمیل دیتانو» arrived in **Inbox**
from the approved account to that same approved account and its text rendered
correctly. Inbox receipt is owner-confirmed evidence, separate from relay acceptance.
No resend was performed during the final checks.

Final checks, run again after receipt confirmation:

| Command / check | Actual result |
| --- | --- |
| `pdm run pytest tests/unit/test_smtp_config.py tests/unit/test_smtp_email.py tests/unit/test_email_dependencies_and_smoke.py tests/integration/test_email_boundary.py -q` | **54 passed in 0.86 s** |
| Full suite with the scoped coverage command above | **535 passed in 83.73 s**; 59 mail tests, including all 5 real loopback TLS cases; 0 failed, 0 errors, 0 skipped |
| Scoped coverage | **189/192 statements, 98.44%**; adapter 118/119, dependency 7/7, CLI 38/39, port 26/27; same three explained defensive/entry-point gaps as above |
| `pdm lock --check`; `pdm run python -m compileall -q app scripts/send_test_email.py` | Passed; no dependency or lockfile changes |
| Real PostgreSQL / startup / migration health | PostgreSQL **17.11**, `SELECT 1`, upgrade to existing **`0005_opaque_sessions`**; SMTP-disabled and SMTP-enabled synthetic configurations both started, returned ping `200`, and cleaned up database/sender state; both SMTP constructors were patched and never called |
| OpenAPI / public boundary | **14 existing paths**, no public SMTP/send/debug route or SMTP credential schema; HTTP failure tests again proved safe generic responses without provider credential/code |
| Private-file and secret audit | File remains ignored, untracked, regular and mode **`0600`**; **224** Backend/docs files, **254** application log files (including ZIP contents when present), and **4** validation artifacts scanned; **0** actual App Password/raw or checked encoded-form hits; **0** SMTP fixture password/code hits in application logs |
| Diff / scope | `git diff --check` passed; only BE-011 backend files and its Backlog checkbox are changed; no Frontend, other-task, dependency or staged changes |

TLS trust/hostname checks, rejection of plaintext fallback and header injection,
AUTH/provider refusal handling, safe exception context, unknown-delivery handling,
and absence of automatic retries passed again. The audit reads the private
password only in memory for comparison and emits booleans/counts, never its value.
The current application has no product verification-code endpoint; later code
generation/recovery flows remain outside BE-011.

The private test wrapper and artifacts reside outside the repository in
`/private/tmp/datano-be011-final-20261021/` (`run-tests.py`, `tests.xml`,
`coverage.json`, `health.json`, `security.json`). Test credentials were supplied
internally, never in command arguments or this record. The task-owned
`datano-be011-final-20261021` container used the exact protected BE-003 PostgreSQL
digest above, a fresh `datano_test_be011` database and tmpfs storage. It was
stopped/automatically removed after validation. No pre-existing volume was
mounted; all six existing volumes and the protected image remain intact.

Finalization changes only this report, the current SMTP status in README, and
the BE-011 checkbox in `docs/backlog.md`. Previously correct implementation and
tests are preserved. No new behavior or additional TDD cycle was required for
these documentation/status changes; the original Red–Green evidence remains above.
No Stage, Commit, Push or branch change was performed. No BE-011 acceptance
criterion remains unverified. This controlled delivery does not certify delivery
to every provider or deploy the later email workflows; the private CLI file is
still separate from the serving application's default configuration.

Official Gmail setup references:
[Gmail SMTP settings](https://support.google.com/mail/answer/7104828) and
[Google App Passwords](https://support.google.com/accounts/answer/185833).

Protocol references used during implementation:
[Python 3.12 smtplib](https://docs.python.org/3.12/library/smtplib.html),
[EmailMessage](https://docs.python.org/3.12/library/email.message.html), and
[verified SSL contexts](https://docs.python.org/3.12/library/ssl.html#ssl.create_default_context).
