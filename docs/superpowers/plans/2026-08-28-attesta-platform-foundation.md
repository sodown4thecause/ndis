# Attesta Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Attesta foundation with tenant/site/worker/participant records, Neon-compatible PostgreSQL row-level security, and an immutable hash-chained audit trail.

**Architecture:** Use a single pnpm workspace containing a Next.js app and focused packages for database access, domain invariants, and integrations. Deploy the app on Vercel with Sydney execution configuration and use Neon PostgreSQL as the system of record; WorkOS, Resend, and Vercel AI Gateway remain explicit adapters for later phases.

**Tech Stack:** Node.js 22.x, pnpm 11.5.0, TypeScript, Next.js, Drizzle ORM, PostgreSQL, Neon serverless driver, Zod, Vitest, Playwright, Vercel configuration, and permissively licensed open-source tooling.

**Spec:** `docs/superpowers/specs/2026-08-28-attesta-vercel-stack-design.md`

**Phase 01 status (2026-08-28):** Tasks 1–5 and Task 6A are complete for local verification, and Final C completes the foundation-create audit envelope plus Phase 01 integration contracts. PLAT-02 remains pending for update/approval/export coverage; PLAT-03 remains pending for production TLS/AES/preview/log guarantees. Task 6A's final clean-checkout evidence at commit `f4ac66d` passed under Node 22.14.0 for frozen install, lint, typecheck, 56 unit tests, 7 live PGlite database tests, Playwright, Next build, and diff checks. This is not a production deployment claim: native Neon multi-session contention, real Vercel preview/production deployment, vendor DPA/data-region/retention terms, and production credentials remain launch gates. Phases 02–10 are roadmap outlines only and require Superpowers brainstorming/design approval plus an approved detailed design and implementation plan before code work; Phase 10 remains post-MVP planning.

## Review Disposition

The 2026-08-28 PRD/GTM review is advisory input. Phase 01 remains limited to platform foundation, tenant isolation, and audit integrity. Restrictive-practice/BSP records are planned for Phase 06 after legal review; evidence coverage signals follow the evidence vault; shift handover, accessible communication/consent, and AQA workspace remain Phase 10 backlog items. No compliance score, automated adverse action, restrictive-practice authorization, or automatic Commission submission is added to this plan.

## Global Constraints

- The target infrastructure is Vercel, Neon, WorkOS, Resend, and Vercel AI Gateway as defined in the design spec.
- No secrets, PII, audio, or evidence files in source control, previews, logs, prompts, or test fixtures.
- Every implemented tenant-owned mutation writes its audit event in the same transaction as the domain mutation; complete-envelope hashing is locally verified for foundation-create events, while broader PLAT-02 mutation coverage remains pending.
- Audit events are append-only and verify through SHA-256 chain links.
- Tenant-owned tables require PostgreSQL RLS and a transaction-local tenant context.
- WorkOS is identity only; application RBAC and tenant membership are enforced from Neon records.
- Resend is an email adapter; SMS has no production transport in Phase 01.
- AI Gateway metadata is defined but no live model call or real user data is used in Phase 01.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` must pass.

### Task 1: Create the workspace scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/api/health/route.ts`
- Create: `packages/domain/package.json`
- Create: `packages/db/package.json`
- Create: `packages/integrations/package.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Produces a workspace where `pnpm dev` starts the web app, `GET /api/health` returns `{ "status": "ok" }`, and package imports use stable workspace names.

- [ ] **Step 1: Write the failing health and package-resolution tests**

Create `apps/web/app/api/health/route.test.ts` with a test that imports `GET`, calls it, and expects HTTP 200 and `{ status: "ok" }`. Create `packages/domain/src/index.test.ts` with a test importing the package entry point.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm vitest run apps/web/app/api/health/route.test.ts packages/domain/src/index.test.ts`
Expected: FAIL because the workspace files and exports do not exist.

- [ ] **Step 3: Add the minimal workspace and health route**

Set the root package manager to `pnpm@11.5.0`, define `apps/*` and `packages/*` workspaces, add the scripts `dev`, `lint`, `typecheck`, `test`, `test:e2e`, and `build`, and implement the route as a cached-free `Response.json({ status: "ok" })` handler. Add a package export from `packages/domain/src/index.ts`.

- [ ] **Step 4: Install and run the focused tests**

