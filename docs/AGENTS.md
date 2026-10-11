# Datano workspace instructions

## 1. Scope and instruction hierarchy

This is the single project-wide guide, stored at `docs/AGENTS.md` by the user's
explicit choice. Read it before every task, including work in either project,
then read the applicable specialized guide:

- [Frontend/AGENTS.md](../Frontend/AGENTS.md): frontend architecture, components,
  dependencies, API consumption, Persian/RTL, testing, and validation.
- [Backend/AGENTS.md](../Backend/AGENTS.md): backend architecture, persistence,
  authentication, security, mandatory TDD, and validation.

The project has exactly three engineering guides: this file and the two above.
Do not recreate a duplicate at the workspace root or add another guide without
an explicit request. Agents starting from `Frontend/` or `Backend/` must read
`../docs/AGENTS.md` explicitly as the shared policy.

Unless stated otherwise, paths in code spans are relative to the Datano workspace
root; Markdown links are relative to this document. Run commands from the project
directory identified below.

Follow explicit user instructions first. Apply directory-specific technical rules
within their scope, preserving stricter requirements such as mandatory backend
TDD. The communication, authorization, backlog, and completion rules here reflect
the user's project-wide instructions; historical descriptions of earlier practice
do not cancel them. Explain unresolved conflicts and obtain clarification before
performing work that depends on them.

All user-facing explanations, questions, plans, progress updates, and completion
reports must be **in Persian**. Technical terms, paths, commands, and identifiers
may remain English. Suggested Git commit messages must be professional English.
Engineering documentation and code retain their established language unless the
task explicitly requires otherwise.

## 2. Workspace context and sources of truth

