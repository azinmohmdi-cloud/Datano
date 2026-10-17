# BE-001 — Python/PDM environment and backend baseline

Recorded on 2026-10-17. Dependency FE-028 is checked in the Backlog and its UI
acceptance was confirmed by the user. Scope is environment setup, startup and
existing-test execution. No application code, tests, API contracts, frontend,
database schema or AGENTS files changed. BE-002 was not started.

## Environment and repeatable setup

- Host: macOS 15.6.1, ARM64.
- The default `python3` was Python 3.13 and PDM was absent from PATH. The bundled
  interpreter at `/Users/azin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`
  reports **Python 3.12.14**, satisfying the project's `==3.12.*` requirement.
- PDM **2.29.2** was installed in `Backend/.tools/pdm`, separate from the
  application environment. The README pins this tested tool version for setup.
- `pdm use --first --no-version-file` with the explicit bundled interpreter
  created `Backend/.venv`; `pdm run python` resolves to that environment, not the
  system Python or the PDM tool environment. Selection is stored in the ignored
  `.pdm-python`. No global Python installation was modified.
- `pdm sync -dG dev --fail-fast` installed **43 packages** from the existing
  default/dev lock groups. Every installed distribution name/version was compared
  with `pdm.lock`; there were **zero mismatches or additional packages**. The
  lockfile also contains platform-specific packages not installed on macOS.
- `.tools/` is now ignored locally; `.venv/`, interpreter selection, logs, test
  caches and coverage data are already ignored. No secrets or `.env` file were
  added. The baseline uses the existing development configuration and lifespan
  seed, not production credentials or production services.

