# Attesta Rule Library and Change Tasks Design

**Date:** 2026-08-31
**Status:** Design approved in chat; written-spec review pending
**Phase:** 03 — Rule Library & Change Tasks
**Requirements:** RULE-01, RULE-02, RULE-03, RULE-04, RULE-05
**Depends on:** Phase 02 — Auth & Tenant Security

## Goal

Provide one centrally curated, versioned library of NDIS regulatory source material and a tenant-specific, human-approved workflow that turns a verified source change into explicitly scoped administrative change tasks. The authoritative source text and deterministic diff remain visible throughout. AI may draft an impact assessment, but it cannot publish a source, make a decision, or create downstream work.

## Product boundary

Attesta records sources, differences, human assessments, decisions, and task lineage. It does not decide whether a provider is compliant, determine that a breach occurred, replace legal or clinical judgement, or submit anything to the NDIS Commission.

Phase 03 creates administrative change tasks only. Worker briefings, policy edits, participant communications, notifications, evidence exports, and Commission submissions are outside this phase.

## Approved decisions

- Regulatory sources form one global catalog curated by Attesta platform operators. Provider tenants do not copy, fork, or edit the catalog.
- Source capture is manual first. A protected operator command accepts plain text or Markdown plus a metadata manifest.
- No PDF/DOCX parsing, binary artifact storage, source crawling, or automated monitoring ships in Phase 03.
- A future monitoring adapter must submit candidates through the same normalization boundary as the manual adapter and cannot publish them.
- The first published snapshot establishes a baseline. It does not create a diff, impact assessment, or change task.
- Later versions use a deterministic, versioned diff algorithm. The verbatim source text and structured diff are authoritative.
- Each provider tenant may start its own impact assessment for a published change; catalog publication never fans out tenant mutations automatically.
- RULE-03 is implemented through a draft-only `ImpactDraftAdapter`. Tests use a deterministic fake; the production Vercel AI Gateway adapter remains disabled until its provider, retention, budget, and Australian-processing gates pass.
- A Quality Lead may prepare and approve the same assessment in the MVP. Recent authentication, a required decision reason, exact revision binding, and complete actor provenance remain mandatory. A later tenant policy may require a second approver.
- Approval creates only the reviewed administrative tasks. Rejection creates no downstream artifacts.
- A reviewed “no operational action required” assessment may be approved with a reason and creates zero tasks.

## Scope

### Included

- Global Core Module, SIL supplementary module, and SIL Quality Indicator source/module support.
- Manual capture of immutable text/Markdown snapshots and provenance.
- Stable source and obligation identities with immutable versions.
- Deterministic, human-readable diffs between published versions.
- Tenant-scoped impact assessments with immutable revisions and explicit targets.
- Draft-only AI assistance with human fallback.
- Quality Lead submission, approval, and rejection.
- Tenant-scoped administrative change tasks with complete source-to-decision lineage.
- Platform and tenant audit-chain events written atomically with their domain mutations.
- Authenticated, keyboard-accessible Quality Lead web screens.

### Deferred

- Automated polling, crawling, monitoring schedules, and parser operations.
- PDF, DOCX, HTML, scanned-document, image, or audio ingestion.
- Customer-created regulatory sources, tenant catalog forks, and tenant overrides.
- Worker briefings, policy-document mutation, participant workflows, and notification delivery.
- Production AI enablement before the approved vendor and privacy gates pass.
- Public catalog browsing or public regulatory-copy publication.
- Unverified regulatory text in source control, previews, or automated test fixtures.

## Architecture

The system has two trust and data domains:

1. **Global regulatory catalog** — platform-operated, non-tenant source evidence, versions, obligation versions, and diffs.
2. **Tenant change workflow** — provider-owned assessments, revisions, decisions, target scopes, and change tasks.

The domains meet only through immutable catalog identifiers and hashes. A tenant cannot modify catalog records. A catalog publication cannot create tenant work without a Quality Lead decision.