| Location          | Current responsibility                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Frontend/`       | Next.js App Router application, invoice examples, shared UI, mock hooks/local routes, configured Orval generation; pnpm   |
| `Backend/`        | FastAPI layered application, auth/user/role APIs, in-memory mutable data, JSON permission/policy catalogs, Pytest; PDM    |
| `docs/`           | Shared product, MVP, and UX documents                                                                                     |
| `docs/backlog.md` | Designated source of truth for task selection, dependencies, acceptance criteria, and completion status; currently absent |

`Frontend/`, `Backend/`, and `docs/` are separate Git repositories. The user
authorized the documentation versioning decision; `docs/` uses an independent
local repository with no automatic commit, remote, or push. The workspace root
has no Git repository, package manifest, or shared build command. Run Git checks
from each affected repository. Do not merge repositories, initialize a root
repository, or move shared files without explicit authorization.

Read these sources when relevant:

- `docs/Datano_proposal.md`: product objectives, scope, data integrity, security,
  and approved target architecture.
- `docs/Datano_MVP.md`: the authoritative dated product/technical decisions,
  including delegated defaults, the five-entity model, and historical examples.
- `docs/datano-ux-pages-.md`: Persian/RTL screens, journeys, and explicit final
  UI scope. It is not an API contract.
- `Frontend/docs/cookbook/component-development-framework.md`: frontend feature
  conventions, interpreted alongside the actual examples and frontend guide.
- Affected source, tests, configuration, manifests/lockfiles, and actual OpenAPI:
  evidence of current technical behavior.

Distinguish **implemented behavior**, **confirmed requirements**, **proposals**,
and **known gaps**. Code establishes what currently runs; it does not replace
approved requirements. Backlog entries establish task scope/status, not invented
business rules or API contracts.

Datano's documented objective is a Persian marketing dashboard for verified
websites, Google data integrations, analytics, and evidence-based rule
recommendations. These product flows are not delivered by the current starter
and auth scaffolding. PostgreSQL/migrations, workers/caching, secure session
authentication, Google adapters, and production analytics are planned work,
not installed or validated capabilities.

Do not fabricate endpoints, provider scopes, schemas, production data, or
marketing claims. The user approved the target architecture and delegated
authentication, website policies, and analytics defaults. Read the dated decision
section in `docs/Datano_MVP.md` before related work; do not reopen resolved
questions or mistake those future requirements for current API behavior. Future
changes to these decisions require an authorized task.

Approved requirements and delegated choices:

- FastAPI/Next.js, PostgreSQL/SQLAlchemy 2/Alembic, and Celery/Redis are the target;
  Looker Studio is excluded. Preserve existing `Backend/app/` layers; conceptual
  domain boundaries do not authorize a `src/modules` migration.
- The final UX governs screens and read-only admin scope. Five domain entities
  are the current model; technical persistence records do not imply new domain
  entities or a five-table SQL limit. Shared website membership/transfer, Excel,
  JetSEO, payment, and rule-management UI are outside the current MVP.
- Product login is email-based; registration auto-activates ordinary User accounts.
  Admin emails are configured privately on the backend; prove email ownership
  before granting Admin. A user-supplied role/email alone cannot grant privileges.
- Target auth is a revocable opaque server-side session with a secure HTTP-only
  cookie, CSRF defenses, required email recovery, and remember-me behavior.
  Current JWT/refresh behavior remains an implementation gap to migrate in scope.
- Website analytics are owner-only. Use canonical hostname identity, independent
  subdomains, HTML proof, and the duplicate/deletion rules in the MVP decisions.
- Google sources are individually optional; a valid successful sync from one
  selected source permits a partial/empty report with independent source states.
  KPI mappings, periods, freshness, and versioned initial rules are specified in
  MVP; unavailable values must not become zero or fabricated recommendations.
- Product features are currently free. Landing preview is labeled explanatory
  media, not an invented public interactive demo. Existing Markdown is sufficient;
  original RFP/proposal/draw.io files are not prerequisites.

The two specialized AGENTS files remain unchanged at the user's request. Read this
shared guide explicitly even when working from a project root. Treat technical
snapshot descriptions as current behavior, not overrides of approved targets.
Correction to the backend guide's factory wording: plaintext password length is
validated by `CreateUserUseCase` using `UserEntity._validate_password`;
`UserEntity.create` validates email/username and receives an already hashed value.

Instruction consistency:

- The user requires automatic English Conventional Commit **suggestions** after
  explicitly requested implementation tasks; never execute the commit automatically.
- General TDD guidance is conditional; backend behavioral development has a
  stricter mandatory rule. Preserve that rule. Frontend test tooling is absent;
  do not invent a runner or claim automated tests exist.

## 3. Project map and development workflow

The frontend baseline uses Next.js 16.2.6, React 19.2.4, strict TypeScript,
Tailwind 4, Base UI/shadcn, TanStack Query, Axios, and Orval. The backend uses
Python 3.12, FastAPI, Pydantic settings, JOSE JWTs, bcrypt, and pagination.
Use each project's manifest and lockfile for exact supported dependency/runtime
versions; the specialized guides describe their constraints.

| Backend paths                                                                                | Responsibility                                                      |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Backend/app/main.py`, `Backend/app/infra/core/`                                             | Application assembly, lifespan, settings, middleware, logging, seed |
| `Backend/app/domain/`, `Backend/app/application/use_cases/`                                  | Entities, errors, business behavior, use-case orchestration         |
| `Backend/app/interface/`                                                                     | Controllers, DTOs, mappers, repository contracts, dependency wiring |
| `Backend/app/infra/repositories/`, `Backend/app/infra/services/`, `Backend/app/infra/utils/` | Concrete storage, password/token services, infrastructure helpers   |
| `Backend/statics/`, `Backend/scripts/`, `Backend/tests/`                                     | JSON catalogs, management scripts, unit/HTTP tests                  |

Keep business behavior in entities/use cases, HTTP adaptation in the interface
layer, and storage behind repository contracts. Existing framework couplings are
documented in the backend guide; do not claim complete layer isolation.
In-memory data resets with its process. Lifespan seeds the serving process;
a separate seed command cannot populate a different running process.

