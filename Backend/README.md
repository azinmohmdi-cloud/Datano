# Datano backend

FastAPI 0.115.6 layered application managed by PDM, requiring Python 3.12.
Read [the shared workspace instructions](../docs/AGENTS.md) and
[the backend engineering guide](AGENTS.md) before work. The approved target
and delegated defaults are in [the MVP document](../docs/Datano_MVP.md);
[the UX specification](../docs/datano-ux-pages-.md) limits the admin product UI to viewing.

## Outbound SMTP adapter (BE-011 — verified)

The application mail port is `IEmailSender` / `OutboundEmail` in
`app/application/use_cases/auth/email.py`. The `SMTPEmailSender` infrastructure
adapter uses Python 3.12's standard `smtplib`, `ssl`, and `EmailMessage`; no new
package, route, migration, queue or verification-code flow is introduced.
The frontend and public signup terms lock are unchanged.

**BE-011 is complete:** one owner-approved Gmail STARTTLS submission on port 587
succeeded, and the owner separately confirmed Inbox receipt and correct message
rendering on 2026-10-21. The App Password was supplied privately by the owner.
No additional real message was sent during final validation. Fake credentials
and `.test` mailboxes exist only in isolated tests and are not application
configuration. See the validation record for separate automated and real-delivery
evidence; local protocol tests alone do not verify inbox delivery.

The approved local preparation uses `Backend/.env.be011.local`, ignored by the
existing `.env.*.local` rule and restricted to mode `0600`. The owner maintains
`SMTP_PASSWORD` privately. The smoke CLI receives
only the absolute file path through `--env-file`; `Config(_env_file=...)` loads
the credential internally. Do not pass the password as an argument, echo the
file, or source it into a diagnostic shell. Existing process environment settings
take precedence in Pydantic; before a controlled send, check for SMTP overrides
without displaying their values. This dedicated file is not auto-loaded as the
application's normal `.env`.

SMTP is disabled by default. When enabled, startup validates the private
configuration before opening PostgreSQL, without connecting or sending mail.
The `get_email_sender` dependency exposes the configured application-scoped
adapter; a disabled sender fails explicitly instead of returning simulated
success. Existing deployments can continue with SMTP disabled until the later
email workflows are connected.

Prepare these values in an ignored private `Backend/.env` or an external private
settings file; never commit them or use frontend/public variables:

| Setting | Required value |
| --- | --- |
| `SMTP_ENABLED` | `true` when intentionally enabling the real adapter |
| `SMTP_HOST` | Provider's bare SMTP hostname or IP, without URL scheme or port suffix |
| `SMTP_PORT` | Provider's actual port; 1–65535 (default 587) |
| `SMTP_SECURITY` | `starttls` (default) or implicit `tls`; commonly port 465 for implicit TLS, as specified by the provider |
| `SMTP_USERNAME` | Private SMTP AUTH username |
| `SMTP_PASSWORD` | Private SMTP password/app password or provider-issued SMTP credential; preserved verbatim |
| `SMTP_FROM_EMAIL` | One sender mailbox authorized/verified by the provider |
| `SMTP_TIMEOUT_SECONDS` | Per-blocking-operation timeout, >0 and <=60 seconds (default 10); not a total DNS/send deadline |
| `SMTP_CA_FILE` | Optional trusted private CA bundle; system roots are used otherwise |

SMTP AUTH uses the standard library's supported username/password mechanisms
and ASCII credentials; this restriction does not apply to product account
passwords or Persian email text. OAuth-only provider authentication is not
implemented. Certificate and hostname verification and a TLS 1.2 minimum are
mandatory; there is no plaintext or certificate-check bypass mode. STARTTLS is
negotiated before AUTH and followed by a new EHLO. Each message has one explicit
recipient/envelope, plain Persian UTF-8 content with seven-bit transfer encoding,
and no CC/BCC. Header/control injection is rejected before I/O.

### Private controlled check

From `Backend/`, validate an operator-provided settings file **without network
I/O**:

```sh
pdm run python -m scripts.send_test_email --env-file /absolute/private/settings.env
```

Only after the owner approves one recipient, submit exactly one harmless test
message using `--to OWNER_APPROVED_MAILBOX --send`. Replace the uppercase token
with the actual approved address; it is not a configured/test recipient. The
tool never auto-selects a recipient or generates an authentication code.

```sh
pdm run python -m scripts.send_test_email --env-file /absolute/private/settings.env --to OWNER_APPROVED_MAILBOX --send
```

An exit 0 without `--send` means offline configuration validation only. With
`--send`, it means the SMTP relay accepted DATA, **not that inbox receipt was
confirmed**. Exit 2 means loading/configuration-file failure; exit 3 exposes only
safe failure classification and `retryable` / `delivery_unknown` flags. Disabled
or incomplete adapter configuration is classified `configuration`. No credentials,
recipient, message content, code, provider response or raw traceback is printed.
Confirm receipt in the approved mailbox separately before marking real delivery
verified. No HTTP/debug send endpoint is exposed.

Failures distinguish configuration, invalid message, TLS, authentication,
recipient/sender/message rejection, timeout, connection and protocol errors.
Raw SMTP exceptions/responses are not retained in the raised exception context
or logged. The adapter never retries: a timeout/disconnect during DATA can have
an unknown delivery result and must not trigger blind duplicate sends. QUIT or
socket-close failure after accepted DATA does not turn success into a resend.
Socket I/O runs in a worker thread; canceling the caller does not guarantee a
thread's SMTP operation stopped or that no mail was accepted. Later challenge
flows must handle this boundary explicitly without assuming rollback of email.

### Independent tests

```sh
pdm run pytest tests/unit/test_smtp_config.py tests/unit/test_smtp_email.py tests/unit/test_email_dependencies_and_smoke.py tests/integration/test_email_boundary.py tests/integration/test_smtp_wire.py
# Full suite also needs the dedicated DATANO_TEST_DATABASE_URL described below.
pdm run pytest
```

The loopback SMTP tests generate temporary certificates, perform actual TLS/AUTH
and MIME transfer against a local fixture, and cover failed TLS/auth without an
external provider or real mailbox. Local TCP socket permission is required. The
certificate generator uses the already-locked `cryptography` dependency; no new
dependency is installed. See
[BE-011 validation](docs/validation/BE-011-email-adapter.md) for executed results,
TDD evidence, limitations and the completed real-delivery verification.

## Shared email codes (BE-012)

`EmailCodeService` provides internal `issue(context)` and `consume(context, code)`
operations for password recovery, admin email proof and email change. It does
not create endpoints, grant privileges, change passwords/emails, or issue a
recovery session. Those account workflows belong to BE-013/014/016. No frontend
or public OpenAPI contract changes here.

The approved policy is fixed: eight cryptographically random ASCII digits
(including leading zeroes), 600-second lifetime, at most five verification
attempts and at least 60 seconds between issues for the same context. The fifth
attempt may succeed; expired, exhausted, consumed and pending codes fail closed.
Malformed guesses also consume attempts. Reissuing resets the attempt budget
and invalidates the old code before mail I/O; a repeated RNG sample cannot
reissue the immediately preceding numeric code.

Provision `EMAIL_CODE_HMAC_KEY` privately with at least 32 random bytes, separate
from SMTP, CSRF and JWT secrets. It has no default or fallback. The settings field
is optional while no code workflow is used; `get_email_code_service` refuses a
missing/short key and requires the existing configured mail sender. No deployment
key is created by the tests or this task. Key rotation invalidates existing
challenges and changes their scope/cooldown keys; plan rotation operationally.

The trusted caller must construct `EmailCodeContext` from its server-side purpose,
stable account subject and intended recipient, then re-check account authorization
when applying proof. Canonicalization is only trim/lowercase, preserving dots and
plus tags. HMAC-SHA256 binds the code to this context using versioned framing and
domain separation. Only HMAC scope/code digests and technical lifecycle metadata
are stored; plaintext code, recipient, account identifier, key and email body are
absent from the challenge table. No code is returned by `issue`, included in repr
or logged. The plaintext is handed only to the existing private email adapter.

`PostgresEmailCodeRepository` owns short, independently committed transactions;
the HTTP/account transaction cannot roll back a failed-attempt counter. A scoped
advisory lock serializes first issuance, and row locks serialize resend and
consumption across workers. Production wall time is sampled after locks. SMTP
runs outside transactions. Pending proofs become usable only after relay
acceptance and only if that generation is still current and unexpired. Failure,
unknown delivery, cancellation or process failure leaves them unusable, keeps
cooldown, and performs no retry. A late old send cannot activate a newer proof.

Revision **`0006_email_codes`** introduced the shared challenge table; BE-013
adds the current head described below. Apply migrations to a privately
configured target with `pdm run alembic upgrade head` before using the service;
application startup does not run migrations. It adds only `email_code_challenges`.
Downgrade to `0005_opaque_sessions` invalidates challenges by dropping that table
and preserves users, roles, counters and sessions. The previous session migration
regression explicitly targets revision `0005` rather than assuming it remains head.

Routine validation uses controlled clocks, test-only keys, a capture sender and
real PostgreSQL; it sends no real email. Public per-IP throttling, account
existence-neutral responses and the restricted recovery session must be wired in
the later HTTP workflows before exposure. No public sending route is provided.
See [BE-012 validation](docs/validation/BE-012-email-codes.md) for acceptance evidence.

