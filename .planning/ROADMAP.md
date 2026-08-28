# Roadmap: Attesta

## Overview

Greenfield build of Attesta MVP: platform foundation → auth/security → rule library → worker briefings → participant voice receipts → compliance registers → evidence vault → QLD playbooks, with GTM web presence running in parallel from Phase 09. Vercel hosts the application, Neon is the application system of record, WorkOS owns hosted identity, Resend owns email delivery, and Vercel AI Gateway owns model routing. Drizzle, Zod, PostgreSQL RLS, Vitest, Playwright, and comparable permissively licensed tools are the preferred open-source components. Phase 10 is post-MVP planning for auditor workspaces, state overlays, integrations, and extended AI.

**Source:** `PRD-ATTESTA.md` §5 (MVP), `GTM-SEO-GEO-STRATEGY.md` §5

## Phases

- [x] **Phase 01: Platform Foundation** — Core schema, audit log, Neon/Vercel deployment scaffold (locally complete; production gates open)
- [ ] **Phase 02: Auth & Tenant Security** — WorkOS AuthKit MFA, RBAC, SSO, encryption, retention defaults (roadmap outline only)
- [ ] **Phase 03: Rule Library & Change Tasks** — Versioned obligations, human-approved change workflow (E1) (roadmap outline only)
- [ ] **Phase 04: Worker Micro-Briefings** — Scenario-verified mobile briefings + supervisor dashboard + Resend email nudges (E2) (roadmap outline only)
- [ ] **Phase 05: Participant Voice Receipts** — Accessible confirmations with TTS/STT (E3, AI A3/A5) (roadmap outline only)
- [ ] **Phase 06: Compliance Registers** — Screening, incidents, complaints, and legally reviewed restrictive-practice/BSP register (E4) (roadmap outline only)
- [ ] **Phase 07: Evidence Vault & AQA Export** — Indexed vault, one-click audit pack, and non-determinative evidence coverage signals (E5) (roadmap outline only)
- [ ] **Phase 08: QLD Tenancy Playbook** — Dual-agreement separation workflow (E6) (roadmap outline only)
- [ ] **Phase 09: GTM Web Presence** — Vercel SEO/GEO marketing site + lead magnet (roadmap outline only)
- [ ] **Phase 10: Phase 2 Backlog** — Shift handover, communication/consent matrix, AQA workspace, pattern review, NSW/VIC, integrations (overview only)

Phases 02–10 are roadmap outlines only. Each requires Superpowers brainstorming and design approval, followed by an approved detailed design and implementation plan, before any later-phase code work begins. Phase 10 remains post-MVP planning.

## Phase Details

### Phase 01: Platform Foundation
**Goal:** Runnable application scaffold with core data model and immutable audit trail
**Depends on:** Nothing
**Requirements:** PLAT-01, PLAT-02, PLAT-03
**Success Criteria:**
  1. [x] Synthetic tenant bootstrap creates at least one site, worker, and participant record in local verification.
  2. [x] Unit and live PGlite tests verify the complete immutable audit envelope, linked hashes, explicit persisted order, and rollback behavior for the foundation-create slice; broader PLAT-02 mutation coverage remains pending.
  3. [x] Vercel/Sydney and Neon/Australia targets, encryption boundaries, and backup obligations are documented; local RLS is verified, while PLAT-03 production TLS/AES/preview/log guarantees remain launch gates.

**Local evidence:** Task 6A final clean-checkout evidence at commit `f4ac66d` passed under Node 22.14.0 for frozen install, lint, typecheck, 56 unit tests, 7 live PGlite database tests, Playwright, Next build, and diff checks.

**Status:** Phase 01 runtime foundation is locally complete. PLAT-02 remains pending for update/approval/export coverage beyond foundation-create events. PLAT-03 remains pending for production TLS/AES and preview/log guarantees. Native Neon multi-session contention, real Vercel preview/production deployment, vendor terms/DPA/data-region/retention verification, and production credentials remain launch gates.

**Design:** `docs/superpowers/specs/2026-08-28-attesta-vercel-stack-design.md` (approved for Phase 01 local implementation)

### Phase 02: Auth & Tenant Security
**Goal:** Secure multi-tenant access with MFA, RBAC, and SSO
**Depends on:** Phase 01
**Requirements:** PLAT-04, PLAT-05, PLAT-06, PLAT-07, PLAT-08
**Success Criteria:**
  1. Quality Lead can sign in via Entra ID or Google with MFA enforced
  2. Workers cannot access Quality Lead functions; row-level security isolates tenants
  3. Retention policy defaults applied to new record types
**Design and plan:** Not approved. Requires Superpowers brainstorming/design approval before Phase 02 code work.