| Frontend paths                                                                          | Responsibility                                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Frontend/app/`                                                                         | App Router pages/layouts, styles, local route handlers                           |
| `Frontend/components/feature/item/InvoicesTable/`                                       | Reference feature: pure UI, concrete injectors, formatting/loading/error modules |
| `Frontend/components/ui/`, `Frontend/components/layout/`                                | Shared primitives, providers, layout shells                                      |
| `Frontend/data/feature/`, `Frontend/lib/`                                               | Domain data hooks, types, shared fetcher/utilities, generated clients            |
| `Frontend/orval.config.ts`, `Frontend/docs/cookbook/component-development-framework.md` | Generation configuration and component architecture                              |

Preserve page → concrete injector → data hooks/pure UI composition. Keep fetching
and cache management in data hooks and presentation props/translation/callbacks
in pure UI. Use the frontend guide and cookbook for detailed rules; existing
English invoices and randomized mocks are examples, not production features.

### Verified command entry points

Listing a command is not authorization to install, generate, migrate, or start
unrequested work. Check runtime/dependency prerequisites in the specialized guide.

| Working directory | Commands                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Backend/`        | `pdm install`; `make dev`; `pdm run pytest`; `pdm run pytest tests/unit/`; `pdm run pytest tests/integration/`; `pdm run pytest --cov=.`; `make lint`    |
| `Frontend/`       | `pnpm install --frozen-lockfile`; `pnpm dev`; `pnpm lint`; `pnpm exec tsc --noEmit --incremental false`; `pnpm build`; `pnpm start`; `pnpm api:generate` |

`make dev` and bare `pdm run uvicorn app.main:app --reload` use backend port 8000. `make dev PORT=8004` explicitly overrides it; the direct execution branch
in `Backend/app/main.py` uses 8004. Next.js development normally uses port 3000.
`pnpm start` requires an existing build. Backend `make lint` only compiles
`app/main.py`; it is not a full lint/type-check suite. No frontend test runner
or shared CI workflow is configured. Never report nonexistent checks as passed.

## 4. Cross-project API and environment coordination

- Verify the backend source and actual OpenAPI, not frontend mocks or wireframes,
  when establishing a contract. Routers are under `/api`, while the schema is
  served at `/openapi.json`; preserve operation paths and trailing slashes.
- Controller responses use `{ success, message, payload }`; user/role list
  payloads contain pagination. Framework errors are not universally enveloped.
  The shared Axios fetcher returns the body, not an automatically unwrapped payload.
- Login returns an access-token object at `payload`, with the token string at
  `payload.token`. Protected routes use bearer access tokens; refresh/logout use
  the HTTP-only `refresh_token` cookie. Coordinate credentials, CORS, and cookie
  flags within an authorized auth task. Production auth integration is incomplete;
  neither current development cookie settings nor frontend transport imply it works.
- Backend settings use `Backend/.env` and the example template. Frontend runtime
  transport reads `NEXT_PUBLIC_API_URL_V1`, while `Frontend/.env.example`
  currently lists `NEXT_PUBLIC_API_URL`. Use the name read by code and change
  templates only within scope.
- Orval requires `OPENAPI_JSON_URL` and a reachable compatible schema. For the
  default local backend, examples are `http://localhost:8000` for the runtime
  base URL and `http://localhost:8000/openapi.json` for generation. Generated paths
  already include `/api`; do not append it twice.
- `pnpm api:generate` produces functions, hooks, and models under
  `Frontend/lib/api/v1/`, which may not exist before generation and is Git-ignored.
  Do not hand-edit or commit this output as a workaround. Trace authorized schema
  changes through DTOs/controllers, generation/adapters, data hooks, and consumers.
- Next.js local user routes hold separate mock arrays and differ from FastAPI.
  Invoice hooks use mock data, and no invoice backend API exists. Do not treat
  either as a real backend integration.

## 5. Task intake, authorization, and scope control

Before editing:

1. Identify whether the request is analysis, planning, documentation, or
   implementation. Record the requested task ID, allowed files/components,
   acceptance criteria, and restrictions where supplied.
2. Read applicable instructions and relevant product documents, then inspect
   affected code, consumers, tests, configuration, and current Git status.
3. Identify dependencies, contract impacts, existing user changes, and missing
   information. State material assumptions and the intended approach in Persian.
4. Obtain authorization for any unresolved scope expansion or consequential
   decision before dependent work. Continue independent authorized work where
   possible; explain the specific reason approval is needed.

Implement the smallest complete, well-structured change within the authorized
scope. Necessary ordinary implementation choices already covered by the user's
request do not require repeated confirmation.