```text
Operator capture
    -> normalized immutable snapshot
    -> candidate version
    -> platform publication + baseline or deterministic diff + platform audit
    -> Quality Lead starts a tenant impact draft for a published diff
    -> Quality Lead review of exact diff and assessment revision
    -> approval + scoped tasks + tenant audit
       OR rejection + tenant audit + zero tasks
```

## Components

### Source capture boundary

`SourceCaptureAdapter` converts a source-specific candidate into the normalized input consumed by the deterministic catalog core.

```ts
type SourceCaptureMode = "manual_curated" | "automated_monitor";

type SourceSnapshotCandidate = Readonly<{
  sourceKey: string;
  module: "core" | "sil_supplementary" | "sil_quality_indicators";
  title: string;
  publisher: string;
  jurisdiction: string;
  canonicalUrl: string;
  publicationDate: string | null;
  effectiveDate: string | null;
  publisherVersionLabel: string | null;
  captureMode: SourceCaptureMode;
  content: string;
  curatorNote: string;
}>;

type NormalizedSourceSnapshot = Readonly<{
  candidate: Omit<SourceSnapshotCandidate, "content">;
  submittedContent: string;
  canonicalContent: string;
  contentHash: string;
  capturedAt: string;
}>;

type SourceCaptureAdapter = Readonly<{
  capture(candidate: SourceSnapshotCandidate): Promise<NormalizedSourceSnapshot>;
}>;
```

Phase 03 implements `ManualCuratedSourceAdapter` only. It validates ISO-8601 date metadata, generates `capturedAt` on the server, normalizes line endings to LF, applies Unicode NFC, preserves all other source whitespace, calculates the SHA-256 hash over canonical UTF-8 content, and returns the normalized snapshot. It does not fetch the canonical URL. The submitted content is the preserved evidence; canonical content is the reproducible comparison form.

A future monitor may retrieve a source and construct the same candidate shape, but `capture` never publishes, approves, or creates tasks.

### Catalog service

`RuleCatalogService` owns source identity, deduplication, candidate creation, obligation mapping, publication, rejection, withdrawal, supersession, diff generation, and platform audit append.

The service uses stable source keys that identify an authority, instrument/module, and official source location. URLs remain provenance fields and are not the sole identity because official URLs can change.

### Diff service

`RuleDiffService` compares canonical text for two versions of the same source. It produces:

- an immutable algorithm/version identifier;
- exact from/to version IDs and content hashes;
- structured equal/added/removed hunks;
- paragraph-level grouping with token-level highlighting inside changed paragraphs;
- a linear reading order suitable for mobile and assistive technology;
- a SHA-256 hash over the canonical structured diff.

The algorithm result must be reproducible. A parsing or diff error keeps the candidate unpublished.

### Impact draft boundary

`ImpactDraftAdapter` creates editable suggestions from an exact catalog version and diff.

```ts
type ImpactDraftInput = Readonly<{
  sourceVersionId: string;
  diffId: string;
  diffHash: string;
  structuredDiff: readonly RuleDiffHunk[];
  allowedRoles: readonly string[];
  allowedDocumentTypes: readonly string[];
}>;

type ImpactDraftResult = Readonly<{
  provenance: "ai_assisted";
  suggestedOutcome: "action_required" | "no_action_required";
  suggestedActions: readonly ImpactActionSuggestion[];
  model: string;
  provider: string;
  modelVersion: string;
  promptHash: string;
  outputHash: string;
}>;

type ImpactDraftAdapter = Readonly<{
  draft(input: ImpactDraftInput): Promise<ImpactDraftResult>;
}>;
```

`RuleDiffHunk` and `ImpactActionSuggestion` are domain types defined by the diff and assessment modules; adapters cannot introduce alternate shapes. The deterministic test adapter returns a fixed, schema-valid response. The production implementation may use only Vercel AI Gateway, an explicit model/provider allow-list, bounded budgets, redacted structured context, and approved data handling. It receives no tenant site records, participant records, worker records, or customer document content. The Quality Lead assigns actual tenant sites after drafting.

