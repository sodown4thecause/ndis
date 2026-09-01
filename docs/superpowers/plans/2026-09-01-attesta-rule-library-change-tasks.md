# Attesta Rule Library and Change Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase 03's manually curated global rule catalog, deterministic version diffs, tenant impact-assessment decisions, and exact administrative change tasks without automated monitoring or live AI.

**Architecture:** Add pure catalog, diff, assessment, and task invariants to `@attesta/domain`; implement a manual capture adapter and draft-only AI fallbacks in `@attesta/integrations`; persist the tenantless catalog and tenant workflows behind PostgreSQL routines, forced RLS, and Phase 02 authorized transactions in `@attesta/db`; expose one unlinked platform command endpoint and protected Quality Lead screens in Next.js. Catalog publication writes a separate tenantless hash chain, while tenant decisions reuse the Phase 02 tenant audit V2 transaction boundary.

**Tech Stack:** Node.js 22.14.0, pnpm 11.5.0, TypeScript 5.9.3, Next.js 16.3.3, React 19.2.8, Drizzle ORM 0.45.2, PostgreSQL/Neon, Zod 4.4.3, Vitest 4.1.11, PGlite 0.5.8, and Playwright 1.62.1.

**Spec:** `docs/superpowers/specs/2026-08-31-attesta-rule-library-change-tasks-design.md`

## Entry Gate

- Begin implementation only after Phase 02 Tasks 1–11 are merged or this worktree is rebased onto their final commits.
- Run `node --version` and require exactly `v22.14.0` before installing or generating migrations.
- Confirm migrations `0001_phase02_audit_compatibility.sql` through `0006_phase02_audit_v2_cutover.sql` and their journal snapshots are present before creating `0007` or `0008`.
- Re-inspect, rather than copy, the final signatures of `VerifiedWorkOSIdentity`, `AuthorizedTransaction`, `withAuthorizedRequest`, `requireAuthorizedRequest`, `requireRecentAuthentication`, tenant audit V2, retention bindings, and platform-operator authorization.
- Phase 02 does not currently expose a branded platform catalog transaction. Task 7 must add that narrow seam from the final `PrivilegedWorkOSIdentity` and `platform_operator_principals` contracts; it must not reuse a tenant transaction or accept a plain caller-built identity.
- Preserve Phase 02's generic authorization-denial behavior, canonical audit hashing, transaction-bound tenant context, and database-role separation.
- If Phase 02 changes any consumed contract, update this plan's call sites without weakening the boundary and record the deviation in the implementation commit.

## Global Constraints

- Manual bounded UTF-8 text or Markdown is the only source input. No PDF, DOCX, HTML parsing, binary storage, crawling, polling, schedules, or automated monitoring ships here.
- The capture port must remain adapter-shaped so a later monitor can emit the same `SourceSnapshotCandidate`; neither manual nor future adapters may publish.
- The first published version is a baseline. Only later versions create deterministic diffs.
- No unverified regulatory text, real worker/participant data, credentials, raw prompts, model output, tokens, or database detail enters source control, fixtures, previews, responses, or logs.
- No live AI provider call ships. The deterministic fake is test-only; the runtime default is the empty human-authored fallback.
- Catalog writes are platform-only. Tenant and actor authority always comes from the verified Phase 02 session, never request-body identifiers.
- Every catalog mutation and `platform_catalog_events` append is one transaction. Every assessment mutation/decision, task materialization, and tenant audit V2 append is one authorized transaction.
- Approval binds the exact diff and immutable revision hashes. Rejection and approved `no_action_required` decisions create zero tasks.
- All catalog and tenant workflow tables use immutable or append-only enforcement, tenant-aware foreign keys where applicable, and least-privilege grants.
- Phase 03 retention rules are immutable seven-year product-policy evidence baselines, not statutory claims. Destructive cleanup remains disabled pending legal/privacy approval and legal-hold evaluation.
- Web implementation must first read the relevant Next.js 16.3.3 guides under `apps/web/node_modules/next/dist/docs/`, as required by `apps/web/AGENTS.md`.
- The UI must work with keyboard-only navigation, narrow reflow, 200% zoom, high contrast, reduced motion, visible focus, explicit Added/Removed text, error-summary focus, and dialog focus restoration.
- Product copy records and suggests; it never claims compliance, certification, breach, legal sufficiency, or regulatory approval.

## Planned File Structure

```text
packages/domain/src/
  catalog.ts                    # capture normalization and catalog lifecycle rules
  rule-diff.ts                  # paragraph/token diff and canonical diff hash
  impact-assessment.ts          # immutable revision and decision invariants
  change-tasks.ts               # task scope copying and idempotency
packages/integrations/src/
  rule-source/manual-source-adapter.ts
  impact-draft/disabled-impact-draft-adapter.ts
  impact-draft/fake-impact-draft-adapter.ts
packages/db/src/schema/
  catalog.ts                    # tenantless catalog and platform catalog chain
  impact.ts                     # assessments, revisions, actions, decision data
  change-tasks.ts               # administrative tasks and copied scopes
packages/db/src/repositories/
  catalog-repository.ts
  impact-assessment-repository.ts
  change-task-repository.ts
packages/db/src/services/
  catalog-service.ts
  impact-assessment-service.ts
apps/web/lib/rules/
  route-schemas.ts
  route-errors.ts
apps/web/app/api/platform/rule-catalog/route.ts
apps/web/app/api/rules/**
apps/web/app/api/impact-assessments/**
apps/web/app/api/change-tasks/route.ts
apps/web/app/(protected)/app/rules/**
apps/web/app/(protected)/app/change-tasks/page.tsx
apps/web/components/rules/**
```

---

### Task 1: Add source capture and catalog lifecycle domain contracts

**Files:**
- Create: `packages/domain/src/catalog.ts`
- Create: `packages/domain/src/catalog.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/index.test.ts`

**Interfaces:**

```ts
export const RULE_MODULES = ["core", "sil_supplementary", "sil_quality_indicators"] as const;
export type RuleModule = (typeof RULE_MODULES)[number];
export type SourceCaptureMode = "manual_curated" | "automated_monitor";

export interface SourceSnapshotCandidate {
  sourceKey: string;
  module: RuleModule;
  title: string;
  publisher: string;
  jurisdiction: string;
  canonicalUrl: string;
  content: string;
  publisherVersionLabel: string | null;
  publicationDate: string | null;
  effectiveDate: string | null;
  curatorNote: string;
  captureMode: SourceCaptureMode;
}

export interface NormalizedSourceSnapshot {
  candidate: Omit<SourceSnapshotCandidate, "content">;
  submittedContent: string;
  canonicalContent: string;
  contentHash: string;
  capturedAt: string;
}

export interface SourceCaptureAdapter {
  capture(candidate: SourceSnapshotCandidate): Promise<NormalizedSourceSnapshot>;
}

export interface ObligationCandidate {
  obligationKey: string;
  module: RuleModule;
  sourceLocator: string;
  authoritativeText: string;
}

export type RuleVersionState = "candidate" | "published" | "superseded" | "rejected" | "withdrawn";
export interface RuleVersionTransitionInput {
  sourceId: string;
  versionId: string;
  fromState: RuleVersionState;
  toState: RuleVersionState;
  predecessor: Readonly<{ sourceId: string; versionId: string }> | null;
  currentPublishedVersionId: string | null;
  reason: string | null;
}
export type RuleVersionTransition = Readonly<{
  nextState: RuleVersionState;
  supersedeVersionId: string | null;
  decisionReason: string | null;
}>;

export function normalizeSourceContent(content: string): string;
export function validateSourceSnapshotCandidate(input: unknown): SourceSnapshotCandidate;
export function normalizeSourceSnapshot(candidate: SourceSnapshotCandidate, capturedAt: string): NormalizedSourceSnapshot;
export function validateObligationCandidates(input: unknown): readonly ObligationCandidate[];
export function computeObligationContentHash(authoritativeText: string): string;
export function validateRuleVersionTransition(input: RuleVersionTransitionInput): RuleVersionTransition;
```

