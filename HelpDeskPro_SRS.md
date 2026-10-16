# craftkel.ai — Software Requirements Specification

**Version 1.0**

_A support ticketing platform with a built-in, rate-limited AI API_

---

## 1. Introduction

### 1.1 Purpose

craftkel.ai is a support ticketing platform with an AI API attached to it. It has two surfaces that share one codebase, one MySQL database and one account system:

1. **The web application.** Customers, agents and admins work tickets through a browser UI using normal login sessions (JWT access token plus refresh-token cookie). **Tickets can only be created through this UI.** There is no public ticket-creation API.
2. **The craftkel AI API (`/api/v1`).** A general-purpose AI API in the style of OpenAI or Grok: chat, summarize and classify. It is authenticated with API keys, not login sessions, and it is rate-limited per key with tiered quotas. It has no knowledge of tickets.

Customers and admins manage API keys from inside the web application, which is where the two surfaces meet. Everything else is separate.

### 1.2 Learning Goals

| Concept                                                            | Where it shows up                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **State pattern**                                                  | Ticket status lifecycle: only certain transitions are legal             |
| **Strategy pattern (x3)**                                          | Agent assignment, rate-limit algorithm, AI provider                     |
| Two separate auth schemes                                          | JWT sessions for the web app; API keys for `/api/v1`                    |
| Hand-written rate limiting                                         | Weighted token bucket tracked in MySQL, no rate-limiting library        |
| Idempotency keys                                                   | Retried AI requests return the stored response and are not billed twice |
| Scheduled background jobs                                          | SLA breach detection and auto-escalation                                |
| Redis caching                                                      | Read-through cache with write-time invalidation for list endpoints      |
| Row-locking under concurrency                                      | Ticket assignment, token-bucket updates, key revocation, agent toggling |
| Database-layer logic                                               | Views, triggers, CHECK constraints, deliberate `ON DELETE` rules        |
| Repository / Service / Controller layering, custom error hierarchy | Applied across the whole backend                                        |

### 1.3 Scope

**In scope:** everything in Section 4 and Section 5.

**Explicitly out of scope:** real SMS delivery, a knowledge base, file attachments on tickets, WebSocket live updates, and a billing system for key tiers. Section 10 lists optional stretch goals.

### 1.4 Definitions

| Term                   | Meaning                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **Web app**            | The browser UI and the `/api/*` routes behind it, authenticated by JWT              |
| **AI API**             | The `/api/v1/*` routes, authenticated by `X-API-Key`                                |
| **Org**                | An organization that customers belong to and that can own API keys                  |
| **Token (rate limit)** | A unit of quota in a key's bucket. Not to be confused with JWT tokens or LLM tokens |
| **AGLevel**            | An agent's seniority: 2, 3 or 4                                                     |

---

## 2. User and Access Model

Three account types, each stored in its own table. This gives a global role check plus resource-based checks on top of it.

- **Admin.** Provisioned from a command-line tool (`admin.cli`), never through public signup. Manages agents, organizations, org members and organization API keys, and can see and do everything.
- **Agent.** Provisioned by an admin, with a level (2, 3 or 4) and an active/inactive flag. Works tickets: can only change status or comment on tickets assigned to them (or unassigned ones they claim). Inactive agents cannot receive assignments.
- **Customer.** Self-signs up with email OTP verification, or is added to an org by an admin. Can create tickets and see or comment on only their own tickets. Can create and revoke **personal API keys**.

**API keys** are not tied to a login session. A key is owned by exactly one of:

- an **organization** (created by an admin), or
- a **customer** (a personal key, created by that customer).

Each key has a tier (`free` or `pro`), a revoked flag, an optional expiry, a label and a visible prefix. Keys are used only on `/api/v1/*`.

---

## 3. Authentication Requirements

### 3.1 Web application (JWT sessions)

- Passwords are hashed with bcrypt (cost 12). No exceptions.
- **Customer signup is two-step.** The first step stages the account in a `customer_staging` table and emails a 6-digit OTP, stored as a bcrypt hash. The second step verifies the OTP and moves the row into `customer`.
  - Re-submitting signup for a staged email re-issues a fresh OTP only after the previous one has expired.
  - Wrong OTPs increment an attempt counter. After 5 failures the staging row is flagged and locked until a timestamp. The OTP window is set by a database trigger.
  - An email that already exists in any of the three account tables is rejected with `409`.
