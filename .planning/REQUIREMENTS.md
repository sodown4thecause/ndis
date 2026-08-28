# Requirements: Attesta

**Defined:** 2026-08-28
**Core Value:** Prove frontline practice and participant voice with audit-ready evidence in minutes.
**Source PRD:** `PRD-ATTESTA.md` v2.0

## v1 Requirements (MVP ≤ 90 days)

Phase 01 checkboxes below record local foundation verification only. They do not assert production deployment, native Neon contention, vendor terms, or production credentials.

### Platform & Security

- [x] **PLAT-01**: Multi-tenant data model with tenant → site → worker/participant hierarchy per PRD §8 ER diagram
- [x] **PLAT-02**: Append-only audit log with hash chaining on every create/update/approval/export
- [x] **PLAT-03**: TLS 1.3 in transit; AES-256 at rest; per-tenant PostgreSQL row-level security; no sensitive data in previews or logs
- [ ] **PLAT-04**: MFA enforced for all provider admin/quality-lead accounts
- [ ] **PLAT-05**: RBAC roles: Quality Lead, Supervisor, Worker, Participant/Nominee (read-only auditor deferred to Phase 2)
- [ ] **PLAT-06**: SSO through WorkOS AuthKit with Microsoft Entra ID and Google Workspace connections
- [ ] **PLAT-07**: AU data boundary — regulated participant/worker PII persisted in Neon PostgreSQL in Australia where supported; WorkOS/Resend receive minimum necessary metadata; model prompts are redacted by default
- [ ] **PLAT-08**: Default 7-year retention clocks on incidents, complaints, briefings, receipts, audit events

### Rule Library & Change Management (Epic E1)

- [ ] **RULE-01**: Versioned rule library holding Core Module + SIL supplementary module + SIL Quality Indicators (2026)
- [ ] **RULE-02**: Source ingest with highlighted text diff between versions
- [ ] **RULE-03**: AI-assisted draft impact assessment (A1) held in pending state until Quality Lead approval
- [ ] **RULE-04**: No worker task, briefing, or policy edit created until named approver acts
- [ ] **RULE-05**: Approval/rejection with reason written to audit log with source diff attached

### Worker Briefings (Epic E2)

- [ ] **BRIF-01**: Plain-language briefing summaries ≤ 200 words, mobile-first
- [ ] **BRIF-02**: One scenario question per briefing with immediate feedback
- [ ] **BRIF-03**: Immutable record of response, timestamp, briefing version, outcome
- [ ] **BRIF-04**: Supervisor exception dashboard flags workers with two incorrect scenario answers
- [ ] **BRIF-05**: Notification adapter for pending-briefing nudges; Resend email is the MVP transport, while SMS remains blocked on a paid carrier decision

### Participant Voice Receipts (Epic E3)

- [ ] **VOIC-01**: Receipts offered in plain language, Easy Read template, and audio playback (TTS)
- [ ] **VOIC-02**: Participant can confirm, correct, or flag "I want to talk to someone"
- [ ] **VOIC-03**: "No response" recorded as "not obtained" — never as consent
- [ ] **VOIC-04**: Flagged responses route to Quality Lead with independent advocacy contacts
- [ ] **VOIC-05**: Nominee co-sign only within recorded authority domains
- [ ] **VOIC-06**: Audio-response capture via STT (A5); original audio retained; transcript marked auto-generated
- [ ] **VOIC-07**: Easy Read / plain-language drafts (A3) require accessibility reviewer approval before publish

### Compliance Registers (Epic E4)

- [ ] **REG-01**: Worker screening currency register with 90/60/30-day expiry alerts
- [ ] **REG-02**: UI persistently labels screening as informational — Attesta does not issue clearances
- [ ] **REG-03**: Reportable-incident logging with applicable notification window display (24h / 5 business days)
- [ ] **REG-04**: Incident checklist of Commission portal information requirements (no portal submission)
- [ ] **REG-05**: Complaints register with 7-year retention clock

### Evidence Vault & Export (Epic E5)

- [ ] **EVID-01**: Evidence items mapped to obligations/quality indicators with source lineage (who, when, version, hash)
- [ ] **EVID-02**: Sampling helper for stratified AQA requests (e.g., 2 participants per home, domain, period)
- [ ] **EVID-03**: One-click export grouped by standard/indicator with manifest written to audit log
- [ ] **EVID-04**: Export includes audit chain-head for non-alteration verification

### QLD Playbooks (Epic E6)

- [ ] **QLD-01**: Tenancy/SIL separation checklist for provider-leased homes (Form 18a / Form R18)
- [ ] **QLD-02**: Conflict-of-interest disclosure record required in onboarding flow
- [ ] **QLD-03**: Voice Receipt offered confirming participant understood tenancy vs service agreement separation

### GTM Web (from GTM-SEO-GEO-STRATEGY.md)

