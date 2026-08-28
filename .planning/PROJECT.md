# Attesta

## What This Is

Attesta is an administrative compliance-enablement SaaS for registered NDIS Supported Independent Living (SIL) providers in Australia. It turns NDIS Practice Standards obligations into verified frontline actions, accessible participant confirmations, and audit-ready evidence — without making compliance determinations or replacing clinical judgement.

**Source:** `PRD-ATTESTA.md` v2.0 (27 Aug 2026)

## Core Value

Prove that frontline workers practised updated standards and that participants understood, chose, and were heard — assembled into an auditor-ready evidence pack in minutes, not days.

## Product Boundary

- Attesta records, guides, and assembles evidence; it does not determine compliance or breach outcomes.
- Participant and advocate access is always free.
- Claiming, invoicing, clinical assessment, restrictive-practice authorisation, and Commission portal submission are out of scope.
- Participant and worker PII is application-owned and stored in Neon PostgreSQL in Australia where the selected plan supports it.
- WorkOS, Resend, and Vercel AI Gateway receive only the minimum necessary identity, delivery, or redacted model data.

## Architecture Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Application | Next.js + TypeScript on Vercel | One deployable web app with route handlers, cron, previews, and Sydney execution configuration |
| Database | Neon PostgreSQL | Managed PostgreSQL with branching for development and a Sydney/Australia region target |
| ORM/validation | Drizzle ORM + Zod | Open-source, SQL-transparent data access and runtime validation |
| Identity | WorkOS AuthKit | Hosted authentication, MFA, SSO, and organization membership |
| Email | Resend | Transactional email and briefing/expiry notifications |
| AI | Vercel AI Gateway + AI SDK | Model/provider abstraction, allow-lists, budgets, fallbacks, and usage visibility |
| Files | S3-compatible object-storage adapter | Keeps evidence/audio storage behind an interface; provider selection is a separate privacy and cost gate |
| Testing | Vitest + Playwright | Fast domain/API tests plus browser acceptance coverage |
| Workflow | Superpowers | Design approval, written implementation plans, TDD, isolated worktrees, review, and verification |

## Non-Negotiable Constraints

- The target infrastructure is Vercel, Neon, WorkOS, Resend, and Vercel AI Gateway as defined in the design spec.
- No secrets, PII, audio, or evidence files in source control, previews, logs, prompts, or test fixtures.
- AI is draft-only and human-in-command; prohibited AI uses remain release blockers.
- Database mutations must be tenant-scoped and emit an append-only hash-chained audit event in the same transaction.
- Vendor regional handling, retention, DPA, and backup behavior must be verified before production launch.

## Planning Status

The planning baseline is aligned to Vercel, Neon, WorkOS, Resend, Vercel AI Gateway, and named open-source components. The Phase 01 runtime foundation is locally complete against synthetic/local verification, including Final C's complete-envelope audit and integration-boundary tests. PLAT-02 remains pending for update/approval/export coverage, and PLAT-03 remains pending for production TLS/AES/preview/log guarantees.

This local completion does not claim a real Vercel preview or production deployment, native Neon multi-session contention, vendor DPA/data-region/retention terms, or provisioned production credentials. Phases 02–10 have roadmap outlines only; each requires Superpowers brainstorming/design approval, a detailed design, and an approved implementation plan before later code work.

---
*Reset: 2026-08-28*