- [ ] **Step 1: Write failing domain tests**

Cover Unicode NFC, CRLF-to-LF normalization, preservation of all other whitespace, canonical UTF-8 SHA-256 hashing, input byte/field bounds, HTTPS URL validation without fetching, ISO-8601 publication/effective dates, supported module/capture-mode values, server-supplied capture time, duplicate hash equality, baseline/later-version transition validation, same-source predecessor validation, allowed rejection/withdrawal transitions, stable obligation keys/locators, and authoritative obligation-text hashing. Use a compile-time test adapter with `captureMode: "automated_monitor"` to prove the shared port accepts a future monitor without implementing one.

- [ ] **Step 2: Verify the tests fail for missing contracts**

Run: `pnpm vitest run packages/domain/src/catalog.test.ts packages/domain/src/index.test.ts`

Expected: FAIL because the catalog module and exports do not exist.

- [ ] **Step 3: Implement the smallest pure catalog domain**

Use Zod only at the untrusted input boundary. Accept the server-generated capture time as an explicit pure-function input, hash the exact canonical content bytes, and return discriminated validation errors without echoing source or obligation content. Keep persistence, actor identity, publication, and audit outside this module.

- [ ] **Step 4: Verify focused tests and types**

Run: `pnpm vitest run packages/domain/src/catalog.test.ts packages/domain/src/index.test.ts && pnpm --filter @attesta/domain typecheck`

Expected: PASS with catalog exports resolving through `@attesta/domain`.

- [ ] **Step 5: Commit the domain slice**

Run: `git add packages/domain/src/catalog.ts packages/domain/src/catalog.test.ts packages/domain/src/index.ts packages/domain/src/index.test.ts && git commit -m "feat: add rule catalog domain contracts"`

### Task 2: Implement the deterministic paragraph and token diff

**Files:**
- Create: `packages/domain/src/rule-diff.ts`
- Create: `packages/domain/src/rule-diff.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/index.test.ts`

**Interfaces:**

```ts
export const RULE_DIFF_ALGORITHM_VERSION = "paragraph-token-v1";
export type RuleDiffToken = { kind: "equal" | "added" | "removed"; text: string };
export type RuleDiffHunk = {
  paragraphGroup: number;
  kind: "equal" | "added" | "removed";
  paragraphIndex: number;
  paragraph: string;
  tokens: readonly RuleDiffToken[];
};
export interface CreateRuleDiffInput {
  fromVersionId: string;
  toVersionId: string;
  fromContentHash: string;
  toContentHash: string;
  fromCanonicalContent: string;
  toCanonicalContent: string;
}
export interface RuleDiff {
  algorithmVersion: typeof RULE_DIFF_ALGORITHM_VERSION;
  fromVersionId: string;
  toVersionId: string;
  fromContentHash: string;
  toContentHash: string;
  structuredDiff: readonly RuleDiffHunk[];
  diffHash: string;
}
export function createRuleDiff(input: CreateRuleDiffInput): RuleDiff;
export function computeRuleDiffHash(input: Omit<RuleDiff, "diffHash">): string;
```

- [ ] **Step 1: Write failing golden and property-style tests**

Cover identical input, paragraph addition/removal/replacement, repeated paragraphs, punctuation, Unicode, blank paragraphs, token highlighting, stable linear order, exact version/hash binding, frozen result structures, and reproducible hashes across repeated calls. Use invented non-regulatory fixture text only.

- [ ] **Step 2: Verify the diff tests fail**

Run: `pnpm vitest run packages/domain/src/rule-diff.test.ts`

Expected: FAIL because `rule-diff.ts` does not exist.

- [ ] **Step 3: Implement `paragraph-token-v1`**

Split canonical source content into paragraphs, calculate a deterministic sequence diff, and represent a changed paragraph group as linked removed/added hunks with token-level equal/removed/added spans. Canonicalize the complete `structuredDiff` result with Phase 02's existing `canonicalize` helper before SHA-256 hashing. Use this one field name in the domain, adapter input, database JSON, API view model, and UI. Do not use locale-aware sorting, timestamps, random values, or HTML in the result.

- [ ] **Step 4: Verify focused tests and types**

Run: `pnpm vitest run packages/domain/src/rule-diff.test.ts packages/domain/src/audit.test.ts && pnpm --filter @attesta/domain typecheck`

Expected: PASS, including unchanged Phase 02 canonicalization tests.

- [ ] **Step 5: Commit the diff engine**

Run: `git add packages/domain/src/rule-diff.ts packages/domain/src/rule-diff.test.ts packages/domain/src/index.ts packages/domain/src/index.test.ts && git commit -m "feat: add deterministic rule diffs"`

### Task 3: Add assessment, decision, change-task, and authorization invariants

**Files:**
- Create: `packages/domain/src/impact-assessment.ts`
- Create: `packages/domain/src/impact-assessment.test.ts`
- Create: `packages/domain/src/change-tasks.ts`
- Create: `packages/domain/src/change-tasks.test.ts`
- Modify: `packages/domain/src/authorization.ts`
- Modify: `packages/domain/src/authorization.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/index.test.ts`

**Interfaces:**

`packages/domain/src/impact-assessment.ts` produces:

```ts
export type ImpactOutcome = "action_required" | "no_action_required";
export type ImpactRevisionProvenance = "human_authored" | "ai_assisted";
export type AssessmentState = "draft" | "pending_approval" | "approved" | "rejected" | "stale";
export type ImpactActionSuggestion = Readonly<{
  actionKey: string;
  actionText: string;
  rationale: string;
  effectiveDate: string | null;
  roleTargets: readonly string[];
  documentTargets: readonly string[];
}>;
export type ImpactDraftInput = Readonly<{
  sourceVersionId: string;
  diffId: string;
  diffHash: string;
  structuredDiff: readonly RuleDiffHunk[];
  allowedRoles: readonly string[];
  allowedDocumentTypes: readonly string[];
}>;
export interface ImpactDraftAdapter {
  draft(input: ImpactDraftInput): Promise<ImpactDraftResult>;
}
export class ImpactDraftUnavailableError extends Error {
  readonly code = "impact_draft_unavailable";
  constructor();
}
export type ImpactDraftResult = Readonly<{
  provenance: "ai_assisted";
  suggestedOutcome: ImpactOutcome;
  suggestedActions: readonly ImpactActionSuggestion[];
  model: string;
  provider: string;
  modelVersion: string;
  promptHash: string;
  outputHash: string;
}>;
export type HumanAuthoredAssessmentDraft = Readonly<{
  provenance: "human_authored";
  outcome: null;
  narrative: "";
  actions: readonly [];
}>;
export type ImpactActionRevisionInput = Readonly<{
  actionKey: string;
  actionText: string;
  rationale: string;
  effectiveDate: string | null;
  siteIds: readonly string[];
  roles: readonly string[];
  documentReferences: readonly string[];
}>;
export type ImpactAssessmentRevisionInput = Readonly<{
  assessmentId: string;
  sourceVersionId: string;
  diffId: string;
  diffHash: string;
  revisionNumber: number;
  provenance: ImpactRevisionProvenance;
  narrative: string;
  outcome: ImpactOutcome;
  effectiveDate: string | null;
  actions: readonly ImpactActionRevisionInput[];
  aiMetadata: Pick<ImpactDraftResult, "model" | "provider" | "modelVersion" | "promptHash" | "outputHash"> | null;
}>;
export type ImpactAssessmentTransitionInput = Readonly<{
  currentState: AssessmentState;
  requestedState: AssessmentState;
}>;
export type ImpactDecisionInput = Readonly<{
  state: AssessmentState;
  decision: "approved" | "rejected";
  reason: string;
  submittedRevisionId: string;
  submittedRevisionHash: string;
  requestedRevisionId: string;
  requestedRevisionHash: string;
  submittedDiffHash: string;
  currentDiffHash: string;
  sourceVersionEligible: boolean;
  recentAuthenticationSatisfied: boolean;
}>;
export type ValidatedImpactDecision = Readonly<{
  decision: "approved" | "rejected";
  reason: string;
  createTasks: boolean;
}>;
export function createEmptyHumanAuthoredDraft(): HumanAuthoredAssessmentDraft;
export function computeImpactAssessmentRevisionHash(input: ImpactAssessmentRevisionInput): string;
export function validateImpactAssessmentTransition(input: ImpactAssessmentTransitionInput): AssessmentState;
export function validateImpactDecision(input: ImpactDecisionInput): ValidatedImpactDecision;
```