## Password recovery (BE-013)

The backend exposes three additive routes, all under the existing Origin/CSRF
middleware and recovery-only bounded-body/per-IP guard:

| Method / route | Input | Result |
| --- | --- | --- |
| `POST /api/auth/password-recovery/request` | `email` | `200` generic acknowledgement with null payload; same status/body/cookie behavior for known, unknown, inactive and account-cooldown cases |
| `POST /api/auth/password-recovery/verify` | `email`, `code` | Consumes BE-012 proof and sets a restricted recovery cookie; payload contains only `expires_in` and a rotated `csrf_token` |
| `POST /api/auth/password-recovery/reset` | `password`, `password_confirmation` | Requires the recovery cookie, atomically changes the hash and revokes all target-account sessions; clears browser credentials and returns no login/token |

All fields outside these DTOs are rejected. Email identity uses existing
trim/lowercase rules. The new password/confirmation must match exactly and
follow the existing 15–128 Unicode-character policy; hashing remains Argon2id.
Malformed-body diagnostics redact submitted credential values. Responses use
the existing envelope and `Cache-Control: no-store`; shared CSRF rules apply to
every mutation, including unauthenticated request/verify/reset.

The request body is sent before any account lookup or SMTP operation. An
in-process Starlette background task then dispatches through BE-012/BE-011.
This avoids putting account lookup, cooldown or SMTP latency in the response
body's critical path. It is **not a durable queue**: process termination can lose
an accepted request; the acknowledgement never certifies delivery. Background
failures log only a static operation/class, not provider text, codes, email or
credentials. Missing SMTP/HMAC setup returns the same `503` for every email.
No external SMTP call or new real email was used in BE-013 validation.

The default peer limit is 10 attempts per 600 seconds across all three routes,
separate from login/registration. `RECOVERY_IP_LIMIT`, `RECOVERY_WINDOW_SECONDS`
and `RECOVERY_MAX_BODY_BYTES` (default 8192) configure these technical limits.
The actual socket peer is used; client forwarding headers are not trusted.
BE-012 provides the account-context cooldown and five-attempt code budget.

After verification, `__Host-datano_recovery` contains a separate 256-bit random
capability with a recovery-specific prefix/domain-separated SHA-256 digest.
Only the digest is stored. The cookie is Secure, HttpOnly, SameSite=Lax, Path=/,
without Domain, and has a bounded Max-Age. The existing explicit localhost HTTP
opt-in uses `datano_recovery_dev` instead. `RECOVERY_GRANT_SECONDS` defaults to
600 and cannot exceed 600; expiry is absolute and not extended by validation.
Only the latest grant per account remains usable. A recovery capability is
rejected as a normal opaque session, and a normal session/JWT/code cannot reset
a password in place of that cookie. OpenAPI documents `PasswordRecovery` only
on reset; existing product endpoints retain `OpaqueSession`.

The grant and code scope bind to a one-way fingerprint of account ID, canonical
email and the current salted password hash. Changing email/password or disabling
the account invalidates old proof. Even a legitimate legacy-hash upgrade can
therefore require a fresh recovery request. No duplicate password hash is stored
in the grant table. Grant creation and reset lock the account before grant/session
records, matching login's lock ordering. Login re-verifies under that lock, so
an in-flight old-password login cannot create a surviving session after reset.

Reset writes the new hash, consumes all account recovery grants and calls the
existing session repository's bulk revocation in **one transaction**. Failure
rolls all of them back. Other accounts' sessions remain intact. The client must
sign in through normal login afterwards; no user activation or role change occurs.
Code consumption precedes grant storage in a separate BE-012 transaction: a
grant-storage failure consumes proof safely and requires a fresh code request.

Current Alembic head is **`0008_admin_grants`**. Upgrade a privately
configured target with `pdm run alembic upgrade head` before serving this code.
Startup probes required tables and rejects an outdated schema; it never
migrates automatically. Recovery revision `0007_password_recovery` adds only `password_recovery_grants` with
a cascading user foreign key, one grant per account and digest/lifetime checks.
Downgrade to `0006_email_codes` drops recovery grants without changing identities,
email challenges, counters or normal sessions. No non-test database was migrated.

Provision the serving process's SMTP settings and private `EMAIL_CODE_HMAC_KEY`
before exposing recovery. The BE-011 CLI file is not automatically the serving
app's environment. BE-011 has real SMTP/Inbox evidence; BE-013's entire API flow
was tested with an isolated capture sender and real PostgreSQL. Additional live
delivery/browser integration belongs to explicitly authorized follow-up work.
Frontend forms and generated clients were not changed. See
[BE-013 validation](docs/validation/BE-013-password-recovery.md).

## Verified administrator authority (BE-014)

`ADMIN_EMAIL_ALLOWLIST` is a private server-only JSON array of eligible mailbox
addresses. It defaults to `[]`, is canonicalized with trim/lowercase only, and
is excluded from settings serialization/repr. Keep actual addresses in a private
Git-ignored backend environment file or secret manager; never expose them through
frontend variables, generated clients, responses or logs. All serving workers
must use the same configuration. Private eligibility is checked on every identity
read: removing an address removes its effective Admin permissions immediately.

Public registration always creates an active User, including an eligible address.
Neither an existing raw Admin assignment nor the generic role-assignment API can
create verified administrator authority. Existing Admin assignments are **not**
automatically trusted/backfilled by migration. Operators must provision or prove
them explicitly. Ordinary/custom legacy role CRUD remains unchanged; a custom
permission role is never interpreted as the product Admin role.

Two self-only, session-authenticated endpoints reuse the existing Origin/CSRF
boundary, secure cookie profile, envelope, SMTP adapter and shared BE-012 codes:

| Endpoint | Strict JSON body | Result |
| --- | --- | --- |
| `POST /api/auth/admin-email/request` | `{}` | Generic `200` acknowledgement; background dispatch only for an eligible active account |
| `POST /api/auth/admin-email/verify` | `{code}` | Consumes proof and returns the existing public login payload with authoritative `effective_role` and rotated `csrf_token` |

No body-selected email, account ID or role is accepted. Request acknowledgement
never proves eligibility or delivery. SMTP failure is safely observable without
provider text/codes; an undelivered code cannot elevate authority. This uses the
existing in-process background task, not a durable email queue. Required private
SMTP settings and `EMAIL_CODE_HMAC_KEY` must be loaded by the serving process;
the BE-011 smoke tool's private file is not loaded automatically.

Codes remain eight ASCII digits, HMAC-only at rest, single-use, valid for 600
seconds, with five guesses and a 60-second resend interval. Their scope binds to
account ID, canonical mailbox and existing salted password-hash fingerprint, and
is shared across that account's sessions. A password/email change requires a new
code. A new issuance invalidates its predecessor. Peer safeguards use the separate
`admin-email` counter namespace: `ADMIN_PROOF_IP_LIMIT=10` per
`ADMIN_PROOF_WINDOW_SECONDS=600`, body limit `ADMIN_PROOF_MAX_BODY_BYTES=8192`.
These are technical defaults, independent of registration/login/recovery quotas.

Revision `0008_admin_grants` adds only the technical `admin_grants` table, with
account/role cascading foreign keys, one proof/account, canonical email,
32-byte role-state fingerprint and constrained method (`email`/`provisioning`).
Run `pdm run alembic upgrade head` against a privately configured, approved target
before starting the new backend. Startup rejects a missing authority table and
never applies migrations automatically. No non-test database was migrated in
BE-014. Downgrade to `0007_password_recovery` drops authority only, retaining
identity, session and recovery data; a later upgrade requires fresh proof.

Proof storage, Admin assignment, revocation of **all** older account sessions and
issuance of the replacement digest share one PostgreSQL transaction. The current
session and account state are rechecked under the existing user-before-session
lock ordering. Expiry during promotion aborts all writes. The new identifier and
CSRF token rotate; remember-me behavior is retained and the previous absolute
session cap is never extended. Other accounts are unaffected. Code consumption
commits before promotion: a promotion failure burns that code safely and requires
requesting a fresh one after the normal resend interval.

Authority is checked against the current active Admin role and its versioned
fingerprint. Editing/deactivating/reactivating that role requires fresh proof;
changing an account's email or activation state deletes prior authority so moving
back cannot restore it. Existing account/password contracts are unchanged.

For trusted **private server provisioning**, the operator must already control
server settings/database access. This CLI creates no user, password or role,
sends no email, accepts no public HTTP input and requires explicit mutation intent:

```sh
# Prepare Backend/.env.be014.local privately (ignored by .env.*), mode 600.
# Include DATABASE_URL and ADMIN_EMAIL_ALLOWLIST for the approved target/account.
# Confirm the existing account ID privately; do not paste settings into chat/logs.
pdm run python -m scripts.provision_admin --env-file .env.be014.local --user-id EXISTING_USER_ID --provision
```

The CLI verifies the existing active account, private eligibility and active Admin
role, stores `method=provisioning` and revokes all older sessions atomically. Sign
in again to obtain a fresh verified Admin session. Missing file/intent or invalid
configuration/storage returns exit `2`; ineligible/missing account/role returns
`3`; success returns `0`. Output omits account, allowlist and connection details.
No real account was provisioned and no live administrator email was sent for
this task. No Frontend page, public-signup release lock or generated client changed.
See [BE-014 validation](docs/validation/BE-014-admin-authority.md) for results.

