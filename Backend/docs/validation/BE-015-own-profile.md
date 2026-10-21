# BE-015 — read and edit the authenticated user's own profile

Dates: 2026-10-21–2026-10-22 (Asia/Tehran). Initial Git status was clean. BE-009 and BE-005 are completed.
The shared/backend AGENTS guides, Backlog, approved MVP/UX, current repositories,
DTOs, opaque-session/CSRF and BE-014 identity behavior, plus the FE-013 profile
controller/validation were inspected before changes. Existing technical guide
snapshots were checked against actual code. No Git mutation was performed.

## Acceptance and implementation

| Criterion | Evidence |
| --- | --- |
| Read/edit names only for self | Existing `GET /api/auth/me` is reused. New `PATCH /api/auth/me` derives the owner exclusively from the current validated opaque session. An ordinary User without users-CRUD permissions can edit self; another account remains byte-for-byte unchanged. Body ID fields fail; query identity hints cannot select an account. Invalid/expired/revoked cookies, inactive/deleted accounts and a valid legacy bearer cannot bypass the session boundary. |
| Role and activation cannot change | Strict DTO accepts only optional `first_name` and `last_name`, at least one required. Role/roles, activation, identity, credentials and all unknown fields fail. Public output retains the filtered server identity; real verified Admin authority survives a name edit, while raw Admin assignment remains User with no exposed Admin permissions. Email, canonical key, username, hash, activation and creation timestamp are unchanged. |
| Failed validation is atomic | Validate both supplied names before domain mutation, operate on a detached candidate, then call a narrow repository write. HTTP rejection preserves the complete public profile; unit tests preserve the shared stored entity and timestamp. Real PostgreSQL snapshots show no partial first-name change when the second name or an extra privilege field fails. Injected failure after the SQL write rolls back both names and preserves the current cookie. |

No profile read API was duplicated, no Frontend design/generated client changed,
and no email-change, password, role-management or activation flow was introduced.
Only the BE-015 Backlog checkbox is eligible for completion after final validation.

### Contract

- Read: `GET /api/auth/me` (unchanged).
- Edit: `PATCH /api/auth/me`, partial `{first_name?, last_name?}`; one or both.
- Omitted fields remain unchanged. Explicit null, wrong types, unknown fields and
  empty body fail `422`. No request-supplied user ID is part of the contract.
- Names follow the existing profile/registration requirement: nonblank text.
  Valid Unicode spelling, ZWNJ, combining marks and outer whitespace are retained.
  No new maximum length, trimming, normalization, case-folding or script rule.
  Unpaired surrogates/U+0000 are rejected as unrepresentable PostgreSQL UTF-8 text.
- Success: existing `StandardResponse[CurrentUser]`, public user fields and
  authoritative `effective_role`; `Cache-Control: no-store`. No raw token or hash.
- Session cookie and CSRF token are retained; names do not change privilege.
  Existing session resolve can touch idle activity. Normal/remember lifetime
  behavior is inherited rather than redefined.
- `401`: invalid session/account; `403`: failed Origin/session-bound CSRF;
  `422`: name/body validation. Framework errors retain the existing detail shape
  with credential-shaped input values removed; domain errors retain the envelope.
  Unexpected write failure uses the existing generic `500` and request rollback.

The real OpenAPI test verifies only the two non-nullable optional string fields,
`additionalProperties=false`, `minProperties=1`, cookie security, required browser
headers and success/failure responses. `SkipJsonSchema[None]` represents internal
omission without advertising explicit null as accepted client input; runtime
validators reject explicit null. FE-032 owns future client generation/mutation
and cache integration; BE-016 owns proven email replacement.

### Storage and concurrency

`IUserRepository.update_profile_names` is a narrow typed contract implemented by
both existing adapters. The caller supplies validated names/timestamp; only names
actually supplied and `updated_at` can be persisted. PostgreSQL requires an
existing active row and uses the current request transaction. Missing/inactive
rows cannot be created or reactivated. Disjoint concurrent patches preserve both
names and a stale profile cannot overwrite a newer hash, email or omitted name.

Authentication retains BE-009's user-before-session row lock in the shared
request UoW. The response keeps the permission-filtered roles/effective role from
that server identity, incorporating only the persisted names/timestamp. It does
not serialize the raw role assignments returned by a repository. Existing
permission-guarded legacy `/api/users/{id}` CRUD remains unchanged; self editing
confers no access to those APIs.

No ORM/schema/migration, dependency, lockfile or environment change was necessary.
Alembic head remains `0008_admin_grants`. PostgreSQL checks ran only in disposable
per-test schemas on `datano_test_be015`, in task-owned `datano-be015-validation`
with tmpfs and a random loopback port. Private temporary settings are mode 0600.
The exact existing PostgreSQL 17.11 image was reused:
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
No previous volume, app database or private SMTP configuration was used.

## Actual validation / TDD

Environment: Python **3.12.14**, PDM **2.29.2**, existing locked project environment.

