# Attesta Vercel Stack Design

**Date:** 2026-08-28
**Status:** Approved for Phase 01 local implementation; local verification complete
**Scope:** MVP architecture reset and Phase 01 foundation

**Review input:** `NDIS Attesta PRD GTM Review.md` was reviewed on 2026-08-28. Its roadmap recommendations are triaged in `.planning/STATE.md`; none expand Phase 01 without separate approval.

## Decision Summary

Attesta will be a TypeScript Next.js application deployed on Vercel. Neon PostgreSQL is the application system of record; WorkOS AuthKit provides hosted authentication, MFA, SSO, and organization identity; Resend provides transactional email; and Vercel AI Gateway is the sole model-routing interface. Open-source libraries are preferred for application logic, validation, testing, and local development.

The architecture is deliberately single-application and modular. It keeps tenant authorization, audit integrity, and regulated records inside the application boundary instead of delegating business authorization or evidence lineage to SaaS vendors.

## Goals

1. Establish a runnable local application and a Vercel deployment path.
2. Create the tenant → site → worker/participant data model required by PLAT-01.
3. Make every implemented application mutation emit an append-only audit event in the same database transaction, with a complete immutable envelope hash; broader mutation coverage remains a later requirement gate.
4. Enforce tenant isolation with PostgreSQL row-level security and application-side tenant context.
5. Keep the path open for WorkOS, Resend, AI Gateway, evidence storage, and later compliance modules without leaking sensitive records to those services.

## Non-Goals

- WorkOS sign-in, MFA, SSO, and RBAC UI; those are Phase 02.
- Rule ingestion, briefings, Voice Receipts, registers, evidence exports, and QLD tenancy workflows.
- Real participant/worker data, audio files, or model calls in local fixtures or preview deployments.
- Selecting a production object-storage vendor; Phase 01 defines only an interface.
- SMS delivery. Resend is email-only for the MVP transport; carrier SMS requires a separately approved paid provider.

## Repository Shape

```text
apps/web/                 Next.js application, route handlers, and UI
packages/db/              Drizzle schema, migrations, Neon client, RLS helpers
packages/domain/          Tenant and audit domain types and invariants
packages/integrations/    Vendor interfaces; WorkOS, Resend, AI Gateway adapters follow later
infra/                    Vercel and database deployment configuration
tests/                    Cross-package integration and browser acceptance tests
docs/superpowers/         Design specs and implementation plans
```

The MVP remains one repository and one deployable application. Packages are boundaries inside the repository, not separate services.

## Runtime and Service Boundaries

### Vercel

The Next.js app, route handlers, and public pages deploy to Vercel. Regulated server functions use the Sydney region (`syd1`) where supported by the selected plan and runtime. `vercel.json` records the intended region and does not rely on the platform default.

### Neon PostgreSQL

Neon stores tenants, sites, workers, participants, audit events, and future module records. The primary database target is the Sydney/Australia region (`ap-southeast-2`) where available. All domain tables include `tenant_id` except the tenant table and global catalog tables. Every request that touches tenant data must establish a database tenant context before querying.

### WorkOS AuthKit

WorkOS is an identity provider, not the application authorization source. The application stores a local user record containing the WorkOS user identifier, local role, tenant membership, and status. Business authorization is evaluated from the local record and database policies. WorkOS receives identity data required for authentication; it never receives participant profiles, support notes, receipts, audio, or evidence.

### Resend

Resend is behind a notification interface. Phase 01 defines the interface and a no-op/test implementation; the Phase 04 email adapter will send only recipient address, template name, non-sensitive variables, and an application reference. No sensitive content is placed in subject lines, logs, or provider metadata. SMS is a separate interface with no production implementation until a paid carrier and privacy review are approved.

### Vercel AI Gateway

AI features call the Gateway through the Vercel AI SDK. The integration accepts a capability-specific model allow-list, budget, provider order, and redaction policy. Phase 01 defines the audit metadata shape only; no live AI call is required. Any future AI call is draft-only and records model, provider, version, prompt hash, output hash, and approver.

## Core Data Model

```text
TENANT 1──N SITE 1──N WORKER
                 └──N PARTICIPANT

TENANT 1──N APP_USER ──N USER_MEMBERSHIP
TENANT 1──N AUDIT_EVENT
```

