# BE-012 — shared single-use email codes

Date: 2026-10-21. Dependencies BE-011 and BE-007 are checked and their existing
adapter/session implementation was inspected. Initial Git status was clean.
BE-012 is complete; only its Backlog checkbox is updated. No frontend, public
endpoint, recovery/account flow, package, lockfile, private configuration or
Git index/branch change is included.

## Acceptance evidence

| Requirement | Verified behavior |
| --- | --- |
| Random eight-digit code | `secrets.randbelow(100_000_000)` with zero padding; deterministic tests cover `00000000`, leading zeroes and `99999999` |
| HMAC with a private key | HMAC-SHA256 with versioned, unambiguous framing and purpose/account/canonical-recipient binding; known-vector, key-separation and cross-context tests; independent private `EMAIL_CODE_HMAC_KEY` has no fallback |
| Single use | PostgreSQL row locking and committed `consumed_at`; ten parallel valid consumes have exactly one winner; replay is rejected |
| Expiry | Fixed ten minutes from reservation, never extended by delivery/verification; valid just before 600 seconds, invalid exactly at/after expiry; clock rollback and expiry while waiting for a lock are rejected |
| Limited attempts | Five total attempts per code, including malformed/Unicode/non-eight-digit input; correct fifth attempt may succeed, five wrong attempts exhaust it; twelve parallel wrong guesses cannot exceed five |
| Resend interval / invalidation | At least 60 seconds, including consumed/exhausted/pending scopes; exact boundary tested; old digest replaced before SMTP, attempts reset, duplicate RNG sample regenerated; concurrent initial/resend requests send once per window |
| Delivery/privacy | Pending codes cannot verify. SMTP failure/unknown delivery/cancellation leaves them unusable and keeps cooldown. Late activation requires the same current generation and an unexpired challenge. Issue returns no code; code is handed only to the existing mail port, not persistence/log/public response |

The context is a trusted server-side purpose, stable account subject and intended
recipient. Recipient identity follows existing strip/lowercase rules; dots and
plus tags remain significant. The technical table contains only keyed scope/code
digests, a generation identifier and lifecycle metadata, with one row per scope.
No plaintext code, email, account identifier or HMAC key is stored in it.
Verification uses `hmac.compare_digest`. A key of at least 32 private bytes must
be provisioned independently of SMTP, CSRF and JWT secrets before a caller uses
the service. No production key or new private settings file was generated here.

Repository operations own short independent transactions: a later account/HTTP
rollback cannot erase a guess or cooldown. An advisory transaction lock covers
the first issuance when no row exists; row locks serialize later operations.
The production database wall clock is sampled after locking. No transaction or
lock remains held during SMTP I/O, and no automatic mail retry is introduced.
The test sender is an in-process capture double; no real email was sent in BE-012.
The real SMTP adapter and the owner's Inbox evidence remain those of BE-011.

## Changed files

- [Application context, policy, ports and orchestration](../../app/application/use_cases/auth/email_codes.py)
- [Repository contract](../../app/interface/repository/email_code_repository_interface.py)
- [HMAC and secure generation](../../app/infra/services/email_code_crypto.py)
- [PostgreSQL repository](../../app/infra/repositories/postgres/email_code_repository.py)
- [Dependency wiring](../../app/interface/dependencies/email_code_dependencies.py)
- [Private-key settings](../../app/infra/core/config.py) and [environment template](../../.env.example)
- [ORM table](../../app/infra/database/models.py) and [migration 0006](../../migrations/versions/0006_email_codes.py)
- [Unit behavior tests](../../tests/unit/test_email_codes.py), [configuration/dependency tests](../../tests/unit/test_email_code_dependencies.py), [real PostgreSQL tests](../../tests/integration/test_email_codes.py)
- [Existing session migration regression](../../tests/integration/test_sessions.py): explicitly targets revision 0005 rather than assuming it remains head; original data-preservation assertions retained
- [README](../../README.md), this report and [BE-012 checkbox](../../../docs/backlog.md)

## TDD / regression evidence

1. Three initial unit tests failed with behavioral `NotImplementedError` for
   secure generation, keyed digest and consumption. Implementing them made all
   three pass; no missing-import failure was counted as Red.
2. Two real PostgreSQL tests failed because the repository's reserve operation
   was unimplemented and the challenge table did not exist. The repository and
   migration made all five combined tests pass (0.70 s).
3. Three configuration/dependency tests failed on the absent supported setting
   and unimplemented dependency. The private setting and explicit wiring made
   them pass. Expanded acceptance tests then passed: 71 in 3.94 s.
4. The old session migration test failed because it upgraded to moving `head`
   but asserted 0005. It now pins its characterized revision explicitly. ORM
   comparison already passed and continues to pass. No assertion was weakened.