Follow [README setup](../../README.md#development-and-validation) from `Backend/`.
The local validation session placed the bundled Python and `.tools/pdm/bin` on
PATH and used these optional environment overrides to keep tool artifacts in
temporary locations and avoid update checks:

```sh
export PDM_CHECK_UPDATE=false
export PDM_CACHE_DIR=/private/tmp/datano-be001-pdm-cache
export PDM_LOG_DIR=/private/tmp/datano-be001-pdm-logs
```

Initial sandbox installation failed with DNS resolution errors. Installing PDM
and syncing pinned dependencies succeeded with approved network access. An
initial PDM dry-run also hit its default log-directory permission boundary;
the approved rerun succeeded, and subsequent commands used the explicit log
directory above. These environment failures were not application test failures.

## Lockfile metadata correction

Initially, `pdm lock --check` failed: the stored input hash did not match the
current `pyproject.toml`, and PDM reported the older lock format. Inspection of
PDM 2.26.2's wheel confirmed the same input-hash algorithm and lock format 4.5.0;
changing tool versions alone would not explain or repair the input mismatch.
No historical cause for the stale hash is assumed.

The original lockfile was copied to `/private/tmp/datano-be001-refresh.lock` and
refreshed with:

```sh
pdm lock --refresh --lockfile /private/tmp/datano-be001-refresh.lock
```

The complete parsed package records were compared before applying the output.
Only two metadata fields changed:

- `lock_version`: `4.5.0` → `4.5.1` (the installed PDM's format).
- `content_hash`: `sha256:7fd52ab3c66500df4de41ca07e36953c8213aade57a2e5d8e974fd99f19c4091`
  → `sha256:da902d8184862c78cb45ee1e4014de6ffe1d7f6dcb55b2315efe3d562b14e560`.

All package names, versions, dependencies, markers, file hashes, groups and targets
remain identical. `pyproject.toml` is unchanged. The applied lockfile is byte-for-byte
equal to the PDM-generated temporary result. Final lock checking succeeds without
warnings; syncing again reports zero additions, updates or removals.

## Executed validation

All commands ran from `Backend/` through the PDM-managed application environment.

| Command/check | Actual result |
| --- | --- |
| `pdm --version` | 2.29.2 |
| `pdm run python --version` | Python 3.12.14 |
| `pdm lock --check` after metadata correction | Passed, exit 0 |
| `pdm sync -dG dev --fail-fast` after metadata correction | Passed; all packages already synced, 0/0 changes |
| Installed-package comparison with lockfile | 43 exact version matches; no extras |
| `pdm run pytest --cov=app --cov-report=term-missing --cov-report=json:/private/tmp/datano-be001-coverage.json --junitxml=/private/tmp/datano-be001-pytest.xml` | 74 passed in 6.31s; zero failures/skips |
| Final `pdm run pytest` after metadata correction | 74 passed in 2.90s; zero failures/skips, no warnings reported |
| `make lint` with the local PDM on PATH | Passed; only the existing `app/main.py` syntax compilation |
| `git diff --check` and final scope/ignore review | Passed; only the documented setup/report/lock metadata and BE-001 status changes, with pre-existing Backlog edits preserved |

The collected tests comprise 51 entity/repository unit cases, 22 auth/user/role
HTTP integration cases and one ping case. Coverage of `app` is **83.71%**
(displayed as 84%): 1,655 covered of 1,977 statements. This is line coverage,
not branch coverage or an approved minimum threshold. Refresh/logout paths,
several error branches, JSON policy storage and configuration validation retain
coverage gaps; no tests were added, removed, weakened or suppressed.

The temporary XML and coverage JSON files above are diagnostic artifacts, not
required inputs to future runs. The durable results are recorded here.

## Startup and live HTTP smoke checks

Executed:

```sh
pdm run uvicorn app.main:app --host 127.0.0.1 --port 8004
```

Lifespan completed successfully. The first sandbox launch could not bind the
loopback port; the approved rerun listened successfully. An HTTPX client from
the same locked environment, with `trust_env=False` and a five-second timeout,
checked the following over real HTTP after loopback access was approved:

| Request | Verified result |
| --- | --- |
| `GET /api/ping` | 200; exact body `{"success":true,"message":"pong","payload":null}` |
| `GET /docs` | 200 |
| `GET /redoc` | 200 |
| `GET /openapi.json` | 200; valid JSON, 12 paths and 20 operations; existing ping/auth/user/role paths present |
| `GET /api/auth/me` without credentials | 401 with `success=false` |
| `OPTIONS /api/auth/login`, Origin `http://localhost:3000`, requested method POST | 200, exact allowed origin and `access-control-allow-credentials: true` |

The smoke results were also written to `/private/tmp/datano-be001-smoke.json`.
The temporary Uvicorn process was stopped with Ctrl+C; application shutdown
completed and the process exited with code 0. No service is intentionally left
running by this task. Documentation endpoints were checked over HTTP, without
claiming browser rendering or external Swagger/ReDoc asset availability.

## Boundaries and acceptance

- Python 3.12 and a PDM environment matching the locked package versions are
  available. Startup and the complete existing suite ran successfully and their
  actual results are recorded above. BE-001 can be marked complete.
- This task establishes a baseline without changing application behavior. It is
  not a behavioral TDD cycle; no artificial failing test was introduced.
- Session-scoped TestClient/cookies, seeded-admin dependencies and three duplicate
  test method names remain BE-002 work. Passing this default-order suite does not
  prove test-order independence or coverage of overwritten definitions.
- No backend feature, persistence, auth migration, Google integration, production
  hardening or frontend integration was implemented. No Orval generation,
  frontend build, migration, database or provider test was needed or executed.
- README setup and its two malformed unit/integration commands were corrected;
  the separate tool environment was added to the ignore rules. No architecture,
  API or dependency-version change was needed.
- File-hash comparison covered 122 pre-existing Python/manifest/lock files:
  application source, tests and `pyproject.toml` stayed unchanged; only the
  documented `pdm.lock` metadata changed within that snapshot.
- The user's pre-existing Backlog formatting and FE-028 checkbox changes were
  preserved. Only BE-001's checkbox is updated by this task. Epic 06 and all
  subsequent tasks remain incomplete. No Stage, Commit, Push or branch operation
  was performed.
