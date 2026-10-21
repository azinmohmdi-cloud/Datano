# BE-014 — verified administrator email and authoritative role

Date: 2026-10-21. Scope: Backend BE-014 only, dependent on the completed BE-012
and BE-009. The interrupted task was resumed by reviewing the current Git diff,
applicable backend/shared guides, Backlog/MVP, current API/repository/session/code
contracts and previous validation. Existing correct implementation was preserved.
Frontend, page design, public-signup publication lock and other task statuses are
unchanged. No Stage, Commit, Push or branch change was performed.

## Resume audit

Already implemented before resumption: private empty-by-default eligibility,
filtered server identity, persisted grant model/migration, email request/verify
endpoints, transactional promotion and session revocation/rotation, generic Admin
assignment denial, stale mailbox/activation proof invalidation and focused tests.
The last focused run had 11 passing tests; the normal/remember-me proof journeys
had also passed. Missing: comprehensive negative/concurrency/migration coverage,
the private operator CLI, compatibility of older positive Admin fixtures, final
suite/coverage/OpenAPI checks, operational documentation and this report.

Those remaining items were completed in place. A new negative HTTP test exposed
credential-input reflection in 422 errors on the new routes. Their paths now use
the existing credential-validation sanitizer. No other error contract changed.
The old restart test expected a raw Admin assignment to grant authority; it now
proves raw assignment stays User, private provisioning revokes the old cookie,
and a fresh login obtains persisted verified Admin authority. Positive Admin
fixtures explicitly provision their isolated synthetic accounts. The historical
BE-013 migration test explicitly targets its own revision instead of the moving
head, retaining its original data-preservation assertions.

## Acceptance evidence

| Criterion | Evidence |
| --- | --- |
| Private allowlist | `ADMIN_EMAIL_ALLOWLIST` is a validated secret JSON array, empty by default, excluded from repr/settings serialization. Trim/lowercase only; no Gmail aliases. Invalid settings produce static errors. No actual private addresses appear in source, OpenAPI or public outputs. Removing eligibility on restart immediately denies Admin permissions. |
| Address text never grants Admin | Allowlisted public signup still returns User. A raw persisted Admin relationship has neither effective Admin nor protected users-list access. Generic Admin assignment returns Forbidden; ordinary roles remain compatible. No old assignment is backfilled as proof. |
| Ownership proof or valid provisioning | Self-only opaque-session endpoints consume the shared eight-digit HMAC email challenge. Cross-purpose/account/mailbox replay, unapproved eligibility, inactive/missing account/role, undelivered proof, expiry, attempts and stale state are rejected. Private CLI requires explicit `--provision`, existing active account, private eligibility and active Admin role; it creates no user/password/role or email. |
| Session replacement on privilege elevation | Both cookie profiles rotate session and CSRF IDs, preserve remember-me behavior and the prior absolute cap, revoke every older account session and reject replay/old CSRF. Other accounts' sessions survive. Provisioning revokes all prior sessions; a fresh normal login obtains authority. Successful proof survives app/pool restart. |

Public contract:

- `POST /api/auth/admin-email/request`, strict `{}`: generic `200` acknowledgement,
  no-store; no email/role/account selection or delivery/eligibility disclosure.
- `POST /api/auth/admin-email/verify`, strict `{code}`: existing public login
  envelope (`user`, `effective_role`, `csrf_token`), secure opaque cookie and rotated
  CSRF cookie. Raw codes/tokens, grant metadata and private eligibility stay out
  of JSON and logs. Invalid proof/session `401`, Origin/CSRF `403`, oversize `413`,
  invalid body `422`, peer throttle `429` plus Retry-After, infrastructure `503`.
- Existing permission middleware consumes the filtered current server identity.
  Unproved Admin is removed from its permission-bearing roles as well as its
  effective role. Custom legacy permission-role CRUD is retained; those roles
  are not interpreted as the product Admin role. BE-041 remains unimplemented.

Codes share a per-account/mailbox/password-state scope across all browsers, so
opening another session cannot reset the 60-second resend or five-attempt budget.
Lifetime is exactly 600 seconds; reissue invalidates the previous code. The
separate `admin-email` peer counter has defaults 10/600s and body size 8192 bytes.
The quota boundary test uses a fixed clock. SMTP failure keeps acknowledgement
generic and leaves the reservation unusable. The capture sender never contacts
an external server. No real email, private Gmail configuration or real Admin grant
was used for BE-014.

## Database / concurrency