The domain stores the original AI-assisted revision and every human-edited revision separately. The tenant audit payload stores model/provider/version plus prompt and output hashes, not raw prompts or generated text. If the adapter is disabled or fails, the Quality Lead receives an empty human-authored assessment and the workflow remains usable.

### Assessment service

`ImpactAssessmentService` owns assessment creation, immutable revisions, submission, staleness, authorization, exact-revision decisions, and idempotency.

Every submitted assessment identifies:

- the exact source, from/to versions, diff ID, and diff hash;
- whether operational action is required;
- affected sites, roles, and document references;
- one or more proposed administrative actions;
- rationale and effective date;
- provenance (`human_authored` or `ai_assisted`);
- the immutable revision hash presented for decision.

### Change task service

`ChangeTaskService` materializes one task for each approved proposed action. A task contains the approved action text, rationale, effective date, explicit target set, assessment/revision reference, catalog lineage, status, and deterministic idempotency key.

It has no production method that creates a task without an approved assessment revision.

## Data model

### Global catalog records

- `rule_sources` — stable source key, module, title, publisher, jurisdiction, canonical URL, and active/retired state.
- `rule_source_snapshots` — source reference, capture mode, original submitted text, canonical text, content hash, publication/effective/capture dates, publisher version label, curator reference, curator note, and creation time.
- `rule_versions` — source/snapshot reference, predecessor, monotonic source sequence, lifecycle state, platform actor references, decision reason, and decision times.
- `rule_diffs` — source, from/to versions and hashes, algorithm version, structured hunks, diff hash, and creation time.
- `obligations` — stable obligation key, source, module, and active/retired state.
- `obligation_versions` — obligation, rule version, source locator, authoritative text, content hash, and creation time.
- `platform_catalog_events` — append-only tenantless catalog mutation envelopes with segment/order, actor, action, entity reference, canonical payload/hash, previous/event hashes, and creation time.
- `platform_catalog_checkpoints` — immutable closed-segment boundaries with first/last hashes, event count, prior-checkpoint hash, and signed checkpoint digest.

Catalog source text is application data. It is never copied into audit payloads or logs.

### Tenant records

- `impact_assessments` — tenant, source/version/diff references, lifecycle state, current revision reference, creator, submission/decision actors, decision reason, decision time, and optimistic version.
- `impact_assessment_revisions` — immutable revision number, provenance, narrative, operational-action outcome, effective date, AI metadata/hashes where applicable, revision hash, author, and creation time.
- `impact_actions` — revision, stable action key, action text, rationale, and effective date.
- `impact_action_site_targets` — tenant-aware site targets.
- `impact_action_role_targets` — approved base-role targets.
- `impact_action_document_targets` — non-sensitive document type/reference labels; no document content in Phase 03.
- `change_tasks` — tenant, approved assessment/revision/action, status, effective date, lineage hash, idempotency key, and creation/completion metadata.
- `change_task_site_targets`, `change_task_role_targets`, and `change_task_document_targets` — immutable copies of the approved scope.

All tenant-owned references use composite tenant-aware foreign keys. Phase 03 repositories consume the Phase 02 authorized transaction and never accept a caller-selected tenant as authority.

## Lifecycle and invariants

### Source and version lifecycle

`rule_sources` transition from `active` to `retired`. Retirement never deletes history.

`rule_versions` transition as follows:

```text
candidate -> published -> superseded
candidate -> rejected
published -> withdrawn
```

- Content and provenance are immutable after capture. Corrections create a new snapshot/version.
- A source can have at most one current published version.
- A non-baseline version references exactly one predecessor from the same source.
- Duplicate `(source_id, content_hash)` capture is idempotent and returns the existing version without creating a diff, assessment, or task.
- Publishing a later version creates and persists its deterministic diff in the same transaction.
- Withdrawing a published version preserves its snapshot, diff, and every tenant decision already made against it.