- **Login** checks one email across the customer, admin and agent tables, issues a short-lived **access token (JWT)** carrying `userId` and `role`, and sets a **long-lived opaque refresh token** as an `httpOnly`, `secure`, `sameSite=strict` cookie. Only the SHA-256 hash of the refresh token is stored server-side.
- `GET /api/auth/refresh` validates the cookie and **rotates** the refresh token inside a transaction using `SELECT ... FOR UPDATE`. `DELETE /api/auth/logout` revokes it by setting `revokedAt`.
- `GET /api/auth/access` lets the front end cheaply check whether its access token is still valid.
- **Login brute-force protection.** A per-email throttle lives in a `login_rate_limit` table, using a counting window and a temporary lock after too many failures. It is deliberately keyed by email and never by IP: otherwise an attacker holding one valid account could log in between guesses and wipe their own IP counter. A library is acceptable here because it is not the learning objective, and the table-based throttle is the chosen implementation.
- A refresh token belongs to exactly one account (admin, agent **or** customer), enforced by a CHECK constraint.

### 3.2 AI API (API keys)

- An admin (for an org) or a customer (personal) generates a key. **The raw key is shown once**; only its hash and a short prefix are stored.
- Requests authenticate with an `X-API-Key` header. The middleware looks up the key by prefix, verifies the hash, then checks that the key is not revoked and not expired.
- Revoked, expired or unknown keys return `401`. A key whose tier does not allow the endpoint returns `403`.
- API keys are **never accepted** on web-app routes, and JWTs are **never accepted** on `/api/v1/*`. The two schemes do not overlap.

---

## 4. Functional Requirements and Endpoints

All web-app routes live under `/api` and use JWT unless stated. All responses use one JSON envelope: `{ success, message, data? }`.

### 4.1 Auth and Accounts

| Method | Endpoint                    | Auth           | Notes                                                 |
| ------ | --------------------------- | -------------- | ----------------------------------------------------- |
| POST   | `/api/auth/new/signup`      | none           | stages a customer, emails an OTP                      |
| POST   | `/api/auth/verified/signup` | none           | verifies the OTP, creates the customer                |
| POST   | `/api/auth/login`           | none           | per-email throttled; sets the refresh cookie          |
| GET    | `/api/auth/refresh`         | refresh cookie | rotates the refresh token, returns a new access token |
| GET    | `/api/auth/access`          | access token   | validity check                                        |
| DELETE | `/api/auth/logout`          | access token   | revokes the refresh token                             |

### 4.2 Admin: Agents

| Method | Endpoint                   | Auth  | Notes                                                    |
| ------ | -------------------------- | ----- | -------------------------------------------------------- |
| GET    | `/api/agents/all`          | admin | cached list of agents                                    |
| POST   | `/api/agents/add`          | admin | provisions an agent (name, email, password, level 2/3/4) |
| PUT    | `/api/agents/toggleStatus` | admin | activates or deactivates an agent under a row lock       |

### 4.3 Admin: Organizations and Members

| Method | Endpoint                  | Auth  | Notes                                  |
| ------ | ------------------------- | ----- | -------------------------------------- |
| GET    | `/api/orgs-data`          | admin | cached list of orgs with member counts |
| POST   | `/api/add-orgs`           | admin | create an org                          |
| DELETE | `/api/remove-orgs`        | admin | delete an org (guarded; see §6.4)      |
| PUT    | `/api/orgs-members`       | admin | list members of an org                 |
| POST   | `/api/orgs/newMember`     | admin | create a customer inside an org        |
| DELETE | `/api/orgs/remove-member` | admin | remove a customer from an org          |

### 4.4 API Key Management (web app)

| Method | Endpoint                  | Auth               | Notes                                          |
| ------ | ------------------------- | ------------------ | ---------------------------------------------- |
| POST   | `/api/api-keys`           | admin              | create an org key; raw key returned once       |
| GET    | `/api/org-keys`           | admin              | list org keys (prefix only, never the raw key) |
| GET    | `/api/user-keys`          | admin              | list customers' personal keys                  |
| DELETE | `/api/revoke-key`         | admin              | revoke any key under a row lock                |
| POST   | `/api/customer/newApiKey` | customer           | create a personal key with a label             |
| GET    | `/api/customer/myKeys`    | customer           | list own keys                                  |
| DELETE | `/api/customer/revokeApi` | customer           | revoke own key only                            |
| GET    | `/api/api-keys/:id/usage` | admin or key owner | usage aggregation for the dashboard (see §4.7) |