`packages/domain/src/change-tasks.ts` imports the approved assessment types and produces:

```ts
export type TargetScope = Readonly<{
  siteIds: readonly string[];
  roles: readonly string[];
  documentReferences: readonly string[];
}>;
export type ApprovedImpactAction = Readonly<{
  actionKey: string;
  actionText: string;
  rationale: string;
  effectiveDate: string | null;
  targetScope: TargetScope;
}>;
export type ChangeTaskDraft = Readonly<{
  idempotencyKey: string;
  actionKey: string;
  actionText: string;
  effectiveDate: string | null;
  targetScope: TargetScope;
  targetScopeHash: string;
  lineageHash: string;
}>;
export type ChangeTaskIdentityInput = Readonly<{
  assessmentId: string;
  revisionId: string;
  actionKey: string;
  targetScopeHash: string;
}>;
export type ChangeTaskLineageInput = Readonly<{
  sourceVersionId: string;
  diffId: string;
  diffHash: string;
  assessmentId: string;
  revisionId: string;
  revisionHash: string;
  actionKey: string;
  targetScopeHash: string;
}>;
export type ApprovedAssessmentInput = Readonly<{
  sourceVersionId: string;
  diffId: string;
  diffHash: string;
  assessmentId: string;
  revisionId: string;
  revisionHash: string;
  outcome: ImpactOutcome;
  actions: readonly ApprovedImpactAction[];
}>;
export function computeTargetScopeHash(input: TargetScope): string;
export function validateTaskScopeEquality(action: ApprovedImpactAction, task: ChangeTaskDraft): void;
export function computeChangeTaskIdempotencyKey(input: ChangeTaskIdentityInput): string;
export function computeChangeTaskLineageHash(input: ChangeTaskLineageInput): string;
export function materializeChangeTaskDrafts(input: ApprovedAssessmentInput): readonly ChangeTaskDraft[];
```

Add these values to `AuthorizationAction`: `rule:read`, `impact_assessment:create`, `impact_assessment:read`, `impact_assessment:update`, `impact_assessment:submit`, `impact_assessment:approve`, `impact_assessment:reject`, and `change_task:read`.

- [ ] **Step 1: Write failing lifecycle and authorization tests**

Cover draft/revise/submit/approve/reject/stale matrices, immutable sequential revisions, trimmed 1–2,000-character decision reasons, exact revision/diff hash binding, recent-auth requirement, same-actor approval allowed for Quality Leads, repeated identical decisions, contradictory decisions, no-action zero tasks, exact scope copying, task idempotency, stale/withdrawn denial, a content-free `ImpactDraftUnavailableError`, Quality Lead permissions, Supervisor assigned-site read projection, and Worker/Participant default denial.

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm vitest run packages/domain/src/impact-assessment.test.ts packages/domain/src/change-tasks.test.ts packages/domain/src/authorization.test.ts`

Expected: FAIL because the Phase 03 contracts and actions are absent.

- [ ] **Step 3: Implement pure invariants and hashes**

Reuse Phase 02 canonicalization and branded IDs where available. Hash only allow-listed structured fields. Require `action_required` to contain at least one valid action, require `no_action_required` to contain none, and preserve AI provenance/metadata hashes without storing prompts or model output. Do not let the draft adapter authorize, submit, decide, or materialize tasks.

- [ ] **Step 4: Verify all domain tests and types**

Run: `pnpm vitest run packages/domain/src && pnpm --filter @attesta/domain typecheck`

Expected: PASS with Phase 02 authorization behavior unchanged.

- [ ] **Step 5: Commit the workflow domain**

Run: `git add -- packages/domain/src/impact-assessment.ts packages/domain/src/impact-assessment.test.ts packages/domain/src/change-tasks.ts packages/domain/src/change-tasks.test.ts packages/domain/src/authorization.ts packages/domain/src/authorization.test.ts packages/domain/src/index.ts packages/domain/src/index.test.ts && git commit -m "feat: add impact and change task invariants"`

### Task 4: Implement manual source capture and draft-only AI adapters

**Files:**
- Create: `packages/integrations/src/rule-source/manual-source-adapter.ts`
- Create: `packages/integrations/src/rule-source/manual-source-adapter.test.ts`
- Create: `packages/integrations/src/impact-draft/disabled-impact-draft-adapter.ts`
- Create: `packages/integrations/src/impact-draft/disabled-impact-draft-adapter.test.ts`
- Create: `packages/integrations/src/impact-draft/fake-impact-draft-adapter.ts`
- Create: `packages/integrations/src/impact-draft/fake-impact-draft-adapter.test.ts`
- Modify: `packages/integrations/src/index.ts`
- Modify: `packages/integrations/src/index.test.ts`

**Interfaces:**

```ts
export function createManualSourceAdapter(clock: () => Date): SourceCaptureAdapter;
export function createDisabledImpactDraftAdapter(): ImpactDraftAdapter;
export function createFakeImpactDraftAdapter(fixtures: ReadonlyMap<string, ImpactDraftResult>): ImpactDraftAdapter;
```

- [ ] **Step 1: Write failing adapter-contract tests**

Test bounded manual request parsing, explicit rejection of `captureMode: "automated_monitor"` by the manual adapter, rejection of body-supplied actor/tenant/capture timestamps, injected server clock, safe validation errors, deterministic fake lookups, the disabled adapter's typed content-free failure, malformed fake output rejection, and a logger spy proving source text/prompts/generated text/tokens are never emitted. The shared future-monitor contract remains covered by Task 1's domain test.

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm vitest run packages/integrations/src/rule-source packages/integrations/src/impact-draft`

Expected: FAIL because the adapters are missing.

- [ ] **Step 3: Implement the minimal adapters**

The manual adapter accepts only `captureMode: "manual_curated"`, validates the candidate, injects `capturedAt` from its server clock, and returns `NormalizedSourceSnapshot`; it cannot publish. The disabled adapter rejects with a typed, content-free `ImpactDraftUnavailableError`. The fake adapter is test-only, uses a redacted input fingerprint, returns only schema-valid `ai_assisted` output, and never becomes a production default. Task 9 owns the service-level fallback test. Do not add AI SDK or provider dependencies.