## Own profile (BE-015)

The existing `GET /api/auth/me` remains the single read contract for the current
account, including public user fields and the server's `effective_role`.
`PATCH /api/auth/me` adds a names-only partial update under the same opaque-session
cookie and Origin/session-bound CSRF boundary. No CRUD permission or client user
ID is required or accepted for this operation; the owner comes from the session.

```json
{"first_name": "نام تازه", "last_name": "نام خانوادگی تازه"}
```

At least one name must be supplied. An omitted name is preserved; explicit null,
non-string values, an empty patch and all unknown fields return `422`. Only
`first_name`/`last_name` are writable. In particular, ID, email, username, password,
role, effective role, permissions and activation cannot be changed through this
contract. Client identity hints in query strings do not select an account.
Email changes use the separate proof workflow in BE-016 below. Frontend name
editing is integrated in FE-032; email-change integration remains FE-033.

Names must contain non-whitespace text and be representable as valid PostgreSQL
UTF-8 text (no unpaired surrogate or U+0000). The current UI/registration convention
has no approved maximum name length: no new length limit, trimming, case-folding,
Unicode normalization or character-set restriction is introduced. Persian names,
ZWNJ, combining characters and outer whitespace spelling are preserved.

Success is the existing `{success,message,payload}` envelope with the same
`CurrentUser` payload as GET, including filtered roles and authoritative
`effective_role`. Responses have `Cache-Control: no-store`. Name editing neither
rotates nor replaces the opaque/CSRF cookies and grants no additional permission.
Ordinary session validation still touches idle activity under the existing policy.
Invalid/expired/revoked sessions and inactive/deleted accounts return `401`;
failed Origin/CSRF returns `403`. Credential-shaped validation inputs are redacted
from `422` detail responses, even when sent as forbidden extra fields.

Domain validation completes before any name/timestamp mutation. The use case
works on a detached candidate so shared in-memory adapter objects remain intact
on rejection or write failure. The repository's narrow `update_profile_names`
contract writes only supplied names and `updated_at` for an existing active
account. It cannot restore an old email/hash/activation value from a stale entity,
and concurrent disjoint name patches preserve each other's changes. PostgreSQL
uses the existing request transaction and session/user locking; failed writes
roll back both names. Other users, roles, verified Admin grants and credential
records remain intact. Existing permission-guarded legacy user CRUD is unchanged;
the profile endpoint grants no access to those operations.

No schema, Alembic revision, dependency, environment setting or frontend file
changes are needed. Database head remains `0008_admin_grants`. The real database
tests use a disposable task-owned tmpfs PostgreSQL with independent per-test
schemas. See [BE-015 validation](docs/validation/BE-015-own-profile.md) for executed
checks, acceptance evidence, exact file scope and operational limits.

## Verified email change (BE-016)

Only the current active opaque-session owner can use these routes. Origin and
session-bound CSRF are required; JWT, selected user IDs, roles and activation
fields are not accepted. The names-only profile contract remains unchanged.

| Route | Strict body | Result |
| --- | --- | --- |
| `POST /api/auth/email-change/request` | `{email}` | Generic `200` acknowledgement; sends a code to an available new mailbox through the existing private SMTP adapter |
| `POST /api/auth/email-change/verify` | `{email,code}` | Public `SessionLogin` payload with updated user, authoritative `effective_role`, rotated CSRF token and a new opaque cookie |

Request acknowledgement does not confirm delivery or reveal whether an email
is occupied. The current/occupied address receives the same acknowledgement and
no message. Both DTO fields are write-only in OpenAPI; validation errors never
echo the email, code or forbidden credential-shaped extra inputs. Invalid proof
or session returns `401`, CSRF/Origin `403`, a target claimed before confirmation
`409`, oversized body `413`, quota exhaustion `429` with `Retry-After`, and
unavailable private infrastructure `503`. Success responses are `no-store`.

The email remains unchanged until the new mailbox code is consumed. Validation
uses the existing email entity rule plus the shared mail-context/header-safety
checks. The new email and identity key use trim/lowercase, without provider alias
rules. Codes reuse BE-012: eight ASCII digits, private HMAC, ten-minute expiry,
five attempts, single use, at least sixty seconds between sends. One scope per
account/current-email/password state shares cooldown and attempts across all
browsers and destination addresses. The target is independently bound into the
code digest. A resend to another target replaces the prior pending challenge;
only the delivered latest generation can be consumed. Other code purposes keep
their existing HMAC format. No plaintext pending email/code or new table is needed.

Confirmation rechecks the session, active account and credential-state snapshot
under the user lock. One PostgreSQL transaction narrowly updates email/key and
timestamp, removes prior Admin authority/assignment, reevaluates the private
allowlist and active Admin role, invalidates existing recovery authorization,
revokes every old account session and creates the replacement session. The
existing unique constraints arbitrate concurrent claims; the losing account's
fields, roles and sessions roll back together. Names, hash, activation, internal
username and unrelated users are preserved. An allowlisted target gets a fresh
mailbox-proved grant only after proof; a noneligible target gets no Admin grant.
Active User fallback is assigned without reactivating any disabled role.

Every successful email change rotates the current session and CSRF identifier,
including ordinary User-to-User changes. This defensive implementation satisfies
the MVP's required rotation on privilege changes. It retains `remember_me` and
never extends the preceding absolute expiry. Other browsers must log in again
using the proved new address. Code consumption commits before the final identity
transaction: a failed commit burns the proof safely, while account writes roll
back; request another code after cooldown. SMTP runs outside database locks in
the existing process-local background task, with no durable delivery queue or
automatic resend. A failure reading public identity after commit can require a
fresh login with the new address; it cannot restore old sessions.

Required private SMTP/HMAC settings are the existing BE-011/012 settings. The
independent technical peer bucket has `EMAIL_CHANGE_IP_LIMIT=10` per
`EMAIL_CHANGE_WINDOW_SECONDS=600`, shared across request/verify; full body limit
`EMAIL_CHANGE_MAX_BODY_BYTES=8192`. Quotas run before JSON parsing and failed
requests consume attempts. All workers must share settings, HMAC key and DB.
No schema migration or dependency change is required; head remains
`0008_admin_grants`. Actual OpenAPI and real PostgreSQL validation are recorded
in [BE-016 validation](docs/validation/BE-016-email-change.md). BE-016 tests capture
the mail adapter; no additional live email was authorized/sent for this task.
Frontend/UI changes and generated-client integration belong to FE-033.

## Website model and persistence (BE-017)

`WebsiteEntity`, `IWebsiteRepository` and `SQLWebsiteRepository` add the first
website storage boundary. BE-017 itself adds no HTTP route, HTML fetch, challenge
issuer or Frontend integration. Website HTTP operations are documented under
BE-018 below; HTML fetch/proof and Frontend integration remain separate tasks.

- Hostname identity uses lowercase, UTS #46 nontransitional IDNA and removal of
  the final dot. `www`, parent and child hostnames remain separate; `faß.de` does
  not collapse into `fass.de`. Explicit direct dependency `idna>=3.11,<4` reuses
  the already installed/locked 3.11 version; no package version/hash changed.
- The entity accepts a hostname and explicit `http`/`https` scheme, not a URL.
  URL parsing is supplied by BE-018 below; public DNS/SSRF checks belong to BE-019. Hostname
  syntax rejects IP forms, local names, credentials, paths and invalid IDNA.
- A new record is **unverified**, with a 24-hour reservation and no challenge.
  Storage accepts only a 32-byte digest with consistent issue/expiry timestamps;
  plaintext proof tokens have no storage field. Challenge expiry is exactly 24
  hours after issue. Pending/expired/verified status derives from persisted
  timestamps; expired reservations never imply proved ownership.
- Each website has one required owner; an owner may have multiple websites.
  The owner foreign key uses `RESTRICT`: account CRUD cannot orphan or silently
  remove websites. Account deletion with sites is not an implemented product
  workflow. Full site deletion and integration/job cleanup remain BE-042.
- A partial unique index allows one **current** row per canonical hostname.
  `claim()` holds a transaction-level advisory lock for that hostname and a row
  lock when one exists. A same-owner repeat returns the existing ID/state without
  extending its reservation or changing its scheme. Another owner's live
  reservation or verified website produces only `Website is unavailable`.
- After an unverified reservation expires, another owner can create a fresh ID.
  The old row keeps its original owner/identity and receives `released_at`.
  Owner-scoped reads exclude released records; no proof or history is transferred.
  Replacement and release share the caller's transaction and roll back together.
- `save_verification()` is a persistence primitive for a later authorized proof
  workflow. It requires an unchanged owner/identity and optimistic timestamp,
  shares the hostname lock, and rejects stale/released/terminal state. It neither
  checks HTML nor establishes proof by itself. There is no transfer/delete or
  generic mass-assignment update method.

Run the existing migration command against an explicitly selected environment:

```sh
pdm run alembic upgrade head
```