List endpoints are cached in Redis with a TTL. Every write that could change a cached list invalidates the matching cache key.

### 4.5 Tickets (web app only)

Tickets are created, viewed and worked **only** through the UI.

| Method | Endpoint                    | Auth                                             | Notes                                                                                                                     |
| ------ | --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/customer/newTicket`   | customer                                         | creates a ticket (title, body, priority); runs the assignment Strategy immediately                                        |
| GET    | `/api/tickets`              | any authenticated                                | customer sees own only; agent sees assigned plus unassigned; admin sees all. Paginated, filterable by status and priority |
| GET    | `/api/tickets/:id`          | owning customer, assigned agent, or admin        | detail plus comment thread                                                                                                |
| PATCH  | `/api/tickets/:id/status`   | assigned agent or admin                          | **goes through the State pattern**; illegal transitions are rejected with a custom error                                  |
| POST   | `/api/tickets/:id/assign`   | admin (also triggered automatically on creation) | uses the assignment Strategy                                                                                              |
| POST   | `/api/tickets/:id/claim`    | agent                                            | claims an unassigned ticket under a row lock                                                                              |
| POST   | `/api/tickets/:id/comments` | owning customer or assigned agent                | agents may set `isInternal`; customers never see internal comments                                                        |
| GET    | `/api/tickets/:id/history`  | agent or admin                                   | status audit trail                                                                                                        |
| GET    | `/api/tickets/:id/sla`      | agent or admin                                   | SLA deadline and breach state                                                                                             |

**Status lifecycle:** `open → in_progress → resolved → closed`, with `resolved → in_progress` allowed (reopen) and `closed` terminal. The legal transitions live in the state machine and nowhere else.

### 4.6 The craftkel AI API (`/api/v1`)

Auth: `X-API-Key`. Every request is rate-limited per key (§4.8). The API is deliberately generic and has no ticket logic.

| Method | Endpoint            | Tier      | Notes                                                                          |
| ------ | ------------------- | --------- | ------------------------------------------------------------------------------ |
| POST   | `/api/v1/chat`      | free, pro | send a `prompt` or a `messages` array (`role`/`content`), get an AI reply      |
| POST   | `/api/v1/summarize` | pro       | send `text` and an optional `max_sentences`, get a short summary               |
| POST   | `/api/v1/classify`  | pro       | send `text` and a list of `labels`, get the best label plus a confidence score |
| GET    | `/api/v1/usage`     | free, pro | the calling key's own usage: calls, tokens, rate-limit rejections, per day     |
| GET    | `/api/v1/models`    | free, pro | lists the models the key may use                                               |

**Request rules**

- Write endpoints (`chat`, `summarize`, `classify`) accept an optional `Idempotency-Key` header. If the same key is retried by the same API key within 24 hours, the **stored response is returned** and the AI provider is not called again. Reusing an idempotency key with a _different_ body returns `422`.
- Inputs are validated: maximum input length per tier, required fields, and the `labels` list size.
- Every successful and failed request is recorded in `ai_request_log` (key, endpoint, input tokens, output tokens, status, latency).

**Response shape** (success)

```json
{
  "success": true,
  "data": { "output": "...", "model": "craftkel-1" },
  "usage": { "input_tokens": 42, "output_tokens": 118, "cost": 3 }
}
```

### 4.7 Usage and Dashboards

`GET /api/api-keys/:id/usage` (web app) and `GET /api/v1/usage` (AI API) both run the same aggregation over `ai_request_log`: request counts, tokens consumed, rejected-by-limit counts and average latency, grouped by day. The admin dashboard shows platform-wide totals.

### 4.8 Rate Limiting (AI API)

Applies to every request authenticated with an API key. It does **not** apply to JWT routes (those have only the login throttle).

- The limiting logic is **implemented by hand and backed by MySQL**. No rate-limiting library.
- **Weighted token bucket.** Each key has one bucket row in `rate_limit_bucket` holding `TokensRemaining` and `LastRefilAt`. On every request, inside a transaction, the row is read with `SELECT ... FOR UPDATE`, refilled according to elapsed time, and charged. The charge is the request's **cost**, not a flat 1. Cost grows with input size (for example 1 token per 500 characters, minimum 1), because AI calls are expensive.
- **Tier capacities.** `free` = 60 tokens/min, `pro` = 600 tokens/min. The numbers live in configuration.
- **Strategy.** A `RateLimitStrategy` interface with at least two implementations, `TokenBucketStrategy` (default) and `SlidingWindowStrategy`. The middleware only asks the strategy "may this request proceed, and at what cost?" The algorithm is never inlined in the middleware.
- Exceeding the limit returns `429` with a `Retry-After` header and the remaining-quota headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`).
- Because this runs on every API request, the lookup is by primary key on the bucket row, and the usage aggregation is served by a compound index (see §6.5).