Run: `corepack pnpm install`; then `pnpm vitest run apps/web/app/api/health/route.test.ts packages/domain/src/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the scaffold**

Run: `git add package.json pnpm-workspace.yaml tsconfig.json .gitignore apps packages vitest.config.ts playwright.config.ts; git commit -m "chore: scaffold attesta workspace"`

### Task 2: Implement the domain identifiers and audit hash chain

**Files:**
- Create: `packages/domain/src/ids.ts`
- Create: `packages/domain/src/audit.ts`
- Create: `packages/domain/src/tenant.ts`
- Test: `packages/domain/src/audit.test.ts`
- Test: `packages/domain/src/tenant.test.ts`

**Interfaces:**
- Produces `type TenantId = string`, `type AuditHash = string`, `canonicalize(value: unknown): string`, `computeAuditHash(previousHash: AuditHash | null, payload: string): AuditHash`, `verifyAuditChain(events: AuditEvent[]): AuditVerification`, and `createTenantBootstrap(input: NewTenantInput): TenantBootstrap`.

- [ ] **Step 1: Write failing tests for canonicalization and chain verification**

Cover stable key ordering, null previous hash, changed payload detection, broken previous-link detection, empty chain success, and tenant bootstrap validation for blank names.

- [ ] **Step 2: Run the focused tests**

Run: `pnpm vitest run packages/domain/src/audit.test.ts packages/domain/src/tenant.test.ts`
Expected: FAIL because the domain functions are not implemented.

- [ ] **Step 3: Implement the minimal pure domain functions**

Use Web Crypto or Node’s built-in SHA-256 implementation. Canonicalization must recursively sort object keys, preserve array order, and serialize strings/numbers/booleans/null without locale-dependent formatting. `verifyAuditChain` must return `{ valid: boolean; checked: number; firstInvalidIndex: number | null }`.

- [ ] **Step 4: Run the focused tests**

Run: `pnpm vitest run packages/domain/src/audit.test.ts packages/domain/src/tenant.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the domain package**

Run: `git add packages/domain; git commit -m "feat: add audit chain domain invariants"`

### Task 3: Add the Neon/Drizzle schema and migrations

**Files:**
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/tenant-context.ts`
- Create: `packages/db/src/repositories/tenant-repository.ts`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/migrations/0000_foundation.sql`
- Create: `packages/db/src/schema.test.ts`
- Create: `packages/db/src/tenant-context.test.ts`

**Interfaces:**
- Produces tables `tenants`, `sites`, `workers`, `participants`, and `audit_events`; `withTenant<T>(tenantId: string, operation: (db) => Promise<T>): Promise<T>`; and repository methods `createTenantBootstrap`, `getTenant`, and `listTenantPeople`.

- [ ] **Step 1: Write failing schema and tenant-context tests**

Test that the schema exposes all required columns, rejects an invalid tenant identifier before database access, sets `app.tenant_id` inside a transaction, and clears the context when the transaction finishes.

- [ ] **Step 2: Run the focused tests**

Run: `pnpm vitest run packages/db/src/schema.test.ts packages/db/src/tenant-context.test.ts`
Expected: FAIL because the database package is not implemented.

- [ ] **Step 3: Implement schema, client, and migrations**

Use UUID primary keys, UTC timestamps, explicit foreign keys, tenant indexes, and status fields constrained to known values. Add RLS enablement and policies for each tenant-owned table. Create the audit table with `previous_hash`, `event_hash`, `payload_hash`, `action`, `entity_type`, `entity_id`, actor reference, and retention timestamp. Use `DATABASE_URL` only at runtime and throw a clear configuration error if it is missing.

- [ ] **Step 4: Run tests and generate migration output**

Run: `pnpm vitest run packages/db/src/schema.test.ts packages/db/src/tenant-context.test.ts`; then `pnpm db:check`.
Expected: PASS and migration validation succeeds without contacting a production database.

- [ ] **Step 5: Commit the database foundation**

Run: `git add packages/db; git commit -m "feat: add tenant database foundation"`

### Task 4: Implement transactional bootstrap and append-only audit persistence

**Files:**
- Create: `packages/db/src/repositories/audit-repository.ts`
- Create: `packages/db/src/services/foundation-service.ts`
- Test: `packages/db/src/services/foundation-service.test.ts`
- Test: `packages/db/src/repositories/audit-repository.test.ts`

**Interfaces:**
- Produces `bootstrapTenant(input: NewTenantInput): Promise<TenantBootstrapResult>`, `appendAuditEvent(input: AuditEventInput): Promise<AuditEvent>`, and `verifyTenantAuditChain(tenantId: TenantId): Promise<AuditVerification>`.