Real PostgreSQL 17.11, exact preserved image:
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
The task container `datano-be014-validation` uses tmpfs, a random loopback port,
a private temporary password and a dedicated `datano_test_be014` database.
Every database integration test uses its own generated schema. No development/production DB was
migrated and none of the six pre-existing Docker volumes was mounted or changed.

Revision `0008_admin_grants` follows `0007_password_recovery` and adds only one
technical table. Real integration checks verify:

- Upgrade from populated 0007, repeated upgrade, current head, zero auto-grants,
  downgrade to 0007, preservation of all previous tables/rows and re-upgrade.
- No ORM/Alembic metadata diff; no analytics/product schema added.
- Canonical nonempty mailbox, 32-byte role-state and method constraints, user/role
  foreign keys and cascades; startup refuses a missing authority table.
- Single-winner concurrent proof; password/role/session change after consumption
  prevents elevation; expired session during promotion rolls all writes back.
- Injected SQL failure after new session insertion rolls back grant, assignment,
  prior-session revocations and issuance. Storage exceptions lose driver/private
  context and are never treated as successful authority.

Promotion holds the established user-before-session locks. Grant, assignment,
revocation and replacement session share a transaction. Identity reload occurs
only after this transaction commits, avoiding a request-UoW/independent-UoW lock
cycle. Account activation/email updates invalidate the persisted grant. Role
fingerprint changes, including deactivation/reactivation, require fresh proof.

The private operator CLI was exercised as a real subprocess against an isolated
schema, including missing intent, valid provision/revocation and malformed private
configuration. Success/failure output omits account, allowlist and DSN details.

## TDD and executed validation

Behavioral Red/Green evidence retained from the interrupted task:

- Raw Admin assignment: intended identity failure (`Admin` instead of `User`),
  then private policy/authority checks passed (17 tests).
- Persisted grant: missing-table assertion failed, then model/migration passed
  with identity/policy tests (18 tests).
- Normal/remember proof: both missing endpoints returned 404; implementation and
  explicit limiter namespace produced 2 passing complete HTTP journeys.
- Generic assignment and email/activation return-to-old-state: 3 intended
  failures, followed by 11 passing focused regressions.
- On resumption, 422 input reflection: 2 failures / 9 passes; adding the two new
  route paths to the existing sanitizer made all 11 HTTP tests pass.

The CLI's first check found the entry point absent; this is recorded as a setup
check, not falsely counted as a behavioral TDD red. Its subsequent actual
subprocess check and 43 login regressions passed (44 tests, 15.02s).

Additional scope runs: authority/HTTP edge cases 28 passed (7.17s), followed by
expanded final proof/HTTP/CLI scenarios 34 passed (9.67s). Initial complete run:
749 passed (125.16s). No skips or failed tests; its coverage warning accurately
noted that subprocess CLI execution is outside the parent coverage collector.
The CLI was actually tested; its coverage is not represented as a measured parent
process percentage.

Final complete suite, scoped coverage and environment results are recorded below.

## Operational boundaries / compatibility

- Deploying this code requires an explicitly approved `alembic upgrade head` and
  private consistent server settings. This task migrated disposable schemas only.
  Existing raw Admin assignments lose product Admin authority until valid proof
  or provisioning; this is intentional BE-014 behavior and no rows are deleted.
- The private CLI and configuration procedure are documented in Backend README.
  Actual operator eligibility is deliberately empty until privately configured;
  no real mailbox/account was enabled here. No live Admin email/browser exercise
  was authorized; the existing BE-011 SMTP adapter has separate live evidence.
- Email dispatch uses the existing in-process background task, not a durable queue.
  Acknowledgement is not delivery evidence. Code consumption commits before the
  promotion transaction; failed promotion burns proof, requiring a fresh request
  after the normal interval. It cannot leave a partial grant or session change.
- Direct privileged SQL is a trusted operator boundary. Application repository
  mutations enforce invalidation; this is not tamper-proofing against a database
  operator who can rewrite authority or version timestamps directly.
- No Frontend regeneration/UI work, signup publication, new dependency, external
  service, role-management redesign, BE-015/016/041 work or Git mutation occurred.
- The backend has no configured formatter/linter/type checker. Compileall is a
  syntax check; it is not presented as lint or static type validation. Frontend
  lint/TypeScript/build are outside this backend-only change.


## Final results

**BE-014 is complete at its backend acceptance scope; only BE-014 is checked in
`docs/backlog.md`.** All acceptance criteria above have executable evidence.

Final command from Backend (with `DATANO_TEST_DATABASE_URL` supplied privately
by the temporary runner, never printed):