### 4.9 SLA and Escalation

- Each priority (`low`, `medium`, `high`, `critical`) has a response-time SLA, and every ticket stores its `BreachDueAt` deadline at creation.
- A **scheduled background job** (`node-cron` or a polling loop) periodically scans for tickets past their deadline with no agent response, **escalates the priority one level**, extends the deadline according to the new priority, and logs the event. The job runs independently of any HTTP request and is safe to run on overlapping ticks (row-locked, idempotent).

---

## 5. Backend Architecture Requirements

### 5.1 Repository layout

```
DatabaseSchema/   SQL schema and ERD
server/           Express backend
  controllers/    request/response handling only
  services/       business logic (cache, email, tickets, AI, rate limiting)
  repositories/   all SQL
  middleware/     auth, role, validation, rate limiting, errors
  routes/         route tables
  database/       MySQL pool and Redis client
public/           browser UI (HTML pages and page scripts)
src/              Tailwind source styles
```

### 5.2 Rules

1. **Repository / Service / Controller layering.** No SQL outside repositories; no business logic in controllers.
2. **State pattern for ticket status.** A `TicketStateMachine` (or a set of state classes) owns the legal transitions. `PATCH /tickets/:id/status` asks it "is this transition legal?" and never checks inline. Illegal transitions throw a custom error.
3. **Strategy pattern, three times.**
   - `AssignmentStrategy` with `RoundRobinAssignmentStrategy` and `LeastBusyAssignmentStrategy`, used whenever a ticket needs an agent. Only active agents are eligible.
   - `RateLimitStrategy` with `TokenBucketStrategy` and `SlidingWindowStrategy` (§4.8).
   - `AIProviderStrategy` with a `MockProvider` (deterministic canned responses, used in development and tests) and at least one real provider adapter. The AI service calls only the interface, so the provider can be swapped by configuration.
4. **Middleware chains.** Web routes: `verifyAccessToken → role check → validation → controller`. AI routes: `apiKeyAuth → tier check → validation → rateLimit → idempotency → controller`.
5. **Custom error hierarchy.** An `AppError` base with `NotFoundError`, `ForbiddenError`, `ValidationError`, `IllegalTransitionError`, `RateLimitExceededError` and similar, all handled by one centralized error middleware that produces the standard envelope.
6. **Redis caching.** A `cacheGetOrSet(key, query, params, ttl)` service reads through Redis and falls back to MySQL. Redis failures must never break a request. Writes invalidate the affected keys.
7. **Email.** Notifications go through an email service (Nodemailer plus Mailgen templates). Ticket notifications are logged to a table rather than sent externally in this version.

### 5.3 Configuration

All secrets and tunables come from environment variables: token secrets and expiries, login throttle limits, tier quotas, AI provider selection, Redis and MySQL connection details, and CORS origin.

---

## 6. Database Requirements

MySQL 8, InnoDB, `utf8mb4`.

### 6.1 Tables