1. Red: a self names-edit HTTP test using the existing isolated session fixture
   failed as intended: `405` instead of `200` (1 failed, 0.62s), proving PATCH was
   absent while GET worked.
2. Green: names-only domain/use case/repository/DTO/controller integration plus
   current auth/identity regressions: **11 passed, 1.14s**.
3. Expanded units/HTTP initially had 37 passes and one transport setup failure:
   HTTPX cannot encode a raw lone surrogate. The test now sends standard escaped
   JSON so the invalid Unicode reaches the server. This was a test transport fix,
   not a product failure or a claimed TDD red.
4. Actual OpenAPI contract Red: missing `minProperties` failed (1 failed, 22
   deselected, 0.48s). DTO schema metadata and internal omission representation
   were aligned with its runtime rules.
5. Units, self HTTP and real PostgreSQL tests: **54 passed, 7.55s**. Covered forbidden
   fields, missing cookies/bearer, Origin/CSRF, Unicode, empty/null/type validation,
   ownership, persistence/restart, read/write failure, concurrency and verified
   Admin preservation. A direct domain atomicity regression was then added.

Final complete-suite/coverage results and final repository scope follow below.

## Scope and remaining integration

This task implements the Backend profile contract. FE-032 remains pending for
actual frontend name submission/cache updates. BE-016/FE-033 email change remains
pending. The approved pages and public signup publication decision are unchanged.
No SMTP message, deployment, non-test migration, Stage, Commit, Push or branch
switch occurred. There are no new environment variables or dependencies.

Backend has no configured formatter/linter/static type checker. Compileall is
reported only as syntax validation. Frontend lint, TypeScript and build are not
applicable to this backend-only change and are not claimed as executed.


## Final verification

**BE-015 is complete at the requested Backend acceptance scope.** Only BE-015's
checkbox is checked in `docs/backlog.md`; FE-032, BE-016 and other tasks retain
previous statuses. All acceptance criteria have the automated evidence above.

From Backend, with `DATANO_TEST_DATABASE_URL` supplied privately by the dedicated
temporary runner (never printed):

```sh
pdm run pytest -q --tb=line --show-capture=no \
  --cov=app.application.use_cases.user.update_own_profile \
  --cov=app.interface.dto.profile_dto \
  --cov=app.domain.entities.user_entity \
  --cov=app.infra.repositories.postgres.user_repository \
  --cov=app.infra.repositories.in_memory.user_repository \
  --cov=app.interface.controller.auth_controller \
  --cov=app.interface.dependencies.user_dependencies --cov-report=term-missing
pdm run python -m compileall -q app scripts
git diff --check
```

- **809 passed in 137.19s**, no failures, skips or warnings. This includes all 55
  new profile tests and the existing 754 tests, including prior migrations,
  session security, password recovery and verified administrator authority.
- Scoped coverage: **416/427 statements (97% rounded)**. New profile use case,
  DTO and dependency composition are 100%. All added domain/controller/repository
  lines are covered. The 11 uncovered lines belong to pre-existing generic user
  update/permission-catalog/role-error branches, not the new profile path.
  There is no project-wide percentage requirement or claimed global coverage.
- Compileall and whitespace diff validation passed. Actual OpenAPI, public/error
  responses, authentication/ownership, Origin/CSRF, persisted Unicode spelling,
  rollback, disjoint concurrency and application restart were tested.
- Final standalone database check: `SELECT 1` succeeded, PostgreSQL **17.11**,
  **0 leftover generated test schemas**. Head remains `0008_admin_grants` and
  the full existing migration tests pass. No non-test DB migration occurred.
- The original six Docker volumes were verified present and never mounted or
  modified. The task-owned tmpfs container is the only cleanup target; the exact
  PostgreSQL image is retained.
- Final cleanup verified: `datano-be015-validation` was stopped and removed by
  its `--rm` policy; its absence and the exact retained image were checked.
- Git: all changes are unstaged; no branch switch, Stage, Commit or Push. Only
  Backend plus the BE-015 Backlog checkbox changed. Frontend and private settings
  are untouched. No temporary database settings or credentials are in this diff.

## Changed files

15 paths: 9 modified tracked files and 6 new files.

- `Backend/README.md`
- `Backend/app/application/use_cases/user/update_own_profile.py`
- `Backend/app/domain/entities/user_entity.py`
- `Backend/app/domain/error/exception_handlers.py`
- `Backend/app/infra/repositories/in_memory/user_repository.py`
- `Backend/app/infra/repositories/postgres/user_repository.py`
- `Backend/app/interface/controller/auth_controller.py`
- `Backend/app/interface/dependencies/user_dependencies.py`
- `Backend/app/interface/dto/profile_dto.py`
- `Backend/app/interface/repository/user_repository_interface.py`
- `Backend/docs/validation/BE-015-own-profile.md`
- `Backend/tests/integration/test_own_profile.py`
- `Backend/tests/integration/test_own_profile_postgres.py`
- `Backend/tests/unit/test_own_profile.py`
- `docs/backlog.md`