Revision **`0009_websites`**, following `0008_admin_grants`, adds only `websites`
and its constraints/indexes. Startup now refuses a schema without this table;
it never creates or migrates schema automatically. Downgrading to
`0008_admin_grants` removes website records and is destructive for that feature;
it preserves identity/authority/session tables. The upgrade/repeated-upgrade/
downgrade checks run only on isolated PostgreSQL test schemas, never an existing
application database. Make a backup and use an authorized environment migration
process for deployment.

Focused checks (dedicated `DATANO_TEST_DATABASE_URL` required):

```sh
pdm run pytest tests/unit/test_website_entity.py \
  tests/integration/test_website_persistence.py tests/integration/test_website_migration.py
pdm run pytest
```

See [the Persian BE-017 validation report](docs/validation/BE-017-website-persistence.md)
for executed results, TDD evidence and scope limits.

## Own website API (BE-018)

These endpoints derive the owner exclusively from the current active opaque
session. An ordinary User needs no administrative users-CRUD permission; Admin
receives no exception to website ownership. Query owner hints cannot select an
account and additional creation-body fields are rejected.

| Endpoint | Request / result |
| --- | --- |
| `POST /api/websites/` | Strict JSON `{ "url": "https://example.com/" }`; HTTP 200 and the public website envelope for both a new reservation and an existing same-owner registration |
| `GET /api/websites/` | Owner-only list, with existing `page`/`size` pagination inside `payload`; stable creation-time/ID ordering, maximum page size 100 |
| `GET /api/websites/{website_id}` | The owner's current site only; an unknown, foreign or released ID returns the same static HTTP 404 |

All use the existing `{success,message,payload}` envelope. Public website fields
are `id`, `hostname`, `scheme`, canonical root `url`, `is_verified`,
`challenge_status`, `reservation_expires_at`, `challenge_expires_at`,
`verified_at`, `created_at` and `updated_at`. Owner IDs, email, raw proof tokens,
challenge digests and released history are never serialized. State/expiry
metadata does not certify successful proof or report readiness. New records are
unverified and have no issued challenge. Private results and website errors use
`Cache-Control: no-store`; ordinary route responses also vary by Cookie.

The creation URL must be an HTTP(S) homepage with only an optional root slash.
Outer whitespace is trimmed. Credential-bearing authorities, custom/mismatched
ports, path/query/fragment markers (even empty ones), backslashes, internal
whitespace/control characters, IP representations, local names and invalid IDNA
are rejected before a permissive parser could normalize them away. Explicit
matching default ports (HTTP 80 / HTTPS 443) are aliases and disappear from the
canonical URL. `www`, parent and subdomains remain independent. URL syntax is
validated here. **BE-019 now provides the safe HTML receipt port and adapter**
described below; actual proof remains BE-020. Registration performs no outbound fetch.

The BE-017 repository still arbitrates duplicate/expiry rules atomically. A
repeat by the same owner keeps the original ID, scheme and reservation deadline,
including an expired pending record; it does not renew or synthesize a challenge.
Another owner's live reservation or verified site produces only HTTP 409,
`Website is unavailable`, with empty details. An expired unverified reservation
can be replaced with a fresh ID; the old owner cannot read the released record
and the new owner inherits no proof/history.

The creation use case receives its clock through dependency injection. Serving
uses PostgreSQL wall time from the same request transaction, avoiding rejection
of legitimate registrations when the application host clock is slightly ahead
of the database. No submitted timestamp, owner or verification state is accepted.

Authentication remains the existing opaque cookie; a bearer JWT cannot replace
it. POST also requires trusted Origin and session-bound `X-CSRF-Token`, enforced
by the existing global middleware before routing. Missing/invalid/expired/revoked
sessions and inactive accounts return 401 once CSRF validation succeeds. Invalid
Origin/CSRF returns 403; invalid URL/strict DTO/pagination returns 422; occupied
hostname returns 409; foreign/missing website returns 404. DTO/JSON errors omit
input values, including forbidden credential fields.

No schema revision, dependency/configuration change or new mutation other than
registration is introduced. Delete/transfer/update/verification routes are not
part of this API task. The actual OpenAPI has 23 paths; all prior operations and
schemas remain unchanged. Both ignored Orval targets were regenerated from it,
and generated consumers, TypeScript and transport were checked. FE-034 still
owns wiring the approved website UI to these endpoints.

Focused checks require a dedicated `DATANO_TEST_DATABASE_URL`:

```sh
pdm run pytest tests/unit/test_website_api_use_cases.py tests/integration/test_websites_http.py
pdm run pytest
```

See [the Persian BE-018 validation report](docs/validation/BE-018-own-websites-api.md)
for TDD, exact commands, results and remaining task boundaries.

## Current implementation

- Auth, users, and roles routes under `/api`; OpenAPI at `/openapi.json`.
- Owner-bound website model/repository and migration with atomic hostname
  reservations and digest-only challenge state (BE-017).
- Session-owned website registration, paginated listing and individual reads with
  strict URL validation and a public DTO (BE-018); HTML/proof and UI wiring remain pending.
- Private TLS SMTP adapter and safe CLI smoke tool; one controlled Gmail submission and Inbox receipt verified (BE-011).
- Shared digest-only, single-use email challenges with durable limits and SMTP delivery gating (BE-012); account-specific HTTP flows remain separate.
- Three-step password recovery with a reset-only cookie, atomic password/session revocation and no automatic login (BE-013).
- Private eligibility plus persistent administrator mailbox proof/operator provisioning and privilege-elevation session rotation (BE-014).
- Session-owned profile read and atomic names-only partial editing (BE-015).
- New-mailbox-proved email changes with atomic uniqueness, fresh Admin evaluation and all-session rotation (BE-016).
- Email/password login with canonical email lookup; deprecated username login
  remains for compatibility. Product authentication uses only an opaque session cookie.
- Argon2id for new passwords and verified legacy hash upgrades; exact Unicode
  passwords and an explicit recovery response for bcrypt inputs over 72 bytes.
- Public registration creates an active ordinary `User` atomically. Registration
  attempts have PostgreSQL-backed per-peer throttling and a bounded request body.
- Role permission checks; JSON permission/policy catalogs. Policy evaluation is
  a placeholder, not a delivered ABAC engine.
- PostgreSQL-backed users, roles and assignments through the existing repository
  contracts, with SQLAlchemy 2 async transactions and Alembic migrations.
- Historical JWT/refresh utilities remain unmounted; legacy refresh returns 410.
  Logout revokes only the current opaque session and expires its browser cookies.
- A digest-only, revocable opaque-session store is available in PostgreSQL.
  Login issues its secure cookie and `/auth/me` reads current server identity.
  Every protected route reloads session identity and active role permissions.
  All unsafe `/api` operations require trusted Origin and a signed CSRF token.
- DTO/mapping and use-case/repository separation. Domain errors still depend on
  FastAPI status values and pagination types cross layer boundaries; isolation is partial.
- Pytest entity/repository/HTTP tests, including real PostgreSQL constraints,
  rollback and application process restart checks. Legacy HTTP tests explicitly
  inject in-memory adapters with per-test clients, cookies and state.

These are template/development capabilities, not a completed marketing backend.
The approved target also includes Celery/Redis,
email recovery, and the five-domain-entity product model.
Those changes require their own authorized implementation tasks and mandatory
red–green–refactor.

## Architecture

```text
app/
  domain/                  # entities, validation, errors
  application/use_cases/   # business orchestration
  interface/               # HTTP controllers, DTOs, mappers, contracts, DI
  infra/                   # concrete repositories, services, config, utilities
    database/              # async PostgreSQL connection, transaction, ORM metadata
migrations/                # Alembic environment, revision template and history
statics/                   # JSON permission/policy catalogs
scripts/                   # catalog management and process-local seed commands
tests/                    # unit and integration tests
```

Preserve the existing `app/` layers. Product domain boundaries do not require
moving to the historical `src/modules` example. The catalog CLI has obsolete
output paths and schema assumptions; inspect the backend guide before running it.

## Development and validation

Run commands from `Backend/` with Python **3.12** (the project requires
`==3.12.*`). BE-001 was validated with Python **3.12.14** and PDM **2.29.2**.
Select an installed Python 3.12 interpreter before setup; Python 3.13 is not a
substitute. If PDM is not already available, install the tested tool version in
a separate local environment:

```sh
python3.12 -m venv .tools/pdm
.tools/pdm/bin/python -m pip install 'pdm==2.29.2'
export PATH="$PWD/.tools/pdm/bin:$PATH"
```

Keep this tool environment separate from the application's `.venv`. Both are
Git-ignored. Select Python explicitly, check the lockfile, then install the
locked default and development dependencies without resolving new versions:

```sh
pdm use --first --no-version-file python3.12
pdm lock --check
pdm sync -dG dev
pdm run python --version
```

PDM records the selected application interpreter in the ignored `.pdm-python`.
Use `pdm run` for all application commands. A lock-check failure needs investigation;
do not use `pdm update` or regenerate dependency versions merely to bypass it.
Settings can be loaded offline, but serving the app now requires `DATABASE_URL`
in the environment or private `.env`, the current Alembic revision, and explicit
`PUBLIC_ORIGIN` / `CSRF_SECRET_KEY` (see BE-009 below). Configure
PostgreSQL and run `pdm run alembic upgrade head` as described below before
`make dev`. There is no silent in-memory fallback or startup schema creation.

