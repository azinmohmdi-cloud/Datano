# BE-004 — Persistent users and roles

Recorded on 2026-10-18. BE-003 was complete and the initial working tree was
clean. Python 3.12.14/PDM 2.29.2 and the existing locked SQLAlchemy 2.0.55,
Alembic 1.20.0 and psycopg 3.3.6 environment were reused. No dependency,
lockfile, frontend, DTO, domain entity or use-case implementation changed.

## Outcome and contract compatibility

`SQLUserRepository` and `SQLRoleRepository` implement the existing
`IUserRepository`/`IRoleRepository` contracts using a supplied async session.
Normal FastAPI dependency wiring now selects them. In-memory adapters remain
available and are explicitly injected into the legacy test application; there
is no serving-mode fallback to memory.

- Users persist profile fields, username/email, hashed password, activation and
  timezone-aware timestamps. Roles persist name, activation, timestamps and
  permission IDs. Membership is stored separately in `user_roles`.
- IDs remain text. Missing non-UUID identifiers keep the existing missing-record
  behavior. Lookup/uniqueness semantics are exact-value: email normalization and
  username migration remain BE-005, not partially implemented here.
- Adapters return detached domain dataclasses, copy permission lists and load
  actual role metadata instead of synthetic empty-name role shells. Reads require
  no lazy I/O after session exit. The database assignment table is authoritative;
  passing `roles` into user create/update does not create implicit assignments.
- Lists use SQL count/limit/offset with stable `(created_at, id)` ordering and
  compatible `pages=1` for an empty collection. A user page loads all its roles
  together rather than issuing one role query per user. Existing authorization
  code still re-fetches assigned roles; this task does not claim to eliminate
  every pre-existing authorization query.
- Duplicate records/assignments and known invalid constraints map to established
  domain errors without SQL/driver details. Repositories flush but never commit.
  The caller must let a failed transaction exit and roll back before reuse.

`create_app()` preserves existing routes, middleware, handlers, pagination and
OpenAPI metadata. Its lifespan requires `DATABASE_URL`, owns/disposes the pool
and checks database usability by bootstrapping required role records in a
transaction. A missing schema gives an actionable `alembic upgrade head` error;
startup never applies migrations or runs `create_all`. Configuration remains
loadable offline, but the serving application now requires PostgreSQL.

