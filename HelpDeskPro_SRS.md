# Software Requirements Specification
# HelpDesk Pro — Support Ticketing System with a Rate-Limited Public API

**Version 1.0**

---

## 1. Introduction

### 1.1 Purpose

HelpDesk Pro is a support ticketing system, like a small Zendesk. Customers and
agents work tickets through a web/API interface using normal login sessions.
Separately, external integrators (e.g. another company's app) can create
tickets on a customer's behalf by calling a public API secured with an API key
— and that public API must be rate-limited per key, with tiered quotas.

Both halves share one ticket data model and one codebase; they are not two
separate apps bolted together.

### 1.2 Learning Goals

| Concept | Where it shows up |
|---|---|
| **State pattern** | Ticket status lifecycle — only certain transitions are legal |
| **Strategy pattern (x2)** | Agent assignment algorithm; rate-limiting algorithm |
| Two coexisting auth schemes | JWT sessions (agents/customers) + API keys (integrators), same ticket-creation endpoint |
| Rate limiting implemented by hand | Token bucket or sliding window, tracked in MySQL, no rate-limiting library |
| Scheduled background jobs | SLA breach detection and auto-escalation |
| Idempotency keys | Preventing duplicate tickets from retried API requests |
| Repository/Service/Controller layering, custom error hierarchy | Carried forward and reinforced from the previous project |
| Row-locking under concurrency | Ticket auto-assignment; rate-limit counter increments |

### 1.3 Scope

**In scope:** everything in Section 4.
**Explicitly out of scope:** real email/SMS delivery (log notifications to a table
instead), a knowledge base / article search, file attachments on tickets,
WebSocket live updates, a billing system for API key tiers. Section 9 lists
optional stretch goals — not required to call this done.

---

## 2. User & Access Model

Three account types this time, so you get both a global role check **and**
resource-based checks layered on top of it in the same project:

- **Admin** — manages agents, API keys, and can see/do everything.
- **Agent** — works tickets. Can only change status/comment on tickets assigned
  to them (or unassigned ones they claim), not every ticket in the system.
- **Customer** — can create tickets and see/comment on only their own tickets.

Separately, **API keys** are not tied to a login session at all — they belong to
an organization/customer account, have a tier (`free` / `pro`), a status
(`active` / `revoked`), and are used only for the external ticket-creation
endpoint (§4.4).

---

## 3. Authentication Requirements

- Agents are provisioned by an Admin (no public agent signup). Customers can
  self-signup. Passwords hashed — mandatory.
- Login issues a short-lived access token (JWT) + a long-lived refresh token
  (opaque, hash stored server-side), with a `/api/auth/refresh` rotation
  endpoint and a `/api/auth/logout` revocation endpoint — same pattern as
  before, now applied to three roles instead of two.
- **API keys** are a completely separate authentication mechanism:
  - Admin generates a key for an organization; the raw key is shown once
    and only its hash is stored.
  - External requests authenticate via an `X-API-Key` header.
  - The public ticket-creation endpoint (§4.4) must accept **either** a valid
    JWT **or** a valid API key — build one auth middleware that tries both and
    identifies the caller accordingly, rather than duplicating the route.

---

## 4. Functional Requirements & API Endpoints

### 4.1 Auth & Users

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | none | customers only |
| POST | `/api/auth/login` | none | rate-limit this route against brute force |
| POST | `/api/auth/refresh` | refresh token | rotates it |
| POST | `/api/auth/logout` | refresh token | revokes it |
| POST | `/api/agents` | admin | admin provisions an agent account |
| GET | `/api/users/me` | any authenticated | profile |

### 4.2 API Keys

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/api/api-keys` | admin | create a key for an org; raw key returned once |
| GET | `/api/api-keys` | admin | list keys (never return raw key again, only a masked version) |
| DELETE | `/api/api-keys/:id` | admin | revoke |
| GET | `/api/api-keys/:id/usage` | admin | request counts over time — an aggregation query |

### 4.3 Tickets — Core

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/api/tickets` | any authenticated | customer sees own only; agent sees assigned + unassigned; admin sees all — paginated, filterable by status/priority |
| GET | `/api/tickets/:id` | owning customer, assigned agent, or admin | detail + comment thread |
| PATCH | `/api/tickets/:id/status` | assigned agent or admin | **must go through the State pattern** — reject illegal transitions with a custom error, don't just write the new status |
| POST | `/api/tickets/:id/assign` | admin, or triggered automatically on creation | uses the assignment Strategy (§5) |
| POST | `/api/tickets/:id/comments` | owning customer or assigned agent | support an `internal_only` flag agents can set that customers never see |

### 4.4 Tickets — Public Creation Endpoint

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/api/tickets` | **JWT (customer) OR API key** | see below |

Requirements specific to this endpoint:

- If called with an API key, the request **must** include an `Idempotency-Key`
  header. If the same key is retried within some window (e.g. 24h), return the
  original ticket instead of creating a duplicate — don't just dedupe by
  ticket content, actually store and check the idempotency key.
- This request is subject to the API key's rate limit (§4.5). If called with a
  JWT instead, it is not.
- On successful creation, the ticket should be run through the assignment
  Strategy immediately (§5), not left unassigned by default.

### 4.5 Rate Limiting

Applies to every request authenticated via API key (not JWT-authenticated requests).

- Implement the actual limiting logic yourself, backed by MySQL — either a
  token bucket or a sliding window. Do not reach for an off-the-shelf
  rate-limiting library for this part; that's the point of the project.
- Each key's tier determines its quota (e.g. `free` = 60 req/min, `pro` = 600
  req/min) — this selection is itself a Strategy: a `RateLimitStrategy`
  interface with at least two concrete implementations (e.g.
  `TokenBucketStrategy`, `SlidingWindowStrategy`), chosen per key or globally,
  your call — just don't hardcode the algorithm inline in the middleware.
- Exceeding the limit returns `429` with a `Retry-After` header.
- Because this check runs on every single API-key request, think about
  indexing so it stays fast — this is where index design actually matters,
  not just "add an index because the SRS said so."

### 4.6 SLA & Escalation

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/api/tickets/:id/sla` | agent/admin | shows SLA deadline and whether it's breached |

- Each priority (`low`/`medium`/`high`/`critical`) has a response-time SLA.
- A **scheduled background job** (e.g. `node-cron`, or a simple polling loop —
  your choice) periodically scans for tickets past their SLA with no agent
  response, and auto-escalates their priority one level, logging the event.
  This must run independently of any incoming HTTP request.

---

## 5. Backend Architecture Requirements

1. **Repository / Service / Controller layering** — same discipline as before.
   No SQL outside repositories, no business logic in controllers.
2. **State pattern for ticket status** — encapsulate legal transitions (e.g. in
   a `TicketStateMachine` or a set of state classes). `PATCH /tickets/:id/status`
   asks the state machine "is this transition legal?" rather than checking
   inline. Illegal transitions throw a custom error.
3. **Strategy pattern, twice:**
   - `AssignmentStrategy` interface with `RoundRobinAssignmentStrategy` and
     `LeastBusyAssignmentStrategy` implementations, used whenever a ticket
     needs an agent.
   - `RateLimitStrategy` interface with at least two implementations, used by
     the API-key middleware (§4.5).
4. **Dual authentication middleware** — one middleware for the public
   ticket-creation route that accepts a valid JWT *or* a valid API key and
   attaches a consistent "who is calling" object either way, so the
   controller doesn't need to know which auth method was used.
5. **Custom error class hierarchy** (`AppError` base, with `NotFoundError`,
   `ForbiddenError`, `ValidationError`, `RateLimitExceededError`, etc.) caught
   by one centralized error-handling middleware.

---

## 6. Database Requirements

- **View:** agent workload (open-ticket count per agent), used by the
  least-busy assignment strategy.
- **Trigger:** on ticket status change, auto-insert a row into a
  `ticket_history` table — an audit trail generated at the database layer, not
  by application code remembering to log it.
- **Row-locking:** ticket assignment and rate-limit counter updates are both
  read-then-write operations that must be safe under concurrent requests —
  use `SELECT ... FOR UPDATE` inside a transaction for both.
- **Indexes:** `tickets.status`, `tickets.assigned_agent_id`, and a compound
  index supporting the rate-limit lookup (likely `api_key_id` + timestamp).
- **`CHECK` constraint:** e.g. `priority` restricted to a fixed set of values,
  or `sla_due_at > created_at`.
- Deliberate `ON DELETE` behavior on every foreign key, same as before —
  justify each choice.

---

## 7. Non-Functional Requirements

- Passwords hashed, no exceptions.
- One consistent JSON response envelope across the whole API.
- Pagination on every list endpoint.
- Rate limiting on `/api/auth/login` (separate, simpler concern from the
  API-key rate limiting in §4.5 — a basic per-IP/per-account throttle is fine
  here, a library is fine here too since it's not the learning objective).
- Idempotency handling on the public ticket-creation endpoint (§4.4).

---

## 8. Suggested Tech Stack

Node.js, Express, MySQL/mysql2, JWT, bcrypt — same core as before, plus
`node-cron` (or a hand-rolled interval loop) for the SLA escalation job.
Continue with plain ES6 classes for repositories/services, no ORM.

---

## 9. Optional Stretch Goals (not required)

- Real email delivery for ticket updates
- Canned/template responses for agents
- Full-text search over ticket content
- A second rate-limit tier dimension (e.g. per-endpoint limits, not just global per key)

---

## 10. Workflow

1. Design your own ERD from this document — entities, keys, relationships, and
   `ON DELETE` choices — and send it over before writing code.
2. Build it.
3. Send the repo for review.