Once installed:

Full-suite and integration commands require `DATANO_TEST_DATABASE_URL` pointing
to a dedicated real PostgreSQL database; see the setup below. Missing test
configuration fails explicitly instead of silently skipping database checks.

```sh
make dev
pdm run pytest
pdm run pytest tests/unit/
pdm run pytest tests/integration/
pdm run pytest --cov=app
make lint
```

`make dev` serves port 8000. `make dev PORT=8004` overrides it; the direct
execution branch in `app/main.py` uses 8004. `make run` starts Uvicorn without
reload; it does not establish production readiness. `make lint` only compiles
`app/main.py`, not a full lint/type-check suite.

Lifespan owns/disposes the database pool and idempotently creates missing `User`
and `Admin` role records. It preserves existing role IDs, permissions and status.
It creates **no user or password** and never grants Admin based on a supplied
email. The old fixed-password seed and `scripts/seed_in_memory.py` remain only
for explicitly isolated in-memory tests/examples; they cannot provision the
persistent app. Valid administrator provisioning/email proof is documented in BE-014 above.
The historical JWT key is not used by product authentication or CSRF. Use a
private independent CSRF key; there is no serving fallback. Recovery and
deployment hardening retain their separate authorized tasks.

See [the BE-001 baseline report](docs/validation/BE-001-baseline.md) for the
executed setup, lock metadata correction, startup checks, test results and
remaining limitations. No application behavior or API contract changed in BE-001.

## PostgreSQL infrastructure and migrations

BE-003 locks SQLAlchemy **2.0.55**, Alembic **1.20.0** and psycopg/binary
**3.3.6**. It was tested against PostgreSQL **17.11**, not SQLite. Provide an
existing PostgreSQL server or start a local development instance with Docker.
For example, create a private environment file outside the repository containing
`POSTGRES_USER=datano`, `POSTGRES_DB=datano` and a private `POSTGRES_PASSWORD`, then:

```sh
docker run --detach --name datano-postgres \
  --env-file /absolute/path/to/private-postgres.env \
  -p 127.0.0.1:55432:5432 \
  -v datano-postgres-data:/var/lib/postgresql/data postgres:17-alpine
docker exec datano-postgres pg_isready -U datano -d datano
```

Wait until the server accepts connections. Set `DATABASE_URL` in the shell or
private `Backend/.env`, using the actual password (percent-encode reserved URL
characters). Its required form is:

```text
postgresql+psycopg://datano:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:55432/datano
```

The URL is represented as `SecretStr` in settings and is never stored in
`alembic.ini`. The serving app, `Database.from_config(config)` and migrations
require it. PostgreSQL
with the explicit psycopg driver, host and database is required; SQLite fallback
is not supported. Run from `Backend/` against the intended database:

```sh
pdm run alembic upgrade head
pdm run alembic current
pdm run alembic history
pdm run alembic upgrade 0001_database_baseline --sql
```

Revision `0001_database_baseline` establishes history without domain tables.
Revision **`0002_users_roles`** adds `users`, `roles` and the `user_roles`
assignment table. `alembic upgrade head` works from an empty target or BE-003's
baseline and preserves unrelated tables/data. These first two revisions introduce
no analytics or session tables. No migration or `create_all` runs during startup.
Revision **`0003_email_identity`** adds a nonempty, non-null, unique `email_key`
and backfills existing records using Python's exact `email.strip().lower()`.
It preserves display email, account IDs, hashes, roles, assignments and timestamps.
This data-dependent revision requires an **online PostgreSQL** connection;
`upgrade head --sql` deliberately fails rather than producing an incomplete backfill.
The baseline-only offline example above remains supported. Identity ORM metadata
is registered for autogeneration; generated revisions still need review.

Revision **`0004_registration_attempts`** adds only shared, expiring registration
attempt counters and their index/check constraints. It changes no user, role,
assignment or hash data. Startup checks this required table and refuses an
outdated schema with `run alembic upgrade head`; it never migrates automatically.
Downgrading just to `0003_email_identity` drops only counters and preserves
identity data, but resets their rate-limit history. Use matching application
code when intentionally rolling back; the BE-006 app requires the new table.

Revision **`0005_opaque_sessions`** adds `auth_sessions` with a 32-byte digest
primary key, a cascading user foreign key, an account index and lifetime checks.
It changes no existing identity or registration data. The current app checks
both the counter and session tables at startup and requires `alembic upgrade head`.
Downgrading only to `0004_registration_attempts` drops opaque sessions and thereby
invalidates them; identities and registration counters are preserved. Use matching
code for deliberate rollback. No production database was migrated by BE-007.

The backfill holds an exclusive lock on `users` inside PostgreSQL transactional
DDL. Stop application writers for the migration and plan an appropriate
maintenance window for the target data size. Canonical collisions or empty keys
abort the entire revision, including its DDL and version marker. No account is
merged, deleted or selected as a winner. Before retrying, an operator must review
the conflicting accounts in a private, backed-up environment, establish ownership
and approve a data correction. This task does not modify real account data or
automatically resolve collisions. Do not bypass the guard or publish account
emails/hashes in migration logs. Downgrading just to `0002_users_roles` removes
only the derived key and its constraints; existing display identity and hashes
remain intact. Re-upgrading recalculates keys.

Downgrading to `0001_database_baseline` **drops all three identity tables and
their data**. This destructive reversal was tested only on disposable schemas;
back up and verify restoration of the target database before intentionally using
it on real records. Re-upgrading recreates the schema, not deleted records.
Prefer forward corrective migrations when retaining identity data is required.
Downgrading the baseline itself to `base` only removes its revision marker.

`app.infra.database.connection.Database` owns a lazy connection pool with
pre-ping, hidden SQL parameters and a five-second connection timeout. Each
`async with database.transaction() as session:` creates a fresh `AsyncSession`,
commits on success, rolls back on exceptions/cancellation and closes the session.
Pass that session through repositories for one operation; do not share a session
between concurrent tasks or commit independently inside participating repositories.
The application lifespan calls `dispose()` on shutdown, including startup errors.
User and role HTTP dependencies share one transaction for the complete request;
repositories flush but never commit independently. FastAPI 0.115.6 completes
this yield dependency before sending the response. Alembic uses a separate
`NullPool` engine and disposes it after execution.

IDs remain strings, so unknown non-UUID IDs return the existing missing-record
behavior. Display email, internal username and role names retain their exact-value
unique constraints. `email_key` independently enforces canonical uniqueness,
including concurrent writes. Application writes derive it in the SQL repository
on create/update; direct SQL writers must use the same Python rule. The assignment
primary key rejects duplicates, and foreign keys prevent orphan assignments.
Deleting a user or role cascades only to its assignment rows; it never deletes
the opposite parent record. Role permission IDs persist as a PostgreSQL text
array matching the existing contract; catalog validation stays in the use cases.
Lists use SQL pagination ordered by `(created_at, id)` with compatible empty-page
metadata, and roles for a user page are loaded together. Returned domain entities
are detached values, not live mutable ORM references.

Refresh-token persistence, admin
verification and analytics are later tasks. Existing in-memory user/role data is
not imported automatically into PostgreSQL. The HTTP/DTO/OpenAPI contract remains
unchanged in BE-004.

Create a separate test database, for example on this local development instance:

```sh
docker exec datano-postgres createdb -U datano datano_test
export DATANO_TEST_DATABASE_URL='postgresql+psycopg://datano:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:55432/datano_test'
pdm run pytest tests/integration/test_database.py tests/unit/test_database_settings.py tests/unit/test_database_migrations.py
pdm run pytest --cov=app --cov=migrations
```

Export the test URL in the shell; tests do not read it from `.env`. The database
name must start with `datano_test` and the role must have permission to create
schemas there. Each database test creates its own UUID-named schema, sets its
connection's `search_path`, and drops only that schema at teardown, including
after failure. Database URLs and test credentials must remain private. A
dedicated test database is required because the suite performs real writes and
DDL; it never uses `DATABASE_URL` as a test fallback. Unit tests can run without
PostgreSQL via `pdm run pytest tests/unit/`.

See [BE-003 validation](docs/validation/BE-003-postgresql.md) for executed
Red/Green checks, migration/data-preservation evidence and full-suite results.
See [BE-004 validation](docs/validation/BE-004-persistent-identities.md) for the
persistent repositories, migration constraints, real process/container restart
checks and the current full-suite result.

## Email identity and password compatibility

BE-005 keeps the existing routes, response envelopes and JWT/refresh-token
mechanism. `POST /api/auth/login` now accepts `{"email":"person@example.test",
"password":"the exact existing secret"}`. Supply exactly one of `email` or the
deprecated compatibility field `username`; both/neither return 422. Email lookup
and uniqueness use Unicode trim/lowercase only, preserving dots and `+` tags.
Display spelling retains case, with outer whitespace removed on new writes.
Historical display spelling is left untouched by migration. No Unicode
normalization or provider-specific email alias rules are applied.

`POST /api/users/` remains permission-protected and creates inactive accounts.
Its body needs first/last name, email and password; username is optional and is
generated internally when omitted. Public `User`/create/login schemas mark the
legacy username field optional/deprecated. Existing JWT claims still carry the
internal username, so callers do not need to supply one. Public registration and
activation are provided separately by BE-006 below; opaque login/current identity
are provided by BE-008, authorization/CSRF by BE-009 and logout by BE-010. Frontend
generation/adapters are deferred to FE-029; approved UI files are unchanged.

