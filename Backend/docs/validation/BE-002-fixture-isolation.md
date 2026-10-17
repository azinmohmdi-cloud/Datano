# BE-002 — Independent backend fixtures

Recorded on 2026-10-17. BE-001 is complete and its Python 3.12.14/PDM 2.29.2
environment was reused. The initial Git working tree was clean. Scope is test
fixtures, affected tests and their documentation; application code, frontend,
API contracts, manifests, lockfile and AGENTS files remain unchanged.

## Change and acceptance evidence

- `test_client` now has function scope. It resets the existing in-memory registry
  before entering FastAPI lifespan, clears the client's cookie jar at teardown,
  and resets the registry after shutdown in `finally`, including on test failure.
  This reuses the existing reset helper; no application reset endpoint was added.
- `admin_token` has the same function lifetime as its client/state. Shared
  `admin_auth` removes the duplicated class-local header fixtures. Tokens are not
  cached across tests or reused underneath a reset registry.
- `created_user` and `created_role` create targets through the real HTTP API
  within the current test and validate their response payloads with existing DTOs.
  Read/update/delete/assignment tests target these records. The seeded admin is
  used for authentication and is not a CRUD target. List tests check their own
  record IDs and fields without assuming a global initial count or first row.
  Permission lookup uses its catalog title rather than array position.
- Two identical overwritten expiration/revocation definitions were removed;
  their existing cases remain. The overwritten default-blacklist check was
  renamed and explicitly checks `blacklisted=False`. The actual blacklisting
  transition remains a separate test. A new AST guard rejects duplicate test
  definitions before they can silently disappear from collection.
- Regression cases run the actual project fixtures in temporary pytest
  subprocesses. Users, roles, cookies and refresh-token storage are tested across
  consecutive items in both alpha/beta orders. A previous refresh token must be
  absent from storage and rejected over HTTP. A separate child run deliberately
  fails a test body, then checks cleared cookies and repositories **without
  creating a new client**, proving teardown rather than just the next setup.

The built-in `pytester` plugin is enabled; no dependency was added. Temporary
fixture projects, cookies and test credentials do not enter tracked files.
The existing closed-stream warning filter was not expanded.

## Red → Green → Refactor

All commands ran from `Backend/` through the environment established by BE-001,
with `.tools/pdm/bin` on PATH and PDM cache/log directories under `/private/tmp`.

| Step / command | Actual result |
| --- | --- |
| `pdm lock --check`; `pdm run python --version` | Lock check passed; Python 3.12.14 |
| Red: `pdm run pytest tests/test_fixture_isolation.py --junitxml=/private/tmp/datano-be002-red.xml` with the original session fixtures | All 8 lifecycle cases failed for leaked users, roles, cookies or refresh tokens; each child run had one passing item and one leakage failure; no import/setup errors |
| Red: `pdm run pytest tests/test_fixture_isolation.py::test_test_names_are_unique --junitxml=/private/tmp/datano-be002-names-red.xml` | Failed on exactly three repeated names in `TestRefreshTokenEntity` |
| Green: `pdm run pytest tests/test_fixture_isolation.py --junitxml=/private/tmp/datano-be002-green.xml` after fixture/name changes | 9 passed in 13.64s |
| Affected tests: `pdm run pytest tests/integration/ tests/unit/test_domain_entities.py tests/test_fixture_isolation.py::test_http_fixtures_clean_up_after_a_failed_test --junitxml=/private/tmp/datano-be002-affected.xml` | 48 passed in 12.60s |
| Final full suite: `pdm run pytest --cov=app --cov-report=term --cov-report=json:/private/tmp/datano-be002-coverage.json --junitxml=/private/tmp/datano-be002-full.xml` | 85 passed in 26.46s |
| Full suite in reverse order, command below | 85 passed in 26.05s |
| Full suite shuffled with seed 20261017, command below | 85 passed in 26.06s |
| XML order/count verification and `git diff --check` | Passed |

All final parent suites had zero failures, errors or skips. The cleanup regression
contains one **intentional child failure** and requires exactly one failure plus
one successful cleanup observer; it is not a failed product check or a skipped
test. The regression fixtures use explicit short tracebacks; no test credential
values are included in this report.

The suite grew from 74 collected cases to 85: one recovered default-blacklist
case plus ten fixture/name regression cases. No previously collected case was
removed. Coverage of `app` is **83.92%** (1,659/1,977 statements; displayed as
84%), with registry reset now covered. This is line coverage of the parent
process, not branch coverage or aggregated subprocess coverage. Existing gaps
outside fixture isolation, such as full refresh/logout behavior and policy
storage, remain outside this task; no coverage threshold was invented.

## Reproducing the full-suite order checks

No random-order dependency was installed. The temporary module
`/private/tmp/datano-be002-order/datano_be002_order.py` contained:

```python
import os
import random


def pytest_collection_modifyitems(items):
    if os.environ["DATANO_TEST_ORDER"] == "reverse":
        items.reverse()
    else:
        random.Random(20261017).shuffle(items)
```

After creating that file, the exact order checks from `Backend/` were:

```sh
export PYTHONPATH="/private/tmp/datano-be002-order:$PWD"
export DATANO_TEST_ORDER=reverse
pdm run pytest -p datano_be002_order -q --junitxml=/private/tmp/datano-be002-reverse.xml
export DATANO_TEST_ORDER=shuffle
pdm run pytest -p datano_be002_order -q --junitxml=/private/tmp/datano-be002-shuffle.xml
```

The XML contained the same 85 unique case identities in each run. Execution order
was verified against the exact reversed normal list and Python's seeded shuffle
of that list. The permanent lifecycle regression itself always tests both item
orders without this temporary plugin. XML/coverage files are temporary diagnostic
artifacts; the commands and durable results are recorded here.

## File scope and limits

- [Fixture lifecycle and per-test records](../../tests/conftest.py).
- [User integration tests](../../tests/integration/test_users.py).
- [Role integration tests](../../tests/integration/test_roles.py).
- [Entity test names](../../tests/unit/test_domain_entities.py).
- [Fixture/name regressions](../../tests/test_fixture_isolation.py).
- [README](../../README.md): test-isolation behavior and commands.
- This validation report.
- [Backlog](../../../docs/backlog.md): only BE-002's checkbox.

The change provides sequential test independence with the current process-local
repositories. It does not establish safe concurrent TestClients sharing the same
registry, parallel threads in one process, PostgreSQL transaction isolation or
future worker isolation. Those are not claimed tested. Re-running lifespan and
real password hashing per HTTP test has a runtime cost; no password service was
stubbed to conceal that cost.

HTTP tests still exercise the existing in-process FastAPI application, including
lifespan and routing. No live server, frontend build, Orval generation, migration
or provider validation was needed because application/API behavior did not change.
No secrets, settings or package versions changed. BE-002 is complete; Epic 06 is
not complete and BE-003 was not started. No Stage, Commit, Push or branch change
was performed.