- [ ] **Step 4: Verify package tests and types**

Run: `pnpm vitest run packages/integrations/src && pnpm --filter @attesta/integrations typecheck`

Expected: PASS with no new network calls or provider packages.

- [ ] **Step 5: Commit the adapter boundary**

Run: `git add -- packages/integrations/src/rule-source/manual-source-adapter.ts packages/integrations/src/rule-source/manual-source-adapter.test.ts packages/integrations/src/impact-draft/disabled-impact-draft-adapter.ts packages/integrations/src/impact-draft/disabled-impact-draft-adapter.test.ts packages/integrations/src/impact-draft/fake-impact-draft-adapter.ts packages/integrations/src/impact-draft/fake-impact-draft-adapter.test.ts packages/integrations/src/index.ts packages/integrations/src/index.test.ts && git commit -m "feat: add manual capture and draft fallbacks"`

### Task 5: Add the tenantless catalog schema, migration, RLS, and retention bindings

**Files:**
- Create: `packages/db/src/schema/catalog.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/schema.test.ts`
- Create: `packages/db/migrations/0007_phase03_rule_catalog.sql`
- Create: `packages/db/migrations/meta/0007_snapshot.json`
- Modify: `packages/db/migrations/meta/_journal.json`
- Create: `packages/db/src/integration/catalog-schema.db.test.ts`
- Modify: `packages/db/src/integration/migrator.db.test.ts`
- Modify: `vitest.integration.config.ts`

**Interfaces:**

Create `attesta_private.rule_sources`, `rule_source_snapshots`, `rule_versions`, `rule_diffs`, `obligations`, `obligation_versions`, `platform_catalog_events`, and `platform_catalog_checkpoints`, plus the private backend/transaction-bound support table `catalog_operator_authorization_contexts`. Add `attesta_private.authz_catalog_read_allowed(allowed_roles text[])` and a dedicated `attesta_catalog_owner NOLOGIN NOBYPASSRLS` routine-owner role.

Migration `0007` also defines, revokes, and signature-grants these functions before any repository calls them:

```sql
attesta_private.establish_catalog_operator_context(
  workos_user_id text,
  workos_session_id text,
  operation text,
  issued_at timestamptz,
  authenticated_at timestamptz,
  reauthentication_event_reference text,
  correlation_id uuid,
  provider_evidence_signature text
) RETURNS uuid

attesta_private.catalog_capture_candidate(command jsonb) RETURNS jsonb
attesta_private.catalog_publish_version(command jsonb) RETURNS jsonb
attesta_private.catalog_reject_version(command jsonb) RETURNS jsonb
attesta_private.catalog_withdraw_version(command jsonb) RETURNS jsonb
attesta_private.catalog_get_version_for_operator(version_id uuid) RETURNS jsonb
attesta_private.catalog_list_published() RETURNS SETOF jsonb
attesta_private.catalog_get_published_version(version_id uuid) RETURNS jsonb
```

- [ ] **Step 1: Write failing schema and migration integration tests**

Assert exact columns and composite foreign keys; UUID/check/hash shapes; one current published version per source; unique `(source_id, content_hash)` snapshots; same-source predecessor; immutable snapshots/versions/diffs/obligations/events/checkpoints; unique platform-event idempotency keys with command fingerprints; platform-chain ordering; no sentinel tenant IDs; forced RLS; signature-qualified grants for all operator/read routines; rejection of routine calls without the matching backend/transaction-bound context; Quality Lead catalog reads through `catalog_list_published`/`catalog_get_published_version` inside a Phase 02 authorized transaction; other roles denied; no direct application-role table reads or writes; and retention-rule IDs `00000000-0000-4000-8000-000000000901` (`platform_catalog_event`) and `00000000-0000-4000-8000-000000000902` (`platform_catalog_checkpoint`) bound to immutable seven-year product-policy versions.

- [ ] **Step 2: Verify migration tests fail**

Run: `pnpm vitest run packages/db/src/schema.test.ts packages/db/src/integration/catalog-schema.db.test.ts`

Expected: FAIL because migration `0007` and catalog schema exports are absent.

- [ ] **Step 3: Implement migration `0007` and Drizzle schema**

Keep catalog records tenantless and in `attesta_private`. Enable and force RLS on catalog read tables. The read helper must rely on Phase 02's transaction-bound active user/membership/version checks and accept only Quality Leads. Add a backend/transaction-bound catalog-operator context and mutation policy that only `establish_catalog_operator_context` can establish; forced RLS must still apply to the `NOBYPASSRLS` routine owner. Own all seven catalog mutation/read routines with `attesta_catalog_owner`, set their `search_path`, and revoke `PUBLIC`. Grant `attesta_provisioner` EXECUTE only on the context, four mutation, and operator-version-read routines; grant `attesta_app` EXECUTE only on the two published read routines. Grant neither login role direct catalog table access. Store the idempotency key and canonical command fingerprint on the platform event so an identical replay returns the original result and a mismatched reuse fails. Make child record deletion restrictive. Seed retention evidence with the spec's `Retention and deletion` section and leave cleanup disabled.

- [ ] **Step 4: Verify migration, RLS, metadata, and types**

Run serially: `pnpm vitest run packages/db/src/integration/migrator.db.test.ts packages/db/src/integration/catalog-schema.db.test.ts`; then `pnpm --filter @attesta/db db:check`; then `pnpm --filter @attesta/db typecheck`.

Expected: PASS with migrations `0000`–`0007` applying from an empty PGlite database.

- [ ] **Step 5: Commit the catalog persistence boundary**

Run: `git add -- packages/db/src/schema.ts packages/db/src/schema.test.ts packages/db/src/schema/catalog.ts packages/db/src/integration/catalog-schema.db.test.ts packages/db/src/integration/migrator.db.test.ts packages/db/migrations/0007_phase03_rule_catalog.sql packages/db/migrations/meta/0007_snapshot.json packages/db/migrations/meta/_journal.json vitest.integration.config.ts && git commit -m "feat: add protected rule catalog schema"`

### Task 6: Add tenant assessment and change-task schema, RLS, and retention bindings

**Files:**
- Create: `packages/db/src/schema/impact.ts`
- Create: `packages/db/src/schema/change-tasks.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/schema.test.ts`
- Create: `packages/db/migrations/0008_phase03_change_workflow.sql`
- Create: `packages/db/migrations/meta/0008_snapshot.json`
- Modify: `packages/db/migrations/meta/_journal.json`
- Create: `packages/db/src/integration/change-workflow-schema.db.test.ts`
- Modify: `packages/db/src/integration/migrator.db.test.ts`
- Modify: `vitest.integration.config.ts`

**Interfaces:**

Create `impact_assessments`, `impact_assessment_revisions`, `impact_actions`, `impact_action_site_targets`, `impact_action_role_targets`, `impact_action_document_targets`, `change_tasks`, `change_task_site_targets`, `change_task_role_targets`, and `change_task_document_targets` with tenant-aware composite keys and restrictive deletes.

- [ ] **Step 1: Write failing schema, ACL, and RLS tests**

Test immutable sequential revisions; unique current assessment per tenant/version; exact current-revision foreign key; decision and optimistic-version constraints; action/target tenant consistency; approved assessment/revision/action lineage; unique task idempotency key; immutable copied task scopes; Quality Lead full workflow access; Supervisor task projection only when at least one assigned site target exists; site-target rows filtered to assigned sites; Worker/Participant denial; cross-tenant denial without existence disclosure; and `FORCE ROW LEVEL SECURITY` on every tenant table.