New password creation uses **15–128 Unicode codepoints** (Python `len`), including
spaces, Persian, ZWNJ and emoji, with no composition requirement, trim,
normalization or truncation. Hashes use Argon2id, version 19, memory **19456 KiB**,
time cost **2**, parallelism **1**, a random 16-byte salt and a 32-byte hash.
`argon2-cffi` **25.1.0** and its bindings **26.1.0** are locked; existing package
versions were retained. Stronger configured parameters may be supplied through
the password service; no upgrade lowers an existing parameter. Password CPU work
runs in a thread through the use cases. Deployment capacity/rate controls remain
the responsibility of their authorized tasks; this is no production load benchmark.

On successful active-account authentication, supported bcrypt `$2a$`/`$2b$`/`$2y$`
hashes are verified against the **full exact UTF-8 input up to 72 bytes** and
upgraded to Argon2id. Existing short passwords are verified and upgraded without
applying the new 15-character minimum. Low-cost Argon2id hashes also upgrade.
Hash replacement uses an atomic compare-and-swap in the request transaction,
preserving profile timestamps and preventing overwrite of a concurrent password
change. Failed/inactive logins never store an upgrade; transaction failure rolls
it back. The old `BcryptPasswordService` import name is a deprecated compatibility
alias that also creates only Argon2id hashes.

An input over 72 UTF-8 bytes against a legacy bcrypt hash returns **401** with
`payload.error_code="PASSWORD_RESET_REQUIRED"` and
`payload.details.recovery_required=true`. It never retries a truncated prefix,
ignores an incomplete UTF-8 character or prehashes an existing credential.
Historical truncation cannot prove the discarded suffix. Such accounts require
the recovery flow in BE-013 (not implemented here); they are not silently treated
as a normal wrong-password result. Hash conversion needs a verified plaintext
secret and is therefore performed at login, never by a schema migration.

Credential DTOs use `SecretStr` internally and OpenAPI marks passwords write-only.
Credential-route structural 422 errors retain FastAPI's `detail` list but omit
input/context payloads that could echo the entire password-bearing body. No
plaintext password, hash or `email_key` is added to public user responses.

See [BE-005 validation](docs/validation/BE-005-email-passwords.md) for exact
Red/Green results, PostgreSQL migration/constraint checks, contract changes,
coverage and limitations.

## Public registration

BE-006 adds **`POST /api/auth/register`** without an administrative permission or
existing session. Its JSON body contains exactly:

```json
{
  "first_name": "Given name",
  "last_name": "Family name",
  "email": "person@example.test",
  "password": "An exact 15–128 codepoint secret"
}
```

Success returns **201** with `{success, message, payload}` and the existing public
user representation. The account is active and has only the backend-selected
`User` role. Names require non-whitespace content, without an invented field
length limit. Email identity and password policy reuse BE-005. Internal username
generation, hash creation, activation and role assignment use the existing
repositories in one request transaction. Failure rolls back the complete account
and assignment. Registration itself sets no cookie or token; session issuance is
provided separately by BE-008. Protected `POST /api/users/` behavior is unchanged.

Unknown fields are rejected with 422, including roles, permissions, username,
activation, IDs and password hashes. No address grants Admin automatically.
Canonical duplicate emails return 409, including concurrent attempts. Invalid
input returns 422 without echoing the password. Missing/inactive default `User`
role or unavailable attempt storage returns 503 and creates no account. Role
records are reconciled at startup, never created or re-enabled by registration.

Registration-only technical defaults are configurable in `.env`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `REGISTRATION_IP_LIMIT` | `5` | Attempts per peer in each fixed UTC window |
| `REGISTRATION_WINDOW_SECONDS` | `600` | Window duration in seconds |
| `REGISTRATION_MAX_BODY_BYTES` | `8192` | Entire request-body byte bound |

All must be positive; the attempt limit must also fit the PostgreSQL integer
counter. These are initial engineering defaults, not product/account quotas or
OWASP-mandated numbers. Workers must share settings and the database. A
registration-specific route guard consumes a counter before JSON parsing,
dependency resolution or password hashing. Success, validation errors, malformed
JSON, duplicate emails and oversized requests all consume attempts. Counters
commit independently of the account transaction so an error cannot refund them.
Excess requests return **429**, `payload.error_code="RATE_LIMITED"`, a
`Retry-After` header and `payload.details.retry_after` in seconds. Denials do not
extend the window. Chunked/no-length bodies are checked while reading; the exact
byte limit is accepted and a larger body returns **413**.

The peer comes only from the ASGI connection address, with equivalent IPv6 and
IPv4-mapped spellings canonicalized. Missing/unparseable peers share one
restrictive bucket. The application does not trust `X-Forwarded-For`, `Forwarded`
or `X-Real-IP` itself. An ingress proxy/server must establish a trustworthy ASGI
peer using an explicit trusted-proxy policy; deployment verification belongs to
OPS-001. The database stores a SHA-256 peer token, window timestamps and a capped
counter; no raw address, email or credential body is stored there. The peer token
is pseudonymous, not an anonymity guarantee. Each attempt removes at most 100
expired rows, skips locked rows and preserves live windows. Expired rows can
remain during inactivity until a later request or authorized maintenance.

This fixed-window per-peer control is an initial abuse barrier: shared NAT users
share a quota, boundary bursts and distributed/rotating peers need ingress/bot
controls. It is not a production load/DDoS guarantee. No Redis, CAPTCHA, global
auth throttling or unrelated endpoint limit was introduced. The approved signup
UI and its unavailable-terms gate are unchanged; public rollout/terms integration
still depends on EXT-002, FE-048 and the authorized transport/session tasks.

## Opaque session store (BE-007)

`SessionService` uses the `ISessionRepository` contract and the SQLAlchemy
`SQLSessionRepository` adapter. `issue(user_id, remember_me=...)` generates a new
256-bit identifier with `secrets.token_urlsafe(32)` and returns it only to its
caller. PostgreSQL receives only SHA-256's 32-byte digest and technical metadata.
It stores no raw identifier, email, role/permission snapshot, IP or device data.
Identifiers are exact, case-sensitive URL-safe strings; malformed input and a
hex digest cannot authenticate. Token and digest fields are excluded from repr.

| Profile | Inactivity limit | Absolute limit |
| --- | --- | --- |
| Normal | 30 minutes | 12 hours |
| Remember-me | 7 days | 30 days |

The approved MVP defaults are configurable through `SESSION_IDLE_SECONDS=1800`,
`SESSION_ABSOLUTE_SECONDS=43200`, `REMEMBER_SESSION_IDLE_SECONDS=604800` and
`REMEMBER_SESSION_ABSOLUTE_SECONDS=2592000`. All must be positive integer seconds
with idle <= absolute; invalid pairs fail startup. A session snapshots its idle
timeout and absolute expiry when issued, so a later configuration change applies
to new sessions. The PostgreSQL wall clock is sampled **after** waiting for locks.
At either exact expiry the record is invalid. Activity updates last-seen time and
slides idle expiry only up to the original absolute cap; expired/revoked records
cannot be revived. Backward clock readings fail validation without extending time.

`resolve(token, touch=False)` checks without extending inactivity. `revoke(token)`
is idempotent; `revoke_all(user_id)` invalidates that account's stored sessions.
All operations participate in the caller's transaction, with no internal commit.
Account-row locks precede session-row locks and serialize issue/touch/revoke/bulk
revocation for one account until commit. Bulk revocation covers sessions ordered
before it; a subsequent authorized issuance can create a new session. Keep these
transactions short; this correctness choice is not a throughput benchmark.

BE-008 consumes these providers for login and current identity; BE-009 now uses
them for every protected route and reloads activation and active role permissions.
BE-010 below adds current-session logout using the existing revocation provider.
Recovery flows, Redis, an expiry-cleanup job and a session retention policy remain
outside these storage/login/authorization/logout tasks.

See [BE-007 validation](docs/validation/BE-007-opaque-sessions.md) for real
PostgreSQL boundaries, concurrency, rollback, process persistence, migration
preservation and full-suite evidence.

Validate using the dedicated PostgreSQL setup above:

```sh
pdm run pytest tests/integration/test_registration.py tests/integration/test_registration_limiter.py tests/integration/test_registration_migration.py tests/unit/test_registration_config.py
pdm run pytest --cov=app --cov=migrations --cov-branch
```

Coverage explicitly traces both threads and SQLAlchemy greenlets; without that,
concurrent async SQL can leave misleading after-await gaps. No threshold or
exclusion was relaxed. See [BE-006 validation](docs/validation/BE-006-registration.md)
for actual Red/Green runs, concurrency, migration, API and full-suite results.

## Email login and current session (BE-008)

`POST /api/auth/login` accepts email, the exact existing password and optional
`remember_me` (strict JSON boolean, default false). Exactly one email or the
deprecated username compatibility field is accepted; unknown fields, including
caller-selected roles/activation, return 422. Email lookup and password/hash
compatibility reuse BE-005 rather than reimplementing identity rules.