- [ ] **GTM-01**: Public marketing site with 5 core SEO pillar pages and topic hub structure
- [ ] **GTM-02**: `/llms.txt`, `robots.txt` AI-crawler config, JSON-LD schema on educational pages
- [ ] **GTM-03**: "2026 SIL Evidence Gap Map" lead magnet download flow
- [ ] **GTM-04**: Trust/security page (AU residency, encryption, retention, NDB process, Commission disclaimer)

## v2 Requirements (Phase 2 ≤ 6 months)

- **PATT-01**: Pattern-review thresholds across incidents/complaints/receipts (decision-support only)
- **AUD-01**: Auditor read-only workspaces
- **CONS-01**: Consultant multi-client dashboards
- **STAT-01**: NSW + VIC tenancy/screening overlays (legal review gated)
- **INTG-01**: Rostering/HR integrations (ShiftCare, Brevity, Employment Hero) via webhooks/CSV
- **AI-02**: Evidence→indicator mapping suggestions (A2), scenario-question drafting (A4), theme clustering (A6), audit-pack narrative index (A7)

### Review-derived backlog additions

These items came from `NDIS Attesta PRD GTM Review.md`. They are roadmap candidates, not silently expanded MVP commitments, and each remains gated by legal, privacy, accessibility, or partner validation.

- **SAFE-01**: Restrictive-practice and Behaviour Support Plan register for currency, usage records, escalation, and reporting preparation; informational only, with no authorisation, compliance determination, or Commission portal submission. Target Phase 06 after legal review.
- **AI-03**: AI-assisted document intake and an evidence coverage index; drafts and coverage signals only, never a compliance score or automated adverse action. Target Phase 07/10 after privacy-impact and model-provider review.
- **BRIF-06**: Shift-handover continuity acknowledgement with participant-safe, minimum-necessary updates. Target Phase 10.
- **VOIC-08**: Communication preference profile and consent matrix supporting AAC and other accessible formats. Target Phase 10 after advocacy/accessibility review.
- **AUD-02**: Time-bound AQA sampling workspace over already-authorized evidence. Target Phase 10 after auditor design-partner validation.

## Out of Scope

| Feature | Reason | PRD Ref |
|---------|--------|---------|
| NDIS claiming/invoicing | Not a payment engine | §1 |
| Compliance outcome determination | R4 release blocker | §9.3 |
| Commission incident submission | Informational checklists only | Epic E4 |
| Worker clearance issuance | Worker Screening Units only | §7 |
| ECA workflows | SIL adult focus | §3 |
| NDIA PRODA/PACE API | Backlog; requires DPO partnership | §9.1 |
| NWSD sync | Backlog; manual entry until verified | OQ-005 |
| Aged-care ACQS mapping | Backlog | §5 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01–03 | Phase 01 | Locally complete; production gates open |
| PLAT-04–08 | Phase 02 | Pending |
| RULE-01–05 | Phase 03 | Pending |
| BRIF-01–05 | Phase 04 | Pending |
| VOIC-01–07 | Phase 05 | Pending |
| REG-01–05 | Phase 06 | Pending |
| EVID-01–04 | Phase 07 | Pending |
| QLD-01–03 | Phase 08 | Pending |
| GTM-01–04 | Phase 09 | Pending |
| v2 set plus SAFE-01, AI-03, BRIF-06, VOIC-08, AUD-02 | Phase 06, 07, or 10 | Backlog |

**Coverage:** v1 requirements: 38 total | Mapped to phases: 38 | Unmapped: 0

## Planning gate

Phase 01 is the only locally completed implementation slice. Phases 02–10 remain roadmap outlines without approved detailed designs or implementation plans. Before code work begins for any later phase, Superpowers brainstorming and design approval must produce and approve the phase design and implementation plan. Phase 10 remains post-MVP planning.

## Delivery Constraints

- **Application:** Next.js + TypeScript on Vercel, with regulated functions configured for Sydney (`syd1`) where supported.
- **Data:** Neon PostgreSQL is the system of record, targeted to Sydney/Australia (`ap-southeast-2`) where supported.
- **Identity:** WorkOS AuthKit supplies authentication, MFA, SSO, and organization membership; application RBAC is enforced from Neon records.
- **Email:** Resend supplies transactional email only; no participant/worker content is sent beyond the minimum required for delivery.
- **AI:** Vercel AI Gateway is the sole model-routing surface, with explicit model/provider allow-lists and human approval gates.
- **Open source:** Drizzle, Zod, Vitest, Playwright, PostgreSQL RLS, and comparable permissively licensed tools are preferred for application behavior.
- **SMS:** A free/open-source library cannot itself deliver carrier SMS; the interface is planned, but production SMS requires a vendor and privacy review.

---
*Requirements defined: 2026-08-28 from PRD-ATTESTA.md*