Without explicit authorization, do not install new dependencies or perform
upgrades, change architecture/database schemas/API contracts/sensitive
configuration, delete files, refactor unrelated code, or add product features.
A requested task may explicitly authorize these changes; do not request approval
again for the same authorization. Discovering an adjacent defect is not permission
to fix it.

Respect file restrictions even when a guide identifies a gap. Report out-of-scope
dependencies and issues without changing them. Do not use placeholders or mocks
to present an unavailable real integration as complete.

## 6. Backlog and Epic workflow

### Backlog management

`docs/backlog.md` is the central task/status record. It does not exist at the
time this guide was created. Do not create it, invent task IDs, or generate tasks
unless the user explicitly requests backlog work. An ordinary non-backlog task
does not require creating a backlog first.

When backlog creation/restructuring is authorized, use Markdown TODO checkboxes
(`[ ]` incomplete, `[x]` complete), organize tasks into Epics, assign unique
stable task IDs, and include priorities, dependencies, and acceptance criteria
where applicable. Preserve existing IDs and records during future changes.

Generate, restructure, reprioritize, or change task descriptions only when
explicitly requested. Automatic status updates are limited to the exception below.
Never select or implement a backlog task automatically.

### Epic planning and task implementation

- Plan only the Epic selected by the user. Review its tasks, requirements, source,
  dependencies, and risks.
- Provide a Persian plan covering technical approach, task order, affected
  components/files, testing, acceptance checks, dependencies, and material risks.
- Planning does not authorize implementation. Do not edit application code or
  rewrite the backlog during planning unless explicitly requested.
- Implement only explicitly requested tasks. Do not automatically start a
  dependency, related task, next task, or the rest of an Epic.
- If implementation requires work beyond its scope, explain that dependency and
  obtain authorization before doing it.

### Authorized completion-status updates

After implementing an explicitly requested backlog task, run required tests and
validation and verify every acceptance criterion.

- If implementation and required checks succeed, automatically change only that
  task's checkbox from `[ ]` to `[x]`. No further confirmation is needed.
- Preserve unrelated task statuses, IDs, descriptions, ordering, and formatting.
  Do not rewrite acceptance criteria to fit the implementation.
- If implementation is incomplete, checks fail/cannot run, or required criteria
  are unverified, leave the task unchecked and report the specific reason.
- An Epic checkbox may be updated only when every required task has verified
  completion. Do not infer completion from the current task alone.
- If the file/task ID is missing or ambiguous, report it; do not create, match by
  guess, or mark another task as a substitute.
- A stricter current file restriction that excludes backlog edits takes priority;
  report the pending status update.
- Updating a checkbox does not authorize starting another task. Stop after the
  requested operation, authorized status updates, and completion report.

## 7. Engineering, security, and change management

Preserve existing architecture and local conventions. Use the specialized guides
for layer/component rules, package managers, commands, and detailed security
requirements; do not introduce parallel tooling or speculative abstractions.

- Keep code typed, cohesive, readable, and maintainable. Validate untrusted data;
  avoid unexplained unsafe casts, broad suppressions, and weakened lint/type rules.
- Preserve backward compatibility unless a breaking change is explicitly
  authorized. Trace cross-project impact before modifying shared contracts.
- For an authorized API change, coordinate the actual OpenAPI contract, generated
  clients, and consumers. Never hand-edit generated output to conceal a mismatch.
  Obtain scope for required changes in the other project rather than editing it
  automatically.
- Keep secrets, credentials, sensitive data, and private tokens out of source,
  public variables, client bundles, logs, reports, and committed artifacts.
- Enforce authorization and future website ownership on the server. UI visibility
  is not an access-control boundary; keep protected data isolated across users.
- Preserve meaningful error states and diagnostics without leaking internals.
  Do not hide errors behind successful responses or fabricated analytics.
- Use existing PDM/pnpm manifests and lockfiles. Authorized dependency changes
  must keep declaration and resolution consistent.
- Measure before substantial optimization; do not add caching, workers, or
  arbitrary performance/coverage targets without a concrete authorized need.