The current response keeps the envelope with `payload.user` (the existing public
User DTO), `payload.effective_role` (`Admin`, `User` or null) and `payload.csrf_token`.
BE-009 removed the temporary JWT fields `title`, `token`, `type` and `expires_at`.
The opaque identifier appears only in Set-Cookie, never the JSON body. Do not
persist credentials in browser storage. FE-029/030 will connect the approved UI
to the session/CSRF contract below.

The normal cookie is **`__Host-datano_session`**, `HttpOnly`, `Secure`,
`SameSite=Lax`, `Path=/`, without Domain. Without remember-me it has no Max-Age
or Expires. Remember-me adds Max-Age equal to the issued absolute lifetime
(default **2592000 seconds / 30 days**). PostgreSQL still enforces the idle and
absolute limits independently; a browser retaining a cookie cannot bypass them.
No activity extends the original absolute cap. Normal browser closure does not
prove server revocation.

Default development also requires HTTPS for that cookie. The explicit
`SESSION_ALLOW_INSECURE_LOCAL_HTTP=true` exception applies only to HTTP URLs with
host `localhost`, `127.0.0.1` or `::1` and uses **`datano_session_dev`** instead.
It is false by default. HTTPS and non-local URLs still use the secure cookie
even when that flag is true. Do not enable the exception for deployment or use
an untrusted proxy Host/scheme as a substitute for a local environment. The target
deployment remains browser and `/api` on one HTTPS origin; CORS accepts only configured `PUBLIC_ORIGIN`; trusted proxy/TLS deployment
configuration remains operational work.

Each successful login generates a fresh server identifier and atomically revokes
the previous browser cookie's session, including account switches. Unknown or
malformed incoming identifiers cannot fix the new session. Failed authentication
sets no cookie; a failure after rotation rolls back both insertion and revocation.
Account locks are ordered by ID before session mutation, including when switching
between two accounts. Initial credential verification is read-only; password
verification/legacy hash upgrade runs again under the ordered account locks.
This prevents a pre-existing bcrypt compare-and-swap lock from reversing lock
order. Concurrent deletion, activation/password changes and same-secret rehashes
are handled using current server state. No sleep or retry loop hides a deadlock.

`GET /api/auth/me` keeps the public User fields and adds `effective_role`. It
requires the opaque cookie, validates/touches the stored session, reloads the
account and assigned role records, and rejects inactive/deleted accounts.
Verified, privately eligible active `Admin` wins over active `User`; inactive, deleted or custom roles cannot
invent either product role. Without an active product role the value is null.
No email or client header/storage value grants Admin. BE-014 additionally requires
persistent mailbox proof or private server provisioning. Successful login/current-identity responses
carry `Cache-Control: no-store`.

BE-009 retires the intermediate JWT path described in the historical BE-008
validation report. There is no Bearer fallback, including when a session cookie
is absent, malformed, expired or revoked. See the migration contract below.

Login uses the existing bounded credential-body guard and PostgreSQL counter
implementation with an independent `login` namespace. The historical table name
`registration_attempts` is retained; only digest/window/count data are stored.
There is no new migration, schema, dependency or Redis service. Registration
keys and defaults are unchanged. Login's configurable technical defaults are:

| Setting | Default |
| --- | --- |
| `LOGIN_IP_LIMIT` | 10 attempts per peer/window |
| `LOGIN_WINDOW_SECONDS` | 600 seconds |
| `LOGIN_MAX_BODY_BYTES` | 8192 bytes for the complete body |

After BE-009 Origin/CSRF validation, attempts are recorded before JSON parsing/password work in an independent short
transaction, so malformed credentials, failure or account rollback cannot refund
them. Quota state survives app lifetimes. HTTP 429 includes Retry-After; oversized
fixed/chunked bodies yield 413; unavailable counter storage yields 503 without
authenticating. Forwarded address headers are not trusted by application code.
This per-peer barrier shares the registration limiter's NAT/boundary/distributed
abuse limitations and does not replace trusted ingress controls.

See [BE-008 validation](docs/validation/BE-008-session-login.md) for actual TDD,
PostgreSQL concurrency/rollback evidence, API compatibility changes and full-suite
results. No Frontend file, approved page design or generated client was changed.

## Session authorization, CSRF and JWT cutover (BE-009)

Every protected user, role and permission operation now uses the same opaque
session authority as `/api/auth/me`. Current account activation and assigned
role records are read from PostgreSQL on each request. Only active roles grant
permissions; the existing permission IDs and Super_User semantics are preserved.
A valid session with insufficient permissions returns 403; missing/unusable
sessions and inactive accounts return 401. Caller-provided roles and Bearer
headers never select identity or permissions.

Serving requires **PUBLIC_ORIGIN** (one exact HTTPS origin, no path/trailing slash)
and **CSRF_SECRET_KEY** (a private, independently generated secret of at least
32 UTF-8 bytes). There is no production default. All workers must share the key
and origin. Offline OpenAPI export remains possible without serving configuration.
Use `secrets.token_urlsafe(32)` in a private environment to generate the key.
`http://localhost:3000` or another explicit loopback port is allowed only with
`SESSION_ALLOW_INSECURE_LOCAL_HTTP=true`. CORS allows credentials for that one
origin and the Content-Type/X-CSRF-Token headers; it does not use wildcard origins.
The Origin decision uses configuration rather than caller Host/forwarding headers.

Browser/consumer sequence:

1. Fetch **GET /api/auth/csrf** with credentials. Its envelope contains
   `payload.csrf_token`; it also sets an HTTP-only nonce cookie. Bootstrap does
   not authenticate or grant permissions. A supplied Origin must be trusted.
2. Send **Origin: <PUBLIC_ORIGIN>** and **X-CSRF-Token: <payload.csrf_token>**
   together with cookies on every POST/PUT/PATCH/DELETE under `/api`, including
   anonymous login and registration. Browsers supply Origin automatically;
   non-browser clients must set it explicitly. Tokens belong in headers, not URLs.
3. On successful login, replace the in-memory CSRF token with the returned
   `payload.csrf_token`. Login rotates both the opaque session and the nonce.
   Its previous CSRF token cannot authorize the new session.
4. Bootstrap again after a page reload or cookie/key change. Keep the token in
   memory; do not store session credentials in localStorage or readable cookies.