- [ ] **Step 1: Write failing transaction tests**

Test that tenant bootstrap creates one tenant, one site, one worker, one participant, and the required audit events; a second tenant cannot read the first tenant; audit events have linked hashes; and a forced audit insert failure rolls back all domain rows.

- [ ] **Step 2: Run the focused tests**

Run: `pnpm vitest run packages/db/src/services/foundation-service.test.ts packages/db/src/repositories/audit-repository.test.ts`
Expected: FAIL because the service and repository are not implemented.

- [ ] **Step 3: Implement the transaction service**

Create a transaction helper that sets tenant context, performs domain writes, obtains the current chain head with the required lock strategy, generates immutable event values, canonicalizes the payload and complete envelope, computes both hashes, inserts the audit row with explicit order/timestamps, verifies the persisted row matches the hashed envelope, and commits only after all writes succeed. Do not expose update/delete methods for audit rows.

- [ ] **Step 4: Run the focused integration tests against disposable PostgreSQL**

Run: `pnpm test:db`; expected: PASS with synthetic tenants and a clean disposable database. If Docker is unavailable, report the environment blocker rather than weakening RLS tests.

- [ ] **Step 5: Commit the foundation service**

Run: `git add packages/db; git commit -m "feat: add transactional tenant bootstrap"`

### Task 5: Expose the foundation through a safe route and local page

**Files:**
- Create: `apps/web/app/api/tenants/route.ts`
- Create: `apps/web/app/api/tenants/route.test.ts`
- Create: `apps/web/app/bootstrap/page.tsx`
- Create: `apps/web/lib/env.ts`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes `bootstrapTenant` from Task 4.
- Produces `POST /api/tenants` accepting `{ name, siteName, workerName, participantName }` and returning the created synthetic bootstrap identifiers; rejects missing fields with HTTP 400 and never accepts a caller-supplied tenant ID.

- [ ] **Step 1: Write failing route tests**

Test valid bootstrap returns HTTP 201, blank names return HTTP 400, malformed JSON returns HTTP 400, and health remains independent of database credentials.

- [ ] **Step 2: Run route tests**

Run: `pnpm vitest run apps/web/app/api/tenants/route.test.ts`
Expected: FAIL because the route and environment validation are not implemented.

- [ ] **Step 3: Implement validation and route wiring**

Validate request bodies with Zod, call the foundation service, return only non-sensitive IDs and display names, and map known domain/database errors to stable responses without exposing stack traces or SQL. Keep the bootstrap page clearly labelled synthetic development data.

- [ ] **Step 4: Run route tests and start the app**

Run: `pnpm vitest run apps/web/app/api/tenants/route.test.ts`; then `pnpm dev`.
Expected: route tests PASS and the local page plus `/api/health` load successfully.

- [ ] **Step 5: Commit the vertical slice**

Run: `git add apps/web; git commit -m "feat: add tenant bootstrap route"`

### Task 6A: Add Vercel and Neon deployment configuration and verify the phase locally

**Files:**
- Create: `vercel.json`
- Create: `.env.example`
- Create: `packages/db/README.md`
- Create: `docs/development.md`
- Modify: `.planning/STATE.md`
- Modify: `.planning/ROADMAP.md`
- Test: `tests/e2e/foundation.spec.ts`

**Interfaces:**
- Produces documented local setup, a Vercel project configuration targeting `syd1`, Neon migration commands, and a browser test covering health and synthetic tenant bootstrap.

- [ ] **Step 1: Write the failing browser acceptance test**

Create a Playwright test that visits `/`, checks the Attesta foundation status, submits the synthetic bootstrap form, and verifies the success response without asserting real data.

- [ ] **Step 2: Run the browser test before configuration**

Run: `pnpm test:e2e`; expected: FAIL until the local app and test fixtures are available.

- [ ] **Step 3: Add deployment and setup documentation**

Configure `vercel.json` with the Sydney function region, document `DATABASE_URL` and future vendor variables without values, and document Neon migration/branching commands. Do not add secrets or real vendor keys.

- [ ] **Step 4: Run the complete verification suite**

Run: `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:e2e`; `pnpm build`; `git diff --check`.
Expected: all commands PASS and no secret scanner or diff-check warning is present.

- [ ] **Step 5: Update phase state and commit the verified phase**

Phase 01 is marked locally complete in `.planning/STATE.md` and `.planning/ROADMAP.md` from the Task 6A evidence above; native Neon contention, real Vercel preview/production deployment, vendor terms, and production credentials remain launch gates.