```sh
pdm run pytest -q --tb=line --show-capture=no \
  --cov=app.application.use_cases.auth.admin_email \
  --cov=app.application.use_cases.auth.admin_policy \
  --cov=app.infra.repositories.postgres.admin_grant_repository \
  --cov=app.infra.repositories.postgres.admin_proof_repository \
  --cov=app.interface.dependencies.admin_dependencies \
  --cov=app.interface.controller.admin_email_controller \
  --cov=app.interface.admin_email_route --cov-report=term-missing
pdm run python -m compileall -q app scripts
git diff --check
```

- **754 passed in 125.97s**, no skips, failures or warnings in the final run.
- Scoped implementation coverage: **264/267 statements, 99% rounded**.
  Policy, grant reader, dependency composition and HTTP controller: 100%; proof
  repository: 99%; application email service: 98%; preparse route: 95%.
  Three uncovered defensive branches: an injected invalid session-token generator,
  a naive injected grant clock, and route construction without lifespan database
  setup. Real generated tokens, database UTC clock and configured/unconfigured
  HTTP service/negative-session paths are covered. No global coverage target is
  claimed. The real subprocess CLI test is separate from these measured modules.
- Actual OpenAPI strict bodies, statuses, existing public envelope and cookie
  scheme were inspected by tests. Origin/CSRF, secure cookie flags, code/token
  secrecy, validation redaction, denied authorization and restart were executed.
- Compileall and whitespace diff validation pass. No configured backend lint or
  static type-check tool exists; no such result is claimed.
- Final standalone PostgreSQL check: `SELECT 1` succeeds, server **17.11**,
  **0 remaining generated test schemas**. Migration tests verify current head
  `0008_admin_grants`, upgrade/downgrade/re-upgrade and zero metadata differences.
- Git: changes limited to Backend and the BE-014 Backlog checkbox; no staged
  changes, branch switch, commit or push. Private environment files remain ignored.

- The task-owned `--rm` tmpfs container was stopped after the successful final
  health check and is absent from Docker. The exact PostgreSQL image remains.
  All six original volume names were verified present and none was used/deleted.
  An empty root log created by the standalone health import was preserved in the
  private task temporary directory rather than left as an untracked artifact.

## Changed files

38 repository paths (19 modified tracked files, 19 new files), all unstaged:

- `Backend/.env.example`
- `Backend/README.md`
- `Backend/app/application/use_cases/auth/admin_email.py`
- `Backend/app/application/use_cases/auth/admin_policy.py`
- `Backend/app/application/use_cases/auth/current_identity_use_case.py`
- `Backend/app/application/use_cases/user/assign_role_use_case.py`
- `Backend/app/domain/error/exception_handlers.py`
- `Backend/app/infra/core/config.py`
- `Backend/app/infra/core/seed.py`
- `Backend/app/infra/database/models.py`
- `Backend/app/infra/repositories/postgres/admin_grant_repository.py`
- `Backend/app/infra/repositories/postgres/admin_proof_repository.py`
- `Backend/app/infra/repositories/postgres/user_repository.py`
- `Backend/app/infra/services/registration_limiter.py`
- `Backend/app/interface/admin_email_route.py`
- `Backend/app/interface/controller/admin_email_controller.py`
- `Backend/app/interface/controller/api.py`
- `Backend/app/interface/dependencies/admin_dependencies.py`
- `Backend/app/interface/dependencies/auth_dependencies.py`
- `Backend/app/interface/dto/admin_email_dto.py`
- `Backend/app/interface/repository/admin_grant_repository_interface.py`
- `Backend/app/interface/repository/admin_proof_repository_interface.py`
- `Backend/app/main.py`
- `Backend/docs/validation/BE-014-admin-authority.md`
- `Backend/migrations/versions/0008_admin_grants.py`
- `Backend/scripts/provision_admin.py`
- `Backend/tests/conftest.py`
- `Backend/tests/integration/test_admin_email_http.py`
- `Backend/tests/integration/test_admin_grants.py`
- `Backend/tests/integration/test_admin_proof.py`
- `Backend/tests/integration/test_admin_provision_cli.py`
- `Backend/tests/integration/test_password_recovery.py`
- `Backend/tests/integration/test_session_login.py`
- `Backend/tests/support/persistence_worker.py`
- `Backend/tests/unit/test_admin_assignment.py`
- `Backend/tests/unit/test_admin_policy.py`
- `Backend/tests/unit/test_current_identity.py`
- `docs/backlog.md`