Also assert retention-rule IDs `00000000-0000-4000-8000-000000000903` (`impact_assessment`), `00000000-0000-4000-8000-000000000904` (`impact_assessment_revision`), and `00000000-0000-4000-8000-000000000905` (`change_task`) use the seven-year product-policy baseline. Child actions/targets inherit their immutable parent's lifecycle and cannot be independently purged.

- [ ] **Step 2: Verify migration tests fail**

Run: `pnpm vitest run packages/db/src/schema.test.ts packages/db/src/integration/change-workflow-schema.db.test.ts`

Expected: FAIL because migration `0008` and workflow schema exports are absent.

- [ ] **Step 3: Implement migration `0008` and Drizzle schema**

Use `attesta_private.authz_resource_allowed(tenant_id, NULL, ARRAY['quality_lead'])` for Quality Lead rows. Add the narrower Supervisor task-read policy using an `EXISTS` check over RLS-filtered site targets and Phase 02 site assignments; do not create a second tenant-context mechanism. Grant `attesta_app` only the `SELECT`/`INSERT`/narrow `UPDATE` privileges required under forced RLS, grant no tenant-table `DELETE`, and keep application mutations behind repositories that require `AuthorizedTransaction`.

- [ ] **Step 4: Verify migrations, ACLs, and types**

Run serially: `pnpm vitest run packages/db/src/integration/migrator.db.test.ts packages/db/src/integration/change-workflow-schema.db.test.ts packages/db/src/integration/rls.db.test.ts`; then `pnpm --filter @attesta/db db:check`; then `pnpm --filter @attesta/db typecheck`.

Expected: PASS with migrations `0000`–`0008` applying cleanly and Phase 02 RLS tests unchanged.

- [ ] **Step 5: Commit the tenant workflow schema**

Run: `git add -- packages/db/src/schema.ts packages/db/src/schema.test.ts packages/db/src/schema/impact.ts packages/db/src/schema/change-tasks.ts packages/db/src/integration/change-workflow-schema.db.test.ts packages/db/src/integration/migrator.db.test.ts packages/db/migrations/0008_phase03_change_workflow.sql packages/db/migrations/meta/0008_snapshot.json packages/db/migrations/meta/_journal.json vitest.integration.config.ts && git commit -m "feat: add tenant rule change workflow schema"`

### Task 7: Implement the isolated catalog client, repository, service, and platform audit parity

**Files:**
- Create: `packages/db/src/catalog-provisioner-client.ts`
- Create: `packages/db/src/catalog-provisioner-client.test.ts`
- Create: `packages/db/src/catalog-operator-context.ts`
- Create: `packages/db/src/catalog-operator-context.test.ts`
- Create: `packages/db/src/repositories/catalog-repository.ts`
- Create: `packages/db/src/repositories/catalog-repository.test.ts`
- Create: `packages/db/src/services/catalog-service.ts`
- Create: `packages/db/src/services/catalog-service.test.ts`
- Create: `packages/db/src/integration/catalog-publication.db.test.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/package.json`
- Modify: `vitest.integration.config.ts`

**Interfaces:**

```ts
declare const catalogProvisionerDbBrand: unique symbol;
export type CatalogProvisionerDb = AppDb & { readonly [catalogProvisionerDbBrand]: true };
export function createCatalogProvisionerDb(databaseProvisionerUrl: string): CatalogProvisionerDb;

type CatalogDatabaseTransaction = Parameters<Parameters<AppDb["transaction"]>[0]>[0];
export type AuthorizedCatalogOperatorTransaction = CatalogDatabaseTransaction & {
  readonly __authorizedCatalogOperatorTransaction: unique symbol;
};
export type CatalogOperatorOperation = "catalog:capture" | "catalog:publish" | "catalog:reject" | "catalog:withdraw";
export function withAuthorizedCatalogOperatorRequest<T>(
  db: CatalogProvisionerDb,
  identity: PrivilegedWorkOSIdentity,
  operation: CatalogOperatorOperation,
  callback: (tx: AuthorizedCatalogOperatorTransaction) => Promise<T>,
): Promise<T>;

export type CatalogCaptureCommand = Readonly<{
  idempotencyKey: string;
  normalizedSnapshot: NormalizedSourceSnapshot;
  obligations: readonly ObligationCandidate[];
}>;
export type CatalogCaptureResult = Readonly<{
  sourceId: string;
  snapshotId: string;
  versionId: string;
  contentHash: string;
  state: "candidate";
  idempotentReplay: boolean;
}>;
export type CatalogDecisionCommand = Readonly<{
  idempotencyKey: string;
  versionId: string;
  reason: string;
}>;
export type CatalogDecisionPersistenceCommand = CatalogDecisionCommand & Readonly<{
  operation: "publish" | "reject" | "withdraw";
  expectedCurrentVersionId: string | null;
  diff: RuleDiff | null;
}>;
export type CatalogDecisionResult = Readonly<{
  versionId: string;
  state: "published" | "rejected" | "withdrawn";
  diffId: string | null;
  diffHash: string | null;
  platformCatalogEventId: string;
  idempotentReplay: boolean;
}>;
export type CatalogOperatorVersion = Readonly<{
  sourceId: string;
  versionId: string;
  state: RuleVersionState;
  predecessorVersionId: string | null;
  currentPublishedVersionId: string | null;
  contentHash: string;
  canonicalContent: string;
}>;
export type PublishedRuleSummary = Readonly<{
  sourceId: string;
  sourceKey: string;
  module: RuleModule;
  title: string;
  currentVersionId: string;
  publicationDate: string | null;
  effectiveDate: string | null;
}>;
export type PublishedRuleVersion = Readonly<{
  summary: PublishedRuleSummary;
  snapshotId: string;
  contentHash: string;
  submittedContent: string;
  canonicalContent: string;
  predecessorVersionId: string | null;
  diff: RuleDiff | null;
  obligations: readonly ObligationCandidate[];
}>;

export interface CatalogRepository {
  captureCandidate(tx: AuthorizedCatalogOperatorTransaction, input: CatalogCaptureCommand): Promise<CatalogCaptureResult>;
  getVersionForDecision(tx: AuthorizedCatalogOperatorTransaction, versionId: string): Promise<CatalogOperatorVersion>;
  decideVersion(tx: AuthorizedCatalogOperatorTransaction, input: CatalogDecisionPersistenceCommand): Promise<CatalogDecisionResult>;
  listPublished(input: AuthorizedTransaction): Promise<readonly PublishedRuleSummary[]>;
  getPublishedVersion(input: AuthorizedTransaction, versionId: string): Promise<PublishedRuleVersion | null>;
}
export class CatalogService {
  capture(identity: PrivilegedWorkOSIdentity, input: CatalogCaptureCommand): Promise<CatalogCaptureResult>;
  publish(identity: PrivilegedWorkOSIdentity, input: CatalogDecisionCommand): Promise<CatalogDecisionResult>;
  reject(identity: PrivilegedWorkOSIdentity, input: CatalogDecisionCommand): Promise<CatalogDecisionResult>;
  withdraw(identity: PrivilegedWorkOSIdentity, input: CatalogDecisionCommand): Promise<CatalogDecisionResult>;
}
```

- [ ] **Step 1: Write failing repository, service, and database tests**