### Assessment lifecycle

```text
draft -> pending_approval -> approved
                         -> rejected
                         -> stale
draft -> stale
```

- Submission binds one immutable revision hash and a named Quality Lead decision boundary.
- Catalog publication never performs cross-tenant fan-out. A newer published version makes unfinished older-version assessments effectively stale; the next tenant-scoped read or mutation records the `stale` transition and tenant audit event. The decision validator checks the current catalog version directly, so an obsolete assessment cannot be approved before that transition is persisted.
- Approval is allowed only while the assessment is pending, its exact revision/diff hashes still match, the source/version remains eligible, and recent authentication is present.
- Approval and rejection require a trimmed reason between 1 and 2,000 characters.
- A rejected assessment is terminal. A corrected proposal is a new assessment with lineage to the rejected assessment.
- Repeated identical decisions return the existing result. A contradictory second decision is denied.
- An assessment with `no_action_required` may be approved and creates zero tasks.

### Change task lifecycle

Phase 03 supports `ready`, `in_progress`, `completed`, and `cancelled` tasks, but its acceptance boundary requires only creation in `ready` state and authenticated reading. Later phases may extend consumption behavior without changing task lineage.

- Approval creates exactly the actions and targets in the approved revision.
- Task idempotency uses the approved assessment ID, revision ID, action key, and target-scope hash.
- A task cannot target a broader scope than its approved action.
- Rejection cannot create a task, worker briefing, policy edit, or participant artifact.

## Authorization

Catalog curation uses the Phase 02 protected platform-operator boundary. It is not a tenant role or public route.

Tenant authorization adds these capabilities to the Phase 02 policy model:

- `rule:read`
- `impact_assessment:create`
- `impact_assessment:read`
- `impact_assessment:update`
- `impact_assessment:submit`
- `impact_assessment:approve`
- `impact_assessment:reject`
- `change_task:read`

Quality Leads may use all listed capabilities with MFA. Approval and rejection additionally require recent authentication. Supervisors may read approved tasks only for assigned sites. Workers and Participant/Nominee memberships are denied every Phase 03 capability by default.

The MVP permits the submitting Quality Lead to make the decision. The decision still requires an explicit confirmation, exact task preview, decision reason, recent authentication, and immutable actor/audit receipt.

## Transaction and audit boundaries

Every database mutation emits an append-only hash-chained audit event in the same transaction.

### Platform catalog chain

Phase 03 adds the separate `platform_catalog_events` hash chain through the Phase 02 protected platform-operator transaction boundary. It records catalog snapshot, version, publication, rejection, withdrawal, obligation-version, and diff events. It reuses the established canonicalization, persisted-row parity, locking, and checkpoint patterns without placing domain events in `platform_security_events`. It never uses a null/sentinel tenant in a tenant chain.

Catalog audit payloads contain IDs, source/version state, content/diff hashes, algorithm version, curator/operator references, and decision reason. They do not contain full source text.

### Tenant chain

The tenant audit chain records assessment creation/revision/submission/staleness, approval/rejection, and change-task creation.

Decision payloads contain:

- source, snapshot, from/to version, and diff IDs/hashes;
- assessment and exact revision IDs/hashes;
- provenance and allow-listed AI metadata/hashes;
- actor, membership, action, time, and decision reason;
- approved target-scope hash;
- created task IDs/count, or zero for rejection/no-action approval.

Approval, task materialization, and the tenant audit append commit together. Rejection and its audit append commit together. Any error rolls the whole transaction back.

## User experience

### Platform operator

An internal protected command accepts:

- a UTF-8 text/Markdown content path;
- a validated metadata manifest;
- an idempotency key;
- an explicit capture or publish operation.

The command prints only identifiers, hashes, state, and safe validation errors. It does not print source content, credentials, or provider responses.

### Quality Lead