Required Phase 01 fields:

- `tenant`: UUID, legal/display name, created timestamp.
- `site`: UUID, tenant UUID, name, status, created timestamp.
- `worker`: UUID, tenant UUID, site UUID, display name, status, created timestamp.
- `participant`: UUID, tenant UUID, site UUID, display name, preferred communication format, status, created timestamp.
- `audit_event`: UUID, tenant UUID, actor reference, action, entity type/id, canonical payload and payload hash, previous event hash, event hash, created timestamp/order, retention timestamp. The service generates the UUID, created timestamp, retention timestamp, and explicit sequence order before hashing and persists those values unchanged.

Worker and participant display names are test-safe in fixtures. Sensitive profile expansion belongs to later phases and must not weaken the audit or RLS invariants.

## Audit Invariants

All mutations use one database transaction:

1. Lock or otherwise safely read the tenant chain head.
2. Apply the domain mutation.
3. Canonicalize the audit payload with stable key ordering.
4. Generate immutable event values before hashing: event ID, created timestamp, retention timestamp, and an explicit `created_order` obtained from the controlled identity sequence after the tenant lock.
5. Compute `payload_hash = SHA-256(canonical_payload)` and `event_hash = SHA-256(previous_hash + canonical_immutable_envelope)`, where the envelope binds previous hash, event ID, tenant, actor, action, entity, payload/payload hash, retention timestamp, creation timestamp, and creation order.
6. Insert the audit event with the precomputed immutable values, then verify the returned persisted order and envelope recompute to the same event hash.
7. Commit only if both domain and audit writes succeed.

Audit events are append-only at the database role level. The application exposes no update or delete operation for them. A chain verifier recomputes every event and reports the first broken link.

## Tenant Isolation

The database enables RLS on tenant-owned tables and uses a transaction-local setting such as `app.tenant_id`. Policies compare the row `tenant_id` with that setting. Application repositories require a tenant context and reject missing or malformed context before executing a query. Tests cover cross-tenant read and write attempts.

## Privacy and Residency Boundary

The target data boundary is:

- regulated participant/worker PII persisted in Neon Australia where available;
- Vercel functions pinned to Sydney where supported;
- WorkOS limited to identity and organization data;
- Resend limited to delivery metadata;
- AI Gateway receives redacted data by default;
- no secrets, PII, audio, or evidence in source control, previews, logs, or fixtures.

Vendor regional handling, retention, backup, DPA, and failover terms remain production launch gates. This plan does not claim that the chosen vendors are automatically compliant merely because the application is configured for Sydney.

## Phase 01 integration contracts

Phase 01 exposes a notification interface with an email-shaped request and a no-op implementation for local/tests; it does not send SMS. It also exposes immutable AI audit metadata containing only model, provider, version, prompt hash, output hash, and human approver. The WorkOS boundary is limited to a provider-tagged subject reference; authentication and authorization remain deferred to Phase 02.

## Testing Strategy

- Unit tests verify canonical serialization, hash-chain construction, and validation errors.
- Database integration tests verify tenant creation, cascade relationships, RLS isolation, append-only audit behavior, and rollback when the audit write fails.
- Route tests verify the happy path and malformed/missing tenant context.
- Focused tests verify complete audit-envelope tampering detection, explicit persisted order, and notification/AI/identity boundary contracts.
- Playwright acceptance coverage verifies the local health page and the tenant bootstrap flow using synthetic data only.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` are required before Phase 01 completion.

## Official Service References

- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
- [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region)
- [WorkOS AuthKit](https://workos.com/docs/authkit/overview)
- [WorkOS users and organizations](https://workos.com/docs/authkit/users-organizations)
- [Resend regions and data residency](https://resend.com/docs/dashboard/domains/regions)

## Approval Gate

Phase 01 implementation was performed in an isolated Superpowers worktree and is locally verified by Task 6A evidence at commit `f4ac66d` under Node 22.14.0. This approval does not claim a real Vercel preview or production deployment, native Neon multi-session contention, vendor DPA/data-region/retention terms, or production credentials. Any Phase 02–10 code work requires a separate Superpowers brainstorming/design approval and approved detailed implementation plan.