### Phase 03: Rule Library & Change Tasks
**Goal:** Versioned NDIS rule library with human-approved change propagation (E1)
**Depends on:** Phase 02
**Requirements:** RULE-01–05
**Success Criteria:**
  1. Quality Lead sees diff when SIL guidance updates and can approve/reject impact assessment
  2. Rejected assessments produce no downstream artefacts
  3. Approved changes create scoped change tasks with full audit lineage
**Design and plan:** Not approved. Requires Superpowers brainstorming/design approval before Phase 03 code work.

### Phase 04: Worker Micro-Briefings
**Goal:** Two-minute scenario-verified briefings with supervisor exceptions (E2)
**Depends on:** Phase 03
**Requirements:** BRIF-01–05
**Success Criteria:**
  1. Worker completes briefing on mobile with scenario question and immutable record
  2. Two incorrect answers flag supervisor dashboard without disciplinary suggestions
  3. Pending briefing nudges sent via email/SMS
**Design and plan:** Not approved. Requires Superpowers brainstorming/design approval before Phase 04 code work.

### Phase 05: Participant Voice Receipts
**Goal:** Accessible participant confirmations with anti-coercion safeguards (E3)
**Depends on:** Phase 04
**Requirements:** VOIC-01–07
**Success Criteria:**
  1. Participant completes receipt in preferred format (Easy Read + audio)
  2. Silence recorded as "not obtained"; escalation route functional
  3. Nominee co-sign blocked outside authority domains
**Design and plan:** Not approved. Requires Superpowers brainstorming/design approval before Phase 05 code work.

### Phase 06: Compliance Registers
**Goal:** Screening currency, incident windows, complaints tracking, and a legally reviewed restrictive-practice/BSP register (E4)
**Depends on:** Phase 02
**Requirements:** REG-01–05
**Success Criteria:**
  1. Screening register shows amber at 30 days with alert history; informational-only labelling
  2. Logged incidents display correct statutory window and checklist
  3. Complaints entries carry 7-year retention clock
  4. If SAFE-01 is approved, restrictive-practice/BSP records are informational, legally reviewed, and never an authorisation or submission engine
**Design and plan:** Not approved. Requires Superpowers brainstorming/design approval before Phase 06 code work.

### Phase 07: Evidence Vault & AQA Export
**Goal:** One-click auditor-ready evidence pack with non-determinative evidence coverage signals (E5)
**Depends on:** Phases 04, 05, 06
**Requirements:** EVID-01–04
**Success Criteria:**
  1. Evidence items link to obligations with full lineage metadata
  2. Sampling helper produces stratified export per AQA criteria
  3. Export manifest and chain-head written to audit log
  4. Any AI-assisted coverage signal is labelled as decision support, cites source versions, and requires human review
**Design and plan:** Not approved. Requires Superpowers brainstorming/design approval before Phase 07 code work.

### Phase 08: QLD Tenancy Playbook
**Goal:** Tenancy/SIL separation workflow for Queensland (E6)
**Depends on:** Phases 05, 07
**Requirements:** QLD-01–03
**Success Criteria:**
  1. Onboarding flow enforces dual-agreement checklist and conflict disclosure
  2. Voice Receipt confirms participant understanding of separation
  3. Playbook references Form 18a / Form R18 correctly
**Design and plan:** Not approved. Requires Superpowers brainstorming/design approval before Phase 08 code work.

### Phase 09: GTM Web Presence
**Goal:** SEO/GEO marketing site supporting concierge validation
**Depends on:** Phase 02 (trust page may reference real security posture)
**Requirements:** GTM-01–04
**Success Criteria:**
  1. 5 pillar pages + topic hub live with JSON-LD and citability blocks
  2. `/llms.txt` and AI-crawler `robots.txt` configured
  3. Evidence Gap Map lead magnet captures qualified leads
  4. Consultant and AQA partner motions are prioritized before broad cold-outreach expansion
**Design and plan:** Not approved. Requires Superpowers brainstorming/design approval before Phase 09 code work.

### Phase 10: Phase 2 Backlog (Overview)
**Goal:** Documented scope for post-MVP expansion
**Depends on:** MVP complete
**Requirements:** v2 set plus SAFE-01, AI-03, BRIF-06, VOIC-08, and AUD-02 in REQUIREMENTS.md
**Scope:** Shift-handover continuity, accessible communication/consent matrix, time-bound AQA sampling workspace, pattern review, NSW/VIC overlays, integrations, and extended AI; all remain approval-gated.
**Design and plan:** Not approved. Phase 10 remains post-MVP planning and requires Superpowers brainstorming/design approval before any code work.

---
*Roadmap created: 2026-08-28*