| Table               | Purpose                  | Key columns                                                                                        |
| ------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| `admin`             | admin accounts           | AID, AName, AEmail, Apassword                                                                      |
| `agent`             | agent accounts           | AGID, AGName, AGEmail, AGPassword, AGLevel, IsActive, AID (creator)                                |
| `org`               | organizations            | OrgID, OrgName                                                                                     |
| `customer`          | customer accounts        | CID, CName, CEmail, CPassword, OrgID (nullable)                                                    |
| `customer_staging`  | unverified signups       | CEmail, CName, CpasswordHash, OTPcodeHash, otpexpiresAt, attemptCount, isFlagged, isFlaggedUntil   |
| `login_rate_limit`  | per-email login throttle | login_key, failed_count, window_start, is_locked, is_locked_until                                  |
| `refresh_token`     | session refresh tokens   | RefreshTokenID, tokenhash, expiresAt, revokedAt, aid / agid / cid                                  |
| `ticket`            | tickets                  | TID, TTitle, TBody, Tpriority, Tstatus, TcreationTime, TresolveTime, BreachDueAt, CID, AGID        |
| `ticket_comment`    | comments                 | CommentId, TID, Body, IsInternal, CreatedAt, AGID / CID                                            |
| `ticket_history`    | status audit trail       | HistoryId, TID, OldStatus, NewStatus, changedAt, AGID, AID                                         |
| `api_key`           | AI API keys              | ApiKeyID, ApiKeyHash, ApiPrefix, api_label, ApiTier, IsRevoked, Expiry, createdAt, OrgId, CID, AID |
| `rate_limit_bucket` | one bucket per key       | ApiKeyId, TokensRemaining, LastRefilAt                                                             |
| `idempotency_key`   | stored AI responses      | ApiKeyId, IdemKey, requestHash, responseBody, statusCode, createdAt, expiresAt                     |
| `ai_request_log`    | usage and audit          | RequestId, ApiKeyId, Endpoint, InputTokens, OutputTokens, Status, LatencyMs, createdAt             |
| `escalation_log`    | SLA auto-escalations     | LogId, TID, OldPriority, NewPriority, escalatedAt                                                  |
| `notification_log`  | outgoing notifications   | NotifId, recipient, subject, body, createdAt                                                       |

### 6.2 View

`agent_workload`: open (non-closed) ticket count per active agent, used by `LeastBusyAssignmentStrategy`.

### 6.3 Triggers

- **`ticket_history` insert:** on ticket status change, a row is inserted automatically with the old and new status. This is an audit trail generated at the database layer, not by application code remembering to log it.
- **`renew_otp_at`:** sets OTP creation and expiry times on `customer_staging` when an OTP is issued or renewed.

### 6.4 Row Locking

These are read-then-write operations that must be safe under concurrent requests, so each uses `SELECT ... FOR UPDATE` inside a transaction:

- refresh-token rotation,
- login throttle updates,
- agent activation toggling,
- API key revocation (admin and customer),
- ticket assignment and claiming,
- token-bucket refill and charge,
- idempotency-key reservation.

Deleting an org is guarded: it must fail cleanly while the org still has members or keys.

### 6.5 Indexes

- `ticket(Tstatus)` and `ticket(AGID)`, for list filters and workload counts.
- `ticket(CID)`, for a customer's own tickets.
- `api_key(ApiPrefix)`, because key lookup happens on every API request.
- `rate_limit_bucket(ApiKeyId)` is the primary key.
- `ai_request_log(ApiKeyId, createdAt)`, a compound index serving the usage aggregation.
- `idempotency_key(ApiKeyId, IdemKey)` unique, plus an index on `expiresAt` for cleanup.
- `refresh_token(tokenhash)` unique.

### 6.6 CHECK Constraints

- `agent.AGLevel IN (2, 3, 4)`
- `api_key.ApiTier IN ('free', 'pro')`
- `ticket.Tpriority IN ('low', 'medium', 'high', 'critical')`
- `ticket.Tstatus IN ('open', 'in_progress', 'resolved', 'closed')`
- `ticket_history` statuses restricted to the same four values
- `ticket_comment`: exactly one of `AGID` or `CID` is set
- `refresh_token`: exactly one of `aid`, `agid` or `cid` is set
- `api_key`: owned by exactly one of an org or a customer (`OrgId` XOR `CID`)
- `ticket.BreachDueAt > TcreationTime`

### 6.7 Foreign Key `ON DELETE` Behavior

Every foreign key has a deliberate rule, and each choice is justified in the ERD notes:

| Relationship                           | Rule     | Reason                                                                 |
| -------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `agent.AID → admin`                    | RESTRICT | an admin who created agents must not vanish silently                   |
| `customer.OrgID → org`                 | RESTRICT | an org with members cannot be deleted by accident                      |
| `api_key.OrgId → org`                  | CASCADE  | a deleted org takes its keys with it                                   |
| `api_key.CID → customer`               | CASCADE  | personal keys die with their owner                                     |
| `rate_limit_bucket.ApiKeyId → api_key` | CASCADE  | a bucket is meaningless without its key                                |
| `idempotency_key.ApiKeyId → api_key`   | CASCADE  | same reason                                                            |
| `ai_request_log.ApiKeyId → api_key`    | RESTRICT | usage history is an audit record; revoke instead of delete             |
| `refresh_token.* → account`            | CASCADE  | sessions end with the account                                          |
| `ticket.CID → customer`                | RESTRICT | tickets are records; removing a customer with tickets must be explicit |
| `ticket.AGID → agent`                  | SET NULL | a removed agent's tickets return to the unassigned pool                |
| `ticket_comment.TID → ticket`          | CASCADE  | comments belong to the ticket                                          |
| `ticket_history.TID → ticket`          | CASCADE  | history belongs to the ticket                                          |
| `escalation_log.TID → ticket`          | CASCADE  | same reason                                                            |

---

## 7. Front-End Requirements

The browser UI is a set of static pages served from `public/`, styled with Tailwind CSS, with one script per page, a shared toast component, shared auth helpers and shared validation helpers.

| Page                  | Role     | Purpose                                                 |
| --------------------- | -------- | ------------------------------------------------------- |
| `index`               | public   | landing page                                            |
| `signup`              | public   | two-step signup with OTP entry                          |
| `login`               | public   | login for all three roles, redirecting by role          |
| `customer-tickets`    | customer | own tickets, filters and pagination                     |
| `new-ticket`          | customer | ticket creation form                                    |
| `ticket-detail`       | all      | detail, comment thread and (for agents) status controls |
| `customer-api-keys`   | customer | create, list and revoke personal keys; view usage       |
| `agent-tickets`       | agent    | assigned and unassigned queue, claim and status actions |
| `admin-dashboard`     | admin    | platform-wide totals, SLA breaches, AI usage            |
| `admin-agents`        | admin    | provision agents, toggle status                         |
| `admin-organizations` | admin    | orgs and members                                        |
| `admin-api-keys`      | admin    | org keys and customers' keys, revoke                    |

The front end transparently refreshes the access token on `401` using the refresh endpoint, and redirects to login if refresh fails. A key's raw value is shown once in a copy-to-clipboard dialog, with a clear warning that it cannot be shown again.

---

## 8. Non-Functional Requirements

- Passwords and OTPs hashed, no exceptions. API keys and refresh tokens stored only as hashes.
- One consistent JSON response envelope across the whole API.
- Pagination on every list endpoint.
- Parameterized queries only; no string-built SQL.
- Input validation in dedicated middleware before any controller runs.
- Refresh cookie is `httpOnly`, `secure`, `sameSite=strict`.
- Redis outages degrade performance but never correctness.
- The AI API must never return another key's data, and must never log raw API keys.
- Background jobs must be idempotent and safe on overlapping runs.

---

## 9. Tech Stack

Node.js (ES modules), Express 5, MySQL via `mysql2` (connection pool, no ORM), Redis, `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `cors`, `dotenv`, Nodemailer with Mailgen, Tailwind CSS 4, `node-cron` (or a hand-rolled interval loop) for the SLA job. Plain ES6 classes for repositories and services.

---

## 10. Optional Stretch Goals (not required)

- Streaming responses from `/api/v1/chat`
- Per-endpoint rate limits as a second quota dimension
- Real SMTP delivery for ticket updates
- Canned responses for agents
- Full-text search over tickets
- Webhook notifications for key-quota warnings

---

## 11. Delivery Workflow

1. **Foundation:** schema, accounts, OTP signup, sessions, login throttle, Redis caching, email service, admin CLI.
2. **Administration:** agents, organizations and members, API key issuance and revocation for admins and customers, front-end pages for each.
3. **Tickets:** creation, assignment Strategy, state machine, comments, history trigger, SLA job, ticket pages.
4. **AI API:** API-key middleware, `RateLimitStrategy` and the weighted token bucket, idempotency, `AIProviderStrategy`, the four AI endpoints, usage aggregation.
5. **Hardening:** error hierarchy pass, indexes reviewed against real queries, ERD and `ON DELETE` justifications finalized, repo sent for review.
