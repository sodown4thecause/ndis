# Project State: Attesta

**Last updated:** 2026-08-28
**Current milestone:** Phase 01 locally complete; production launch gates remain
**Active phase:** Phase 01 — Platform Foundation (local verification complete)

## Completed

- [x] PRD and GTM source documents re-aligned to Vercel, Neon, WorkOS, Resend, and Vercel AI Gateway
- [x] Source documents and planning baseline aligned to the new target architecture
- [x] Planning workflow reset to Superpowers
- [x] Phase sequence and v1 requirements retained
- [x] Review-derived backlog triaged without expanding Phase 01 scope
- [x] Phase 01 locally verified from Task 6A final clean-checkout evidence at commit `f4ac66d` under Node 22.14.0

## In Progress

- [ ] No later implementation phase is approved or in progress; Phases 02–10 remain roadmap outlines pending Superpowers brainstorming/design approval and approved detailed implementation plans.

## Phase 01 Evidence Boundary

Task 6A final clean-checkout evidence at `f4ac66d` passed frozen install, lint, typecheck, 56 unit tests, 7 live PGlite database tests, Playwright, Next build, and diff checks under Node 22.14.0. This records local completion only; it does not claim production deployment, native Neon multi-session contention, vendor DPA/data-region/retention terms, or production credentials.

## Launch Gates

| ID | Gate | Status |
|----|------|--------|
| LG-001 | Run native multi-session contention verification against the selected Neon environment. | Open |
| LG-002 | Execute and verify a real Vercel preview, then production deployment/readiness checks. | Open |
| LG-003 | Verify Vercel, Neon, WorkOS, Resend, and Vercel AI Gateway regional handling, DPA, retention, backup, failover, and cost terms. | Open |
| LG-004 | Provision and configure production credentials outside source control after the preceding gates pass. | Open |

## Review Disposition — `NDIS Attesta PRD GTM Review.md`

- **Accepted into roadmap:** prioritize AQA/consultant partnership-led GTM; add a legally reviewed restrictive-practice/BSP register to Phase 06; add a non-determinative evidence coverage index after the evidence vault.
- **Deferred to Phase 10:** shift-handover verification, accessible communication/consent matrix, and time-bound AQA sampling workspace.
- **Not accepted as written:** a compliance/readiness score, automated adverse action, restrictive-practice authorization logic, or automatic Commission submission.
- **Verification required:** all statutory dates, penalty amounts, competitor capabilities, pricing, and “auditor requirement” claims in the review must be checked against primary sources before product or marketing copy.
- **PRD status:** remains v2.0 until the accepted roadmap changes receive product/legal approval; the review is advisory input, not an authority to change regulatory scope.

## Open Gates

| ID | Question | Blocks |
|----|----------|--------|
| OQ-001 | NDIS Act penalty Part/Division post-2026 amendments | User-facing legal copy |
| OQ-003 | Attesta TM, ASIC, and domain availability | Public launch |
| OQ-004 | Vercel AI Gateway provider routing, model availability, retention, and AU processing terms | AI features using real data |
| OQ-008 | Advocacy-sector design partner for Voice Receipts | Consent and anti-coercion UX sign-off |
| OQ-009 | Vercel/Neon/WorkOS/Resend regional handling, DPA coverage, retention, and cost | Production launch |
| OQ-013 | Australian object-storage choice for evidence/audio blobs | Voice Receipts and Evidence Vault |
| OQ-014 | Paid carrier selection for SMS; no free/open-source carrier transport assumed | SMS nudges |

## Decisions Locked For Phase 01

1. Vercel hosts the Next.js application and public site.
2. Neon PostgreSQL is the application system of record.
3. WorkOS AuthKit owns authentication and organization identity; authorization remains in the application database.
4. Resend owns transactional email delivery.
5. Vercel AI Gateway is the only model-routing interface.
6. Open-source libraries are preferred for application logic and local development.

---
*State reset: 2026-08-28*