HTTP dependencies share one `get_database_session` context across user and role
repositories, so a complete operation commits or rolls back together. This was
verified through a test-only HTTP operation that writes both records and an
assignment then raises a domain conflict. The entire operation rolls back and
the session exits its transaction. The installed FastAPI 0.115.6 executes yield
dependency cleanup before response delivery, consistent with its historical
[dependency lifecycle](https://fastapi.tiangolo.com/advanced/advanced-dependencies/).
Pool/session ownership follows the
[SQLAlchemy async transaction API](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html).

Startup creates missing `User` and `Admin` role records with PostgreSQL
[`ON CONFLICT DO NOTHING`](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#insert-on-conflict-upsert).
It does not overwrite existing role IDs, permissions, activation or creation
timestamps. It creates **no user, password or automatic administrator assignment**.
The fixed-password seed remains limited to explicit in-memory test/example use.
Test actors are provisioned only in disposable schemas; the helper under
`tests/support/` is not a production provisioning command. Valid administrator
provisioning/email proof remains BE-014.

## Migration and required constraints

Revision `0002_users_roles`, following the unchanged `0001_database_baseline`,
adds only these identity tables:

| Table | Enforced database rules |
| --- | --- |
| `users` | Text primary key; unique email and username; non-null profile/hash/status/timestamps; username length 3–50 |
| `roles` | Text primary key; unique name; non-null permissions/status/timestamps; nonblank name, maximum length 100 |
| `user_roles` | Composite primary key rejects repeated assignments; non-null user/role foreign keys; role lookup index |

Both assignment foreign keys use `ON DELETE CASCADE` **only for assignment
rows**. Deleting a user preserves roles; deleting a role preserves users. Tests
verify both directions and absence of orphan assignments. No soft deletion,
analytics schema, session schema or speculative domain model was added.

Permission IDs remain a PostgreSQL text array matching the existing role
contract. Validation against the JSON catalog remains in the existing use
cases; there is no SQL permission table or cross-storage foreign key.

Real PostgreSQL checks cover a fresh schema and an upgrade from the BE-003
baseline, repeated upgrade, downgrade and re-upgrade. An unrelated table and
its row survive all steps. Alembic `compare_metadata` reports no difference
between the new ORM metadata and the migrated schema. The BE-003 tests that
assert the table-free baseline now explicitly target revision `0001` rather
than moving `head`; their original assertions and case identities are retained.

Downgrading to `0001_database_baseline` drops the three identity tables **and
their data**. The test uses only disposable schemas. Re-upgrade recreates tables,
not deleted records. The README requires a verified backup/restore plan before
an intentional downgrade of real data and recommends forward corrective
migrations when retaining identities. Production backup restoration was not
performed or claimed tested in this task.

## Red → Green → Refactor evidence

All commands ran from `Backend/`. The private helper
`/private/tmp/datano-be004/run-tests.py` loaded the test URL from a private file
into `DATANO_TEST_DATABASE_URL` and invoked `.tools/pdm/bin/pdm run pytest`.
PDM cache/log paths were under `/private/tmp` with update checks disabled.
URLs/passwords were never command-line arguments. The table shows equivalent
PDM commands with the actual test arguments.

| Check / command | Observed result |
| --- | --- |
| Baseline: `pdm run pytest --junitxml=/private/tmp/datano-be004/baseline.xml` | 105 passed in 27.42s |
| Red: `pdm run pytest tests/integration/test_persistent_repositories.py tests/integration/test_persistence_migrations.py --junitxml=/private/tmp/datano-be004/repositories-red.xml` | 11 failed, 2 passed in 1.09s; no errors/skips. Initial adapter scaffolds used the existing memory behavior; failures demonstrated lost records across instances, missing unique conflicts, missing transaction semantics and missing identity tables |
| Repository Green / lifespan Red: same modules plus `tests/integration/test_persistent_http.py`, XML `http-red.xml` | 13 passed, one expected failure in 1.83s: normal startup still used the old memory seed instead of PostgreSQL role records |
| Wiring Green: the three new modules plus `tests/test_fixture_isolation.py`, XML `wiring-green.xml` | 24 passed in 17.66s; legacy teardown/cookie isolation remained intact |
| Process/lifespan checks: `pdm run pytest tests/integration/test_persistent_http.py --junitxml=/private/tmp/datano-be004/process-green.xml` | 6 passed in 3.53s |
| Expanded affected checks: the three new integration modules, XML `affected-green.xml` | 39 passed in 6.11s |
| First full run with coverage, XML `full.xml` | 144 passed in 36.14s |
| Final full run after two additional remove-assignment boundary cases: command below | **146 passed in 36.50s**, zero failures/errors/skips |
| `pdm lock --check`; actual OpenAPI comparison; final diff checks | Passed; dependency resolution and actual OpenAPI unchanged |

```sh
pdm run pytest --cov=app --cov=migrations --cov-report=term \
  --cov-report=json:/private/tmp/datano-be004/coverage.json \
  --junitxml=/private/tmp/datano-be004/full-final.xml
```

All 105 previously collected cases remain in the final JUnit identities; 41
cases were added. Existing entity/memory tests were not replaced by database
fakes. The legacy HTTP fixture now creates an app with explicit memory
dependencies and isolated seed lifespan, retaining its before/after registry
reset and cookie teardown, including after failure. The separate persistent
HTTP cases use the normal PostgreSQL lifecycle.

The new cases exercise every repository operation, missing/string IDs, stable
pagination, update conflicts, activation/hash/timestamp preservation, role
metadata/permissions, membership cleanup and transaction rollback. Twelve
parameterized raw-SQL cases bypass use-case prechecks to verify primary/unique
keys, both assignment foreign keys, checks and non-null hash/permissions.
Concurrent user-email and role-name inserts synchronize after both prechecks;
exactly one succeeds and the other produces a safe conflict.

Combined parent-process line coverage for `app` and `migrations` is **85.48%**
(1,942/2,272 statements). New role repository, models, bootstrap, database
dependency and revision have 100% line coverage; the user repository has
97.18%. Its unexecuted paths are defensive missing-user checks after writes.
Constraint translation has 91.30% coverage; FK race translation and unknown-error
rethrow are not exercised. The main module's unexpected programming-error
rethrow/direct Uvicorn branch and migration CLI subprocess lines are not fully
represented by parent coverage. This is not branch or combined subprocess
coverage, and no arbitrary threshold was introduced.

## Real process and PostgreSQL restart validation

The Docker image remained the exact BE-003 image:
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
Observed server was **PostgreSQL 17.11** on aarch64 Linux/musl.

Only task-owned resources were created: `datano-be004-postgres` and
`datano-be004-test-data`, both labeled `com.datano.task=BE-004`. Unlike a tmpfs
database, this dedicated test volume survives a container restart. The six
retained legacy data volumes and the PostgreSQL image were preserved.

The fixtures require a `datano_test*` PostgreSQL database and create a unique
`be004_<uuid>` schema per test, dropping only that schema in `finally`. They
never fall back to the application's database. Private URL/environment files
under `/private/tmp/datano-be004` have mode 0600 in a mode-0700 directory.

Two separate validation levels succeeded:

1. The permanent HTTP integration case launched two independent Python
   application processes. The first provisioned a test actor, then created and
   activated a user, created a role with permissions and assigned it through the
   existing API. The second logged in again and verified the same records,
   creation timestamp, status, hash-based login, role name and permission IDs.
   Missing-ID, duplicate-user and denied-role-deletion responses were also checked.
   Public user responses contained no password hash.
2. A private probe created another dedicated schema and the same HTTP records,
   exited the application process, ran
   `docker restart --timeout 20 datano-be004-postgres`, waited for `pg_isready`,
   then launched a new application process. It verified the same HTTP records
   after the real PostgreSQL restart and dropped the probe schema afterward.

The second probe's exact entry points were:

```sh
.venv/bin/python /private/tmp/datano-be004/restart-probe.py prepare
docker restart --timeout 20 datano-be004-postgres
# Waited for successful pg_isready before reading.
.venv/bin/python /private/tmp/datano-be004/restart-probe.py read
.venv/bin/python /private/tmp/datano-be004/restart-probe.py cleanup
```

The post-suite server check reported `healthy`, zero `be003_%`/`be004_%` schemas
and zero other connections to the test database. Task-owned Docker resources
are removed after validation; this task does not deploy a permanent server or
modify private application settings. Use the README's persistent local Docker
volume setup and configure `DATABASE_URL`, then migrate before serving the app.

## Changed files and remaining scope

- [Identity ORM models](../../app/infra/database/models.py),
  [required-role bootstrap](../../app/infra/database/bootstrap.py),
  [configuration comment](../../app/infra/core/config.py).
- [PostgreSQL adapter package](../../app/infra/repositories/postgres/__init__.py),
  [user repository](../../app/infra/repositories/postgres/user_repository.py),
  [role repository](../../app/infra/repositories/postgres/role_repository.py),
  [mapping/constraint errors](../../app/infra/repositories/postgres/mapping.py).
- [Database dependency](../../app/interface/dependencies/database_dependencies.py),
  [user wiring](../../app/interface/dependencies/user_dependencies.py),
  [role wiring](../../app/interface/dependencies/role_dependencies.py),
  [application assembly/lifespan](../../app/main.py).
- [Alembic metadata registration](../../migrations/env.py),
  [identity revision](../../migrations/versions/0002_users_roles.py).
- [Shared PostgreSQL fixtures](../../tests/postgres.py),
  [repository checks](../../tests/integration/test_persistent_repositories.py),
  [migration/constraint checks](../../tests/integration/test_persistence_migrations.py),
  [persistent HTTP checks](../../tests/integration/test_persistent_http.py),
  [process helper](../../tests/support/persistence_worker.py) and its
  [package initializer](../../tests/support/__init__.py).
- [Legacy HTTP fixture wiring](../../tests/conftest.py), explicit BE-003 revision
  targets in [real migration checks](../../tests/integration/test_database.py)
  and [offline baseline check](../../tests/unit/test_database_migrations.py).
- [README](../../README.md), [environment example](../../.env.example), this
  report and only BE-004's [backlog checkbox](../../../docs/backlog.md).

Refresh tokens remain process-local. Email canonicalization, Argon2id migration,
product signup, opaque sessions, email delivery/proof and valid administrator
provisioning remain their authorized later tasks. The existing empty-permission
role-update defect remains DEBT-001; no unrelated use-case fix was bundled.
No analytics tables, frontend changes, client regeneration, production migration
or deployment occurred. A live Uvicorn server was not separately exercised;
normal application lifespan/HTTP behavior was exercised in independent processes
with TestClient. Production backup/restore, failover, load and broader concurrent
role editing were not claimed validated.

BE-004 is complete after final checks. BE-005 and Epic 06 remain unchecked.
No Stage, Commit, Push or branch change was performed.