5. The first complete suite passed: 612 tests in 75.84 s. Review then added a
   regression for an unpaired Unicode surrogate in the context subject; it
   failed with `DID NOT RAISE` and passed after generic UTF-8 context validation.
   Generator endpoint cases and populated migration-preservation checks were
   strengthened. The final complete suite below passed after these final edits.

## Final executed validation

Python 3.12.14, existing PDM environment and lockfile; no dependencies installed.
Commands ran from `Backend/` through `.tools/pdm/bin/pdm`. A private wrapper at
`/private/tmp/datano-be012/run-tests.py` supplied `DATANO_TEST_DATABASE_URL`
internally; connection credentials were never command arguments or report text.

```sh
pdm run pytest tests/unit/test_email_codes.py tests/unit/test_email_code_dependencies.py -q
pdm run pytest --cov=app.application.use_cases.auth.email_codes \
  --cov=app.infra.services.email_code_crypto \
  --cov=app.infra.repositories.postgres.email_code_repository \
  --cov=app.interface.dependencies.email_code_dependencies \
  --cov-report=term-missing
pdm lock --check
pdm run python -m compileall -q app migrations tests/unit/test_email_codes.py \
  tests/unit/test_email_code_dependencies.py tests/integration/test_email_codes.py
git diff --check
```

| Check | Actual result |
| --- | --- |
| Final unit/config/dependency run | **41 passed in 0.49 s** |
| Final complete backend suite | **615 passed in 74.87 s**: 80 BE-012 tests plus 535 previous tests; 0 failures, 0 errors, 0 skips |
| Scoped statement coverage | **187/190, 98.42%**; repository **78/78**, crypto **19/19**, dependency **17/17**; three uncovered statements are abstract crypto-port `NotImplementedError` guards, not executable adapter behavior |
| Real database health | PostgreSQL **17.11**, `SELECT 1`, current revision **0006_email_codes** |
| Migration / constraints | Fresh upgrade, repeated upgrade, 0005→0006 upgrade and downgrade/re-upgrade verified; populated users, roles, assignments, counters, sessions and unrelated probe data preserved; digest/generation/TTL/attempt/consumption constraints reject invalid state; ORM comparison has no differences |
| Persistence / concurrency | Separate repository objects and a new database pool preserve pending/active proof state; concurrent issuance, wrong guesses and valid consumption, rollback-resistant accounting and lock-wait expiry all passed |
| Application / contract | SMTP-disabled and synthetic SMTP-enabled configurations started, pinged (`200`) and cleaned up; SMTP constructors were patched and never called; code dependency shares the existing database/sender; **14** existing OpenAPI paths, no send route or SMTP/HMAC-key schema fields |
| Lockfile / syntax | Lock check and compileall passed; no full backend lint/type-check tool exists, and none is claimed |
| Secret audit | Private SMTP file remains ignored/untracked, regular and mode `0600`; final scan covers **234** Backend/docs files, **276** application logs and **4** validation artifacts; no actual App Password/raw or checked encoded form in those outputs, no SMTP/code fixture secret/code markers in application logs |
| File / Git review | Diff/whitespace/reference checks passed; only listed BE-012 files changed; zero staged files, no Stage/Commit/Push/branch change |

Coverage/XML/log/health/security records are outside the repository under
`/private/tmp/datano-be012/`; synthetic code values in test IDs/artifacts are
intentional test fixtures, not real mailbox verification codes or deployment keys.
The actual SMTP password is read only in memory for the audit and never printed.

The task-owned `datano-be012` container used tmpfs storage, a fresh
`datano_test_be012` database and the exact protected BE-003 image:
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
It was stopped/automatically removed after successful validation. No existing
volume was mounted or modified; all six pre-existing volumes and the protected
image remain. No production/development database was migrated by this task.

## Scope / operational boundaries

No BE-012 acceptance criterion is left unverified. This is the shared internal
mechanism, not a released account flow. BE-013/014/016 must derive the context
from server-side identity, perform their own authorization, wire per-IP abuse
limits and non-enumerating public responses, and apply proofs to the appropriate
account operation. The limited recovery session, password changes/session bulk
revocation, admin elevation and email-change behavior are not started here.
There is no public issue/verify endpoint to expose ahead of those controls.

`EMAIL_CODE_HMAC_KEY` and serving SMTP configuration still require private
provisioning by an operator before deployment of a future flow. Rotation changes
scope keys and invalidates old challenges/cooldown state; no automatic rotation,
retention or background-cleanup policy is invented. Frontend checks were not run
because no frontend file or public API contract changed.

References consulted: [approved MVP](../../../docs/Datano_MVP.md),
[OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html),
[Python 3.12 HMAC](https://docs.python.org/3.12/library/hmac.html), and
[PostgreSQL 17 locking](https://www.postgresql.org/docs/17/explicit-locking.html).
The numerical policy is Datano's approved MVP decision, not an invented external
requirement or a claim of complete security certification.