Cover rejection of an unbranded/plain identity or transaction; duplicate capture returning the existing version/event, baseline publication without diff, later publication with the exact persisted `paragraph-token-v1` diff, same-transaction platform event append, chain verification and checkpoint boundaries, publish/reject/withdraw reasons, operator allow-list, MFA/recent-auth/correlation evidence, idempotency, concurrent publication, diff failure rollback, event failure rollback, generic errors, and no raw content in audit payloads or logs.

- [ ] **Step 2: Verify the focused tests fail**

Run: `pnpm vitest run packages/db/src/repositories/catalog-repository.test.ts packages/db/src/services/catalog-service.test.ts packages/db/src/integration/catalog-publication.db.test.ts`

Expected: FAIL because repository/service modules are missing.

- [ ] **Step 3: Implement the platform-only mutation path**

Make `createCatalogProvisionerDb` the only constructor of `CatalogProvisionerDb`; it accepts only the dedicated `DATABASE_PROVISIONER_URL`, never `DATABASE_URL`. Implement `withAuthorizedCatalogOperatorRequest` as the only constructor of the branded catalog transaction. It accepts the Phase 02 `PrivilegedWorkOSIdentity`, opens the provisioner transaction, and calls the already-migrated `establish_catalog_operator_context`, which checks `platform_operator_principals`, permitted operation, MFA, authentication age, one-use reauthentication reference, correlation ID, and provider-evidence signature. For publication, lock/read candidate and current source versions through `catalog_get_version_for_operator`, calculate the domain diff inside that same transaction, then call the matching signature-qualified mutation routine with the canonical structured diff/hash. Customer reads call only `catalog_list_published` and `catalog_get_published_version` inside the request-scoped authorized tenant transaction. The repository never queries private catalog tables directly.

- [ ] **Step 4: Verify catalog behavior and exports**

Run: `pnpm vitest run packages/db/src/repositories/catalog-repository.test.ts packages/db/src/services/catalog-service.test.ts packages/db/src/integration/catalog-publication.db.test.ts packages/domain/src/rule-diff.test.ts && pnpm --filter @attesta/db typecheck`

Expected: PASS, including rollback and concurrency cases.

- [ ] **Step 5: Commit the catalog service**

Run: `git add -- packages/db/src/catalog-provisioner-client.ts packages/db/src/catalog-provisioner-client.test.ts packages/db/src/catalog-operator-context.ts packages/db/src/catalog-operator-context.test.ts packages/db/src/repositories/catalog-repository.ts packages/db/src/repositories/catalog-repository.test.ts packages/db/src/services/catalog-service.ts packages/db/src/services/catalog-service.test.ts packages/db/src/integration/catalog-publication.db.test.ts packages/db/src/index.ts packages/db/package.json vitest.integration.config.ts && git commit -m "feat: implement atomic catalog publication"`

### Task 8: Add the authenticated platform catalog command endpoint

**Files:**
- Create: `apps/web/lib/rules/route-schemas.ts`
- Create: `apps/web/lib/rules/route-schemas.test.ts`
- Create: `apps/web/lib/rules/route-errors.ts`
- Create: `apps/web/lib/rules/route-errors.test.ts`
- Create: `apps/web/app/api/platform/rule-catalog/route.ts`
- Create: `apps/web/app/api/platform/rule-catalog/route.test.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/lib/env.ts`
- Modify: `apps/web/lib/env.test.ts`

**Interfaces:**

`POST /api/platform/rule-catalog` accepts `{ operation, idempotencyKey, candidate?, obligations?, versionId?, reason? }`, where `operation` is `capture | publish | reject | withdraw`. It returns a no-store JSON envelope containing only resource IDs, hashes, lifecycle state, and idempotent-replay status.

- [ ] **Step 1: Read the local Next.js route-handler documentation**

From `apps/web`, inspect the relevant files under `node_modules/next/dist/docs/` for Route Handlers, request body limits, cookies/session access, and no-store behavior. Record any implementation-affecting discovery in the task commit body.

- [ ] **Step 2: Write failing request and security tests**

Cover signed-out denial, non-platform denial, stale recent-auth denial/reauth response, valid WorkOS platform operator, body-supplied actor/tenant rejection, bounded content and metadata, operation-specific schemas, malformed JSON, idempotency, safe generic errors, `Cache-Control: no-store`, no customer-navigation link, and logger/response spies proving source content and database detail are absent.

- [ ] **Step 3: Verify the route tests fail**

Run: `pnpm vitest run apps/web/lib/rules apps/web/app/api/platform/rule-catalog/route.test.ts`

Expected: FAIL because route schemas and handler are absent.

- [ ] **Step 4: Implement the protected endpoint**

Use the final Phase 02 AuthKit request guard and recent-auth helper to produce `PrivilegedWorkOSIdentity`. Derive operator subject, MFA evidence, correlation ID, and time from the verified server session/request. Reject all client authority fields. Dispatch the validated command to `CatalogService`, which establishes the branded catalog-operator transaction; do not add a local CLI or expose the route in app navigation. Add `@attesta/integrations` as a web workspace dependency so the route can compose the manual adapter without moving adapter code into the web or database packages.

- [ ] **Step 5: Verify and commit the endpoint**

Run: `pnpm vitest run apps/web/lib/rules apps/web/app/api/platform/rule-catalog/route.test.ts && pnpm --filter @attesta/web typecheck`

Expected: PASS.

Run: `git add apps/web/lib/rules apps/web/app/api/platform/rule-catalog apps/web/package.json apps/web/lib/env.ts apps/web/lib/env.test.ts pnpm-lock.yaml && git commit -m "feat: add protected catalog command endpoint"`

### Task 9: Implement tenant impact repositories and atomic decision service

**Files:**
- Create: `packages/db/src/repositories/impact-assessment-repository.ts`
- Create: `packages/db/src/repositories/impact-assessment-repository.test.ts`
- Create: `packages/db/src/repositories/change-task-repository.ts`
- Create: `packages/db/src/repositories/change-task-repository.test.ts`
- Create: `packages/db/src/services/impact-assessment-service.ts`
- Create: `packages/db/src/services/impact-assessment-service.test.ts`
- Create: `packages/db/src/integration/impact-decision.db.test.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/package.json`
- Modify: `vitest.integration.config.ts`

**Interfaces:**

```ts
export class ImpactAssessmentService {
  start(tx: AuthorizedTransaction, input: StartAssessmentInput): Promise<AssessmentView>;
  revise(tx: AuthorizedTransaction, input: ReviseAssessmentInput): Promise<AssessmentView>;
  submit(tx: AuthorizedTransaction, input: SubmitAssessmentInput): Promise<AssessmentView>;
  decide(tx: AuthorizedTransaction, identity: PrivilegedWorkOSIdentity, input: DecideAssessmentInput): Promise<AssessmentDecisionReceipt>;
  listTasks(tx: AuthorizedTransaction, input: ListTasksInput): Promise<readonly ChangeTaskView[]>;
}
```

- [ ] **Step 1: Write failing unit and integration tests**

Cover on-demand tenant assessment creation without publication fan-out; typed disabled/failed-AI handling that creates an empty `human_authored` draft while malformed AI output fails safely; immutable revisions/actions/targets; optimistic concurrency; submit binding; lazy stale transition plus audit; direct current-catalog validation before decision; recent-auth evidence; self-approval; exact task preview/materialization; atomic tenant audit V2; no-action zero tasks; rejection zero tasks; repeated identical decision receipt; contradictory decision denial; task/audit failure rollback; concurrent decisions; Supervisor assigned-site projection; and generic cross-tenant denial.