1. **Rule library** — list sources, modules, current versions, effective dates, and published diffs without a terminal assessment for the current tenant.
2. **Version review** — show publisher/source metadata, hashes, baseline, and deterministic diff.
3. **Impact editor** — a Quality Lead starts the tenant assessment on demand; the screen shows AI suggestions as labelled editable assistance and captures outcome, sites, roles, documents, actions, rationale, and effective date.
4. **Decision** — require review of the exact diff/revision; preview the exact tasks and scopes that approval creates; require a reason for either decision.
5. **Receipt** — persistently show decision, actor, time, source/version, revision hash, task count, and audit event reference after reload.

The UI uses “records,” “suggests,” and “indicates.” It never labels a provider compliant/non-compliant, declares a breach, or presents an AI confidence score as an outcome.

## Accessibility

- Side-by-side diff is available on wide screens; a single-column linear diff is the mobile and assistive-technology baseline.
- Added and removed content has explicit text labels and does not rely on color.
- Screens use semantic landmarks, ordered headings, native controls, visible focus, logical keyboard order, and a skip link.
- Submit errors focus a summary and associate each field error programmatically.
- Status changes use text plus appropriate live-region semantics.
- Confirmation dialogs support Escape, contain focus while open, and restore focus to the invoking control.
- Layout supports browser zoom, narrow reflow, high contrast, and reduced motion.

## Failure handling

- Duplicate content returns the existing version and a link/reference to it.
- The first snapshot is labelled as a baseline with no diff or assessment.
- Diff-generation failure leaves the candidate unpublished and exposes a safe operator error.
- A disabled or failed AI adapter opens an empty human-authored assessment.
- A newer version blocks approval of a stale assessment.
- Server-side state and idempotency checks handle double submission and concurrent decisions.
- Authorization failures use the Phase 02 generic denial behavior and reveal no cross-tenant resource existence.
- Recoverable validation errors retain the Quality Lead’s entered draft.
- Domain, audit, and task-materialization failures roll back together and can be retried safely.
- Logs exclude raw source text, prompts, generated output, tokens, personal information, and database error detail.

## Retention and deletion

Phase 03 performs no automatic deletion of catalog, assessment, revision, decision, task, or audit records. Catalog records are immutable reference evidence. Tenant records remain subject to legal holds and a future approved record-class retention policy; Phase 03 does not invent a statutory retention claim for rule-management records.

Production enablement requires an approved retention rule for each new tenant record class. Until then, cleanup jobs for these classes remain disabled.

## Testing strategy

### Domain tests

- source identity and metadata validation;
- text canonicalization and content hashing;
- duplicate idempotency;
- version and assessment transition matrices;
- deterministic diff output and hash reproducibility;
- baseline, no-change, stale, withdrawn, and no-action behavior;
- revision hashing and exact-revision decision binding;
- required decision reasons and self-approval policy;
- task-scope equality and idempotency;
- default-deny authorization decisions.

### Database integration tests

- catalog immutability and unique-current-version constraints;
- tenant-aware foreign keys and RLS isolation;
- platform catalog and tenant audit-chain parity;
- publication plus diff plus audit atomicity;
- approval plus exact task set plus audit atomicity;
- rejection plus zero-task guarantee;
- rollback on audit/task failure;
- concurrent publication and decision behavior;
- duplicate capture and retry behavior.

PGlite supplies deterministic local integration coverage. Native Neon multi-session contention and RLS verification remain a release gate before production claims.

### Adapter and route tests

- manual and future monitored candidates satisfy the same capture contract;
- AI fake, disabled adapter, malformed output, timeout, and safe fallback;
- platform-operator-only catalog mutations;
- Quality Lead authorization and recent authentication;
- Supervisor assigned-site task reads;
- Worker/Participant default denial;
- validation, generic denial, idempotency, and safe error responses.

### Browser acceptance tests

- keyboard-only source review, assessment editing, approval, and rejection;
- desktop side-by-side and mobile/linear diff behavior;
- explicit Added/Removed labels and sensible screen-reader order;
- focus restoration, error summaries, and status announcements;
- exact task preview before approval;
- rejection confirmation that no artifacts are created;
- persistent audit receipt after reload.