- New product UI follows confirmed Persian/RTL and accessibility requirements.
  English examples and canonical API values do not justify unrelated translation
  or data-format changes.
- Within scope, document changed contracts, setup, and important decisions.
  Keep current behavior separate from plans; do not rewrite unrelated documents.

## 8. Testing, validation, and Definition of Done

For behavioral changes, follow **Red → Green → Refactor** wherever feasible,
with mandatory backend TDD as specified in `Backend/AGENTS.md`:

1. Reproduce the defect or requested behavior in a deterministic test; run it and
   confirm failure for the intended behavioral reason.
2. Implement the smallest complete solution and confirm the focused test passes.
3. Refactor with passing tests, then run affected regressions and the required
   project validation.

For behavior-preserving refactors, establish characterization coverage first.
Never weaken, remove, skip, bypass, or suppress tests merely to obtain a pass.
Use isolated fixtures and controlled inputs; routine tests must not rely on
production systems, live Google services, randomness, or execution order.

Use real commands from the specialized guide and current configuration. Backend
Pytest exists; frontend has no runnable automated test setup. Do not call lint,
type checks, or manual review automated TDD. New tooling/dependencies require
authorized scope; report absent infrastructure and skipped checks honestly.

Documentation-only tasks need reference/content/Markdown and file-scope checks,
not application tests, dependency installation, client generation, or migrations.
A failed or unavailable check is not a pass. Do not assume an existing failure
without baseline evidence.

A task is complete only when its authorized scope and acceptance criteria are
satisfied, required validation has succeeded, and the final diff is reviewed.
Check changed, staged, and untracked files in each affected repository; for any files outside these repositories, verify contents and file scope directly. Preserve
unrelated changes and exclude secrets and unintended generated/build artifacts.
Report incomplete work or blockers instead of declaring success or checking off
the task.

## 9. Git and operational safety

Never create commits, push, merge, switch branches, or perform destructive Git
operations without explicit user authorization. Do not stage files automatically.
Review and explain the affected repository and scope before consequential
operations. Do not discard existing user changes to obtain a clean state.
Before suggesting a commit message for any change, inspect the actual diff and
identify which part or parts of the workspace the change affects.

Do not deploy, publish, execute database migrations, reset storage, or run
destructive cleanup unless explicitly authorized. A plan, successful test run,
backlog checkbox, or suggested commit message does not grant such permission.
Do not invent a branch, release, CI, or deployment policy.

**Monorepo structure and Git scope**

The Datano workspace is a monorepo managed by a single Git repository at the workspace root. The `Frontend/`, `Backend/`, and `docs/` directories are parts of the same repository, not independent Git repositories.

All Git operations must respect the shared repository structure. Before proposing a commit, inspect the actual diff and identify the affected workspace areas.

Use clear, conventional commit messages with appropriate scopes when applicable, such as `feat(frontend):`, `fix(backend):`, or `docs:`. For changes spanning multiple areas, choose a message that accurately describes the overall change.

Do not assume that changes across different workspace directories belong in the same commit. Group related changes logically and never stage or commit unrelated changes.

## 10. Automatic completion reports

After each explicitly requested implementation task, automatically provide a
Persian technical report without waiting for another request:

1. What changed, why, and the relevant implementation decisions.
2. Actual modified files, with usable links.
3. Exact executed tests/checks and results; distinguish automated and manual
   validation and report TDD evidence where applicable.
4. Skipped/blocked checks with reasons, remaining issues, risks, unverified
   acceptance criteria, and compatibility/contract impact.
5. Backlog task ID/status and any authorized Epic status change, or explicitly
   state that the task is outside the backlog or its record is unavailable.
6. Exactly one concise, accurate English Conventional Commit suggestion:
   `<type>(optional-scope): imperative description`. Match the actual change;
   mark breaking changes only when present. A suggestion is never an executed
   commit; state accurately whether a commit was authorized and created.

For analysis, planning, and guide-creation requests, provide the requested
findings/artifact and actual validation; do not perform implementation follow-ups
or backlog completion updates merely because the report is ready.

Stop after reporting the requested work. Wait for explicit authorization before
planning another Epic or implementing any additional task.