- [ ] **Step 2: Verify the service tests fail**

Run: `pnpm vitest run packages/db/src/repositories/impact-assessment-repository.test.ts packages/db/src/repositories/change-task-repository.test.ts packages/db/src/services/impact-assessment-service.test.ts packages/db/src/integration/impact-decision.db.test.ts`

Expected: FAIL because the tenant workflow persistence modules are missing.

- [ ] **Step 3: Implement through Phase 02 authorized transactions**

Accept `AuthorizedTransaction`, not raw database clients or caller-selected tenant IDs. Inject `ImpactDraftAdapter` through the service constructor so the database package does not depend on integrations. Run domain authorization for each action, derive tenant/actor/membership from the transaction, and require the Phase 02-branded `PrivilegedWorkOSIdentity` for `decide`; derive authentication time and one-use reauthentication evidence from that identity, never from `DecideAssessmentInput`. Append canonical tenant audit V2 envelopes with allow-listed IDs/hashes/reason/task count, and make decision plus exact task set plus audit one transaction. The change-task repository must have no public create method outside the decision path.

- [ ] **Step 4: Verify atomicity, isolation, and types**

Run: `pnpm vitest run packages/db/src/repositories/impact-assessment-repository.test.ts packages/db/src/repositories/change-task-repository.test.ts packages/db/src/services/impact-assessment-service.test.ts packages/db/src/integration/impact-decision.db.test.ts packages/db/src/integration/rls.db.test.ts && pnpm --filter @attesta/db typecheck`

Expected: PASS with exact zero/one-task-set guarantees and no Phase 02 regressions.

- [ ] **Step 5: Commit the tenant decision service**

Run: `git add -- packages/db/src/repositories/impact-assessment-repository.ts packages/db/src/repositories/impact-assessment-repository.test.ts packages/db/src/repositories/change-task-repository.ts packages/db/src/repositories/change-task-repository.test.ts packages/db/src/services/impact-assessment-service.ts packages/db/src/services/impact-assessment-service.test.ts packages/db/src/integration/impact-decision.db.test.ts packages/db/src/index.ts packages/db/package.json vitest.integration.config.ts && git commit -m "feat: implement atomic impact decisions"`

### Task 10: Expose protected customer rule, assessment, decision, and task APIs

**Files:**
- Create: `apps/web/app/api/rules/route.ts`
- Create: `apps/web/app/api/rules/route.test.ts`
- Create: `apps/web/app/api/rules/[sourceVersionId]/route.ts`
- Create: `apps/web/app/api/rules/[sourceVersionId]/route.test.ts`
- Create: `apps/web/app/api/impact-assessments/route.ts`
- Create: `apps/web/app/api/impact-assessments/route.test.ts`
- Create: `apps/web/app/api/impact-assessments/[assessmentId]/route.ts`
- Create: `apps/web/app/api/impact-assessments/[assessmentId]/route.test.ts`
- Create: `apps/web/app/api/impact-assessments/[assessmentId]/submit/route.ts`
- Create: `apps/web/app/api/impact-assessments/[assessmentId]/submit/route.test.ts`
- Create: `apps/web/app/api/impact-assessments/[assessmentId]/decision/route.ts`
- Create: `apps/web/app/api/impact-assessments/[assessmentId]/decision/route.test.ts`
- Create: `apps/web/app/api/change-tasks/route.ts`
- Create: `apps/web/app/api/change-tasks/route.test.ts`
- Modify: `apps/web/lib/rules/route-schemas.ts`
- Modify: `apps/web/lib/rules/route-schemas.test.ts`

**Interfaces:**

- `GET /api/rules` lists Quality Lead-readable published sources and tenant assessment status.
- `GET /api/rules/[sourceVersionId]` returns metadata, baseline/diff, and allowed action state.
- `POST /api/impact-assessments` starts an on-demand assessment.
- `GET|PATCH /api/impact-assessments/[assessmentId]` reads or appends a revision.
- `POST .../submit` submits an exact revision/hash.
- `POST .../decision` approves or rejects an exact revision/diff with reason and recent auth.
- `GET /api/change-tasks` returns Quality Lead tasks or the Supervisor's assigned-site projection.

- [ ] **Step 1: Confirm local Next.js dynamic-route and server-handler guidance**

Read the relevant Next.js 16.3.3 local docs before implementing async route params, request parsing, caching, and error responses.

- [ ] **Step 2: Write failing route-contract and authorization tests**

Cover Quality Lead success, Supervisor task-only projection, Worker/Participant denial, server-derived tenant/actor, malformed IDs/body, retained edit input, optimistic conflict, stale approval, withdrawn version, recent-auth redirect/response, duplicate request replay, contradictory decision, no-action receipt, generic not-found/forbidden parity, and no-store headers.

- [ ] **Step 3: Verify route tests fail**

Run: `pnpm vitest run apps/web/app/api/rules apps/web/app/api/impact-assessments apps/web/app/api/change-tasks`

Expected: FAIL because the Phase 03 routes do not exist.

- [ ] **Step 4: Implement thin handlers**

Use `requireAuthorizedRequest(operation)` for every route and `requireRecentAuthentication` for decisions. Parse with shared Zod schemas, pass the resulting `AuthorizedTransaction` to the service, map failures through shared generic route errors, and return only allow-listed view models. Keep business state transitions in the domain/service layers.

- [ ] **Step 5: Verify and commit customer APIs**

Run: `pnpm vitest run apps/web/app/api/rules apps/web/app/api/impact-assessments apps/web/app/api/change-tasks apps/web/lib/rules && pnpm --filter @attesta/web typecheck`

Expected: PASS.

Run: `git add apps/web/app/api/rules apps/web/app/api/impact-assessments apps/web/app/api/change-tasks apps/web/lib/rules && git commit -m "feat: add protected rule workflow APIs"`

### Task 11: Build accessible Quality Lead rule review, impact decision, and task screens

**Files:**
- Create: `apps/web/app/(protected)/app/rules/page.tsx`
- Create: `apps/web/app/(protected)/app/rules/[sourceVersionId]/page.tsx`
- Create: `apps/web/app/(protected)/app/rules/[sourceVersionId]/impact/page.tsx`
- Create: `apps/web/app/(protected)/app/impact-assessments/[assessmentId]/page.tsx`
- Create: `apps/web/app/(protected)/app/change-tasks/page.tsx`
- Create: `apps/web/components/rules/rule-library.tsx`
- Create: `apps/web/components/rules/rule-version-review.tsx`
- Create: `apps/web/components/rules/rule-diff.tsx`
- Create: `apps/web/components/rules/impact-editor.tsx`
- Create: `apps/web/components/rules/decision-panel.tsx`
- Create: `apps/web/components/rules/change-task-list.tsx`
- Create: `apps/web/components/rules/confirmation-dialog.tsx`
- Create: `apps/web/components/rules/error-summary.tsx`
- Create: `apps/web/components/rules/status-announcer.tsx`
- Create: `apps/web/components/rules/rules-ui.test.tsx`
- Create: `apps/web/test/setup.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `vitest.config.ts`
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/app/globals.css`

**Interfaces:**

The rule library, version review, editor, decision, persistent receipt, and task list render from allow-listed server view models. The linear diff is the semantic baseline; wide layouts add a side-by-side visual representation without changing reading order.

- [ ] **Step 1: Read local Next.js page, Server/Client Component, forms, and accessibility-relevant guidance**

Use the exact installed docs and keep client components limited to interactive form/dialog behavior.

- [ ] **Step 2: Write failing component tests**