## Acceptance criteria

1. A platform operator can capture a verified baseline and a later text/Markdown version through the manual adapter.
2. The later version produces a deterministic, human-readable, hash-addressed diff.
3. A tenant assessment references that exact version and diff and supports labelled AI-assisted drafting or human fallback.
4. A Quality Lead can revise and submit the assessment, then approve or reject the exact revision with a reason and recent authentication.
5. Rejection records its audit lineage and creates zero downstream artifacts.
6. Approval creates exactly the reviewed administrative tasks and tenant audit event in one transaction.
7. A no-action approval creates zero tasks while preserving the reviewed decision and reason.
8. Cross-tenant access, stale approval, contradictory decisions, and retry duplication fail safely.
9. The full workflow is usable with a keyboard and in a narrow single-column viewport.
10. No unverified regulatory text, real participant/worker data, secrets, raw prompts, or generated model content enters source control, previews, fixtures, or logs.

## Requirement traceability

- **RULE-01:** `rule_sources`, immutable snapshots/versions, modules, obligations, and obligation versions provide the versioned library.
- **RULE-02:** the manual capture adapter plus deterministic diff service provides source ingest and highlighted changes.
- **RULE-03:** `ImpactDraftAdapter`, immutable AI/human revisions, persistent AI-assist labelling, and pending Quality Lead approval provide draft-only assistance.
- **RULE-04:** only approved exact revisions can enter `ChangeTaskService`; every other path has no downstream writer.
- **RULE-05:** approval/rejection reasons, exact source/diff/revision hashes, atomic tenant audit events, and persistent receipts provide decision lineage.

## Implementation sequencing

The Phase 03 specification and implementation plan may be completed while Phase 02 finishes. Phase 03 code execution begins only after the active Phase 02 branch is merged or the Phase 03 worktree is updated onto its completed contracts.

Implementation must:

- add new focused domain, schema, repository, service, integration, and web modules instead of extending Phase 01 bootstrap modules;
- consume the final Phase 02 authorized transaction and audit interfaces;
- use the next migration number after the completed Phase 02 journal;
- avoid changing Phase 02 audit hashing/canonicalization semantics;
- retire no Phase 02 authorization or platform-operator controls;
- keep regulatory source population outside source-control fixtures.

## Production gates

The following are explicit enablement gates rather than design ambiguities:

- verify official source identity, wording, dates, and legal/copyright handling before production catalog population;
- approve record-class retention rules before enabling cleanup or production handling;
- verify Vercel AI Gateway provider/model routing, retention, budgets, and Australian processing before enabling live AI drafts;
- pass native Neon multi-session RLS, publication, and decision-contention tests;
- pass real Vercel preview/security/log review without sensitive source or model content exposure.

Local verification of the deterministic `ImpactDraftAdapter` contract does not by itself mark production RULE-03 complete. RULE-03 remains production-gated until the live Vercel AI Gateway adapter passes the listed privacy, provider, budget, and processing checks.

## Alternatives rejected

### Tenant-owned rule libraries

This duplicates regulatory material across providers, creates inconsistent source identities, and makes monitoring and corrections harder. Tenant-specific operational interpretation belongs in impact assessments, not source forks.

### Forkable global rules

Overrides and reconciliation add complex precedence, conflict, and audit semantics before customer evidence shows a need. Phase 03 keeps one authoritative catalog and tenant-specific decisions.

### Automated monitoring first

Polling, extraction, parser drift, and source-identity uncertainty would expand the trust surface before the deterministic curation workflow exists. Manual capture establishes the normalized contract that future monitoring must obey.

## Approval boundary

This design authorizes the Phase 03 implementation shape after written-spec and implementation-plan approval. It does not authorize production launch, unverified regulatory content, live AI processing, automated monitoring, tenant catalog forks, worker briefings, participant workflows, compliance determinations, or Commission submission.