The nonce cookie is **__Host-datano_csrf**, HttpOnly/Secure/SameSite=Lax/Path=/,
without Domain, Max-Age or Expires. Explicit local HTTP uses **datano_csrf_dev**.
It is a random 256-bit nonce, not the header token. The header is HMAC-SHA256 over
a versioned message containing a fixed-size digest of the current opaque cookie
and the nonce. PostgreSQL stores only the session digest; neither the raw session
nor the signing secret is returned in JSON. Constant-time comparison rejects forged,
missing, malformed, duplicate or cross-session header tokens. Bootstrap reuses a
valid nonce to avoid parallel-request rotation races. Bootstrap/login responses
are `Cache-Control: no-store`, with Cookie/Origin variation where tokens appear.
The signature design follows OWASP's
[signed double-submit guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Unsafe requests with a missing/untrusted Origin or invalid CSRF pair return
403 with `payload.error_code=CSRF_FAILED`, before body parsing, quota consumption,
authentication or mutation. GET/HEAD/OPTIONS remain safe; CORS preflight is handled
without a CSRF token. Existing registration/login quotas apply after this boundary.
A valid CSRF pair never substitutes for authentication or permissions. Signing
key rotation invalidates CSRF tokens; bootstrap recovers without changing stored
opaque sessions. All workers must deploy the key consistently.

**Breaking JWT migration:** deploy this backend and consumers using the above
contract together. Already-issued opaque sessions remain valid under BE-007
limits; bootstrap supplies their CSRF token. JWT-only clients must sign in again
with credentials; no JWT-to-session exchange is offered. New login no longer
issues JWTs or refresh tokens and removes the four deprecated JSON fields.
Any old refresh cookie presented on successful login is expired. Public
**POST /api/auth/refresh** still returns **410 AUTH_MIGRATION_REQUIRED** after
Origin/CSRF checks (403 without them). It never mints credentials. BE-010 now
replaces the temporary logout tombstone with the current-session flow below.
Historical JWT/refresh utilities remain unmounted; the historical JWT secret
cannot sign CSRF tokens or authorize requests.

BE-009 added no migration beyond **0005_opaque_sessions**, dependency, lifetime
or identity/hash policy change. The current head is documented in BE-012 above.
No Frontend file or approved page design
was changed or regenerated. FE-029/030 must adopt these API changes; browser UI
integration, deployment proxy/TLS validation and complete production security
certification are not claimed. See [BE-009 validation](docs/validation/BE-009-session-authorization-csrf.md).

## Current-session logout (BE-010)

**POST /api/auth/logout** now uses the existing opaque cookie and BE-009 Origin /
X-CSRF-Token contract. Send credentials and the CSRF header from bootstrap/login.
No JSON body is required; body-selected session IDs, user IDs, bulk-logout flags,
Bearer headers and legacy refresh credentials do not select the session to revoke.
The endpoint's OpenAPI cookie credential is optional because cleanup also works
for absent/stale cookies; Origin and CSRF remain mandatory in every case.

A successful logout returns HTTP **200** with the existing envelope:

```json
{"success":true,"message":"Logged out successfully","payload":null}
```

The existing SessionService/repository marks only the supplied current session's
digest as revoked in PostgreSQL. Other sessions for the same account and other
users stay valid. A captured old cookie is denied on protected reads and writes,
including after a new application instance starts. Logout does not extend idle
expiry or require an active account/role. Absent, malformed, unknown, expired or
already revoked cookies receive the same successful cleanup response; network
retries are idempotent. This is not evidence that those credentials authenticate.

The response expires **__Host-datano_session** and **__Host-datano_csrf** using
Max-Age=0 and an expired date, preserving HttpOnly/Secure/SameSite=Lax/Path=/ and
no Domain. The explicit local HTTP profile clears **datano_session_dev** and
**datano_csrf_dev** with matching local attributes. Both normal and remember-me
cookies are removed. A presented historical refresh cookie is also expired using
its original path/security attributes. Responses use `Cache-Control: no-store`.
No new token, session identifier or account data is returned.

Revocation shares the existing request transaction. Cookie-clearing success is
sent only after transaction finalization; a failure rolls back the revocation
and does not send Set-Cookie. It returns the existing sanitized error rather
than claiming success. Retry or resolve the failure before treating server
logout as complete. Invalid Origin/CSRF returns 403 without changing sessions
or browser cookies. After successful logout, discard the in-memory CSRF token
and **GET /api/auth/csrf** again before anonymous mutation or login. Clearing
private frontend query caches/navigation remains FE-030, not this backend task.

The route is no longer deprecated and no longer returns BE-009's temporary 410.
Legacy refresh remains retired and no JWT authentication path is restored.
No schema, dependency, session lifetime or other auth endpoint changed. Frontend
transport, approved UI and generated clients remain untouched. See
[BE-010 validation](docs/validation/BE-010-session-logout.md) for actual tests,
rollback, cookie profiles, concurrency, coverage and environment results.

## Test isolation

The legacy `test_client` fixture explicitly creates a test application with
in-memory repository overrides and the isolated development seed. It clears
cookies and resets the registry before startup and after shutdown, including
when a test fails. `admin_session` and `admin_auth` belong to that same test
lifetime; do not retain them across tests or reset storage while they are in use.
It explicitly overrides the session repository and login limiter for these
isolated CRUD characterization tests; product cookie/storage/rate behavior
uses real PostgreSQL in `test_session_login.py` and `test_sessions.py`.
The development seed supplies authentication only. User/role CRUD and assignment
tests create their own targets through `created_user` and `created_role` rather
than changing the seeded admin or selecting the first global list item.

`tests/test_fixture_isolation.py` uses pytest's bundled `pytester` plugin to
exercise the actual fixtures across test-item boundaries in temporary
subprocesses. It checks user/role/token and cookie leakage in both orders,
cleanup after an intentional failed child test, and duplicate test names.
No new test dependency or random-order plugin is required. The parent cleanup
test passes only when its child run has exactly the intentional failure and a
passing cleanup observer.

```sh
pdm run pytest tests/test_fixture_isolation.py
pdm run pytest
```

See [BE-002 validation](docs/validation/BE-002-fixture-isolation.md) for TDD
evidence, full-suite order checks and the limits of this in-memory isolation.

The BE-004 integration tests use real per-test PostgreSQL schemas and the normal
persistent application lifecycle. They provision test actors through repositories
only inside those disposable schemas. The process restart helper under
`tests/support/` contains test-only credentials and is not an administrator
provisioning command. Run the affected checks with:

```sh
pdm run pytest tests/integration/test_persistent_repositories.py tests/integration/test_persistence_migrations.py tests/integration/test_persistent_http.py
```


## Safe website HTML receipt (BE-019)

`IWebsiteHTMLFetcher` in `app/application/use_cases/website/html.py` returns a
bounded `WebsiteHTML` (bytes, final URL and content type), or a safe typed
`HTMLFetchError`. It does not issue a challenge, parse a proof token, verify a
site, or expose a public fetch endpoint. `get_website_html_fetcher` composes the
adapter from validated application settings for BE-020. That future use case
must resolve the current authenticated owner and stored WebsiteAddress before
calling this port; a submitted URL or HTML result is not authorization.

The infrastructure adapter `SafeWebsiteHTMLFetcher` has these policies:

- Canonical HTTP(S) site addresses only. Start at the HTTPS homepage. An explicitly
  HTTP-registered site may fall back to HTTP only after a network/TLS failure,
  within the same total deadline and redirect budget. A DNS/policy/content/status
  rejection or timeout never enables that fallback. HTTPS registrations never
  use HTTP. An HTTPS response cannot redirect to HTTP, even for an HTTP registration.
- Resolve the absolute hostname afresh on every hop and fetch, requesting both
  address families. Reject an empty answer or any mixed/unsafe answer set before
  connecting. Only global IPv4/native global-unicast IPv6 is eligible; loopback,
  private, link-local, CGNAT, multicast, reserved/documentation, mapped, scoped,
  NAT64/tunnel and conservative special-purpose protocol ranges are rejected.
  Azure's platform address 168.63.129.16 is also explicitly blocked.
- Pin TCP to the first validated numeric IP; keep the canonical Host header and
  TLS SNI/certificate hostname. No second hostname lookup, alternate-IP retry,
  shared connection reuse or DNS cache exists in the adapter. TLS verification
  and hostname checking are required, with TLS 1.2 or later.
- Handle only 301/302/303/307/308 manually, allowing at most three redirects in
  total. Every redirect must retain the exact canonical hostname (www/subdomains
  are independent), an allowed scheme/default port and no credentials. Relative
  paths and queries can redirect within that hostname. Fragments are discarded;
  loops, malformed/ambiguous URLs, duplicate/missing Location, controls, custom
  ports and cross-host redirects fail closed. Redirect bodies are not consumed.
- A fresh low-level HTTPCore pool per hop has no ambient proxy, cookies, browser
  authentication, Referer or automatic redirects/retries. Only GET is sent.
- Return only status 200 and explicit text/html or application/xhtml+xml.
  Request identity encoding and reject compressed responses, so decompression
  bombs are never expanded. Check Content-Length before receipt and count actual
  streamed bytes, including chunked/lengthless bodies. Close responses/sockets
  on success, error, timeout and cancellation; discard partial HTML on failure.

Settings are server-only and listed in `.env.example`:

| Variable | Default | Valid range |
|---|---|---|
| `HTML_FETCH_TOTAL_SECONDS` | 10 | >0, <=30 |
| `HTML_FETCH_DNS_SECONDS` | 3 | >0, <=10 |
| `HTML_FETCH_CONNECT_SECONDS` | 3 | >0, <=10; TCP, TLS and writes |
| `HTML_FETCH_READ_SECONDS` | 3 | >0, <=10 per read |
| `HTML_FETCH_MAX_BYTES` | 1048576 (1 MiB) | 1..5242880 (5 MiB) |

The total deadline includes DNS, redirects, TLS, body receipt and permitted HTTP
fallback; it is not reset at each hop. The redirect maximum is fixed at three.
HTTPCore/h11 also bound incomplete HTTP headers to 100 KiB; redirect URLs are
limited to 2048 characters. These are technical limits, not product plan quotas.
The system DNS call uses asyncio's resolver executor: cancelling the await prevents
any subsequent socket connection, but cannot forcibly terminate an OS resolver
call already executing. Deployment-level egress restrictions remain useful in
addition to this adapter; do not add a proxy/private-address bypass in production.

`httpcore[asyncio]==1.0.9` is now an explicit runtime dependency, promoted from the
already locked HTTPX development dependency. PDM updated the default-group
metadata for it and certifi; no existing version was upgraded and no package was
installed. Production environments should install from the updated PDM lockfile.

Focused tests (no live external site, public DNS or Google/SMTP dependency):

```sh
pdm run pytest tests/unit/test_website_html_fetcher.py tests/integration/test_website_html_wire.py -q --tb=short --show-capture=no
pdm run pytest tests/unit/test_website_html_fetcher.py tests/integration/test_website_html_wire.py \
  --cov=app.infra.services.website_html_fetcher --cov=app.application.use_cases.website.html \
  --cov-branch --cov-report=term-missing -q --tb=short --show-capture=no
# Full suite requires an explicit dedicated datano_test* PostgreSQL database.
pdm run pytest -q --tb=short --show-capture=no
pdm lock --check
```

Real wire fixtures use loopback with ephemeral test certificates. A test-only
network backend routes already validated numeric destinations to that peer;
production IP validation and TLS hostname verification are retained. Tests cover
DNS rebinding/mixed results, special-use IPs, all redirect codes/limits, hostile
URLs, proxy/cookie isolation, TLS trust/name failures, stalled DNS/TLS/read,
streaming size, compressed bodies and cleanup. No public URL is fetched in tests.
See the Persian [BE-019 validation report](docs/validation/BE-019-safe-html.md).

The implementation uses the documented [HTTPCore SNI extension](https://www.encode.io/httpcore/extensions/#sni_hostname),
[async streaming API](https://www.encode.io/httpcore/async/) and
[OWASP SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
The extra special-purpose exclusions are deliberately conservative; some IANA
protocol/anycast assignments marked globally reachable are also excluded from
website verification. Reference registries:
[IANA IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/),
[IANA IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/).