Cover ordered headings/landmarks, skip link, baseline label, explicit Added/Removed text, linear DOM order, desktop paired presentation, AI-assistance label, empty human fallback, native labels/descriptions, validation summary focus, exact task preview, required reason, Escape/contained/restored dialog focus, status live region, persistent receipt fields, no-action zero-task receipt, and safe product copy.

- [ ] **Step 3: Verify UI tests fail**

Run: `pnpm vitest run apps/web/components/rules/rules-ui.test.tsx`

Expected: FAIL because Phase 03 components are absent.

- [ ] **Step 4: Implement pages and accessible components**

Add the jsdom Testing Library setup required for focus and keyboard assertions. Render protected server pages from the Phase 03 APIs/services. Preserve entered values on recoverable validation errors. Use native controls and semantic HTML; do not encode meaning by color alone. Support narrow single-column reflow, 200% zoom, visible focus, high contrast, and reduced motion in CSS. Hide customer routes from roles that lack the matching Phase 02 authorization action without treating UI hiding as enforcement.

- [ ] **Step 5: Verify and commit the UI**

Run: `pnpm vitest run apps/web/components/rules/rules-ui.test.tsx && pnpm --filter @attesta/web lint && pnpm --filter @attesta/web typecheck`

Expected: PASS after the workspace dependency layout is healthy.

Run: `git add -- 'apps/web/app/(protected)/app/rules' 'apps/web/app/(protected)/app/impact-assessments' 'apps/web/app/(protected)/app/change-tasks/page.tsx' apps/web/components/rules apps/web/test/setup.ts apps/web/package.json apps/web/app/layout.tsx apps/web/app/globals.css pnpm-lock.yaml vitest.config.ts && git commit -m "feat: add accessible rule change workflow"`

### Task 12: Prove end-to-end behavior and update Phase 03 release evidence

**Files:**
- Create: `packages/db/src/native/neon-rule-workflow.test.ts`
- Modify: `vitest.neon.config.ts`
- Create: `tests/e2e/rule-workflow.spec.ts`
- Create: `tests/e2e/live-rule-workflow.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `playwright.live.config.ts`
- Create: `scripts/verify-phase-03.mjs`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `docs/development.md`
- Create: `docs/release/phase-03-evidence-template.md`
- Modify: `.planning/STATE.md`
- Modify: `.planning/ROADMAP.md`
- Modify: `.planning/REQUIREMENTS.md`

**Interfaces:**

Add `pnpm verify:phase03` as a serial verification entry point. It must not require production credentials for local checks and must clearly separate local PGlite/Playwright evidence from credential-gated native Neon, WorkOS, and Vercel preview evidence.

- [ ] **Step 1: Write failing browser and native-database acceptance tests**

Cover manual baseline capture and later publication, deterministic diff persistence, on-demand assessment, human fallback, revision, submit, approve, reject, no-action, exact task creation, receipt reload, retry/concurrency, cross-tenant isolation, Supervisor assigned-site task projection, Worker/Participant denial, keyboard-only flow, narrow viewport, explicit diff labels, error-summary focus, dialog focus restoration, and absence of raw content/model data in captured logs.

- [ ] **Step 2: Verify the new acceptance tests fail before fixtures/harness are complete**

Run: `pnpm playwright test tests/e2e/rule-workflow.spec.ts`

Expected: FAIL because the Phase 03 browser harness and deterministic fixtures are not yet wired.

- [ ] **Step 3: Implement deterministic harnesses and the verification script**

Use invented short source text and synthetic identities only. Reuse the Phase 02 authenticated test-session mechanism; do not add a runtime auth bypass. Make native Neon and live WorkOS/Vercel suites opt-in through documented environment checks. The verification script must hydrate dependencies serially on Windows before invoking parallel-safe checks.
It must fail fast unless `node --version` is exactly `v22.14.0`.

- [ ] **Step 4: Run the complete local quality gate**

Run serially from a clean dependency layout:

```powershell
node --version
corepack pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm build
pnpm --filter @attesta/db db:check
git diff --check
```

Expected: `node --version` prints `v22.14.0` and all commands PASS. If dependency hydration fails with a Windows `ERR_PNPM_EPERM` or a missing Next link, repair the dependency layout and rerun; do not report source validation from a broken install.

- [ ] **Step 5: Run credential-gated evidence without weakening failures**

With approved non-production credentials, run native Neon multi-session publication/decision contention, real WorkOS session/recent-auth, and Vercel preview security/log review. Record each as `validated`, `partial`, or `blocked`; never convert a missing credential or external-service failure into a passing assertion.

- [ ] **Step 6: Update release and planning records**

Document exact commits, command outputs, environment scope, residual production gates, retention/legal status, AI-disabled status, and the fact that monitoring/PDF/DOCX remain deferred. Mark RULE-01 through RULE-05 complete only where the evidence supports them.

- [ ] **Step 7: Commit verification and evidence scaffolding**

Run: `git add -- vitest.neon.config.ts packages/db/src/native/neon-rule-workflow.test.ts tests/e2e/rule-workflow.spec.ts tests/e2e/live-rule-workflow.spec.ts playwright.config.ts playwright.live.config.ts scripts/verify-phase-03.mjs package.json .env.example docs/development.md docs/release/phase-03-evidence-template.md .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md && git commit -m "test: verify Phase 03 rule workflow"`

## Requirement Traceability

- **RULE-01:** Tasks 1, 5, and 7 implement stable global sources, immutable snapshots/versions, module support, obligations, publication lifecycle, and tenantless catalog audit lineage.
- **RULE-02:** Tasks 2, 4, 7, 8, and 11 implement manual curated capture through the future-compatible adapter boundary plus deterministic, hash-addressed, human-readable diffs.
- **RULE-03:** Tasks 3, 4, 9, and 11 implement the draft-only `ImpactDraftAdapter`, deterministic test fake, disabled runtime adapter, empty human fallback, immutable provenance, and Quality Lead review.
- **RULE-04:** Tasks 3, 6, and 9 make the approved exact revision the only input to the sole production change-task writer; rejection, baseline, staleness, and no-action paths cannot create tasks.
- **RULE-05:** Tasks 3, 7, 9, 10, 11, and 12 bind reasons and exact source/diff/revision/task hashes into atomic platform or tenant audit events and persistent decision receipts.

## Final Review Gate

- [ ] Confirm every acceptance criterion and RULE-01 through RULE-05 has at least one domain, database, route, or browser test.
- [ ] Confirm no Phase 03 path writes through an unauthorised raw database client or accepts tenant/actor authority from the request body.
- [ ] Confirm only `CatalogService` can invoke platform catalog mutation routines and only `ImpactAssessmentService.decide` can create change tasks.
- [ ] Confirm baseline publication creates no diff/assessment/task and catalog publication never fans out tenant mutations.
- [ ] Confirm rejection and approved `no_action_required` decisions persist their audit receipt and create zero tasks.
- [ ] Confirm all hashes bind canonical structured data and no audit/log envelope contains raw source text, prompts, generated output, tokens, PII, or database detail.
- [ ] Confirm the runtime AI adapter remains disabled and no automated monitoring, parser, crawler, worker briefing, policy edit, participant workflow, or notification delivery was added.
- [ ] Confirm retention-rule evidence is explicitly product policy, cleanup remains disabled, and no statutory claim was introduced.
- [ ] Request code review with `superpowers:requesting-code-review`, address feedback with `superpowers:receiving-code-review`, rerun `superpowers:verification-before-completion`, then use `superpowers:finishing-a-development-branch`.
