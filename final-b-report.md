# Final Remediation B report

## Implemented

- Synthetic tenant bootstrap is disabled unless `ENABLE_SYNTHETIC_BOOTSTRAP=true`, and the gate always rejects it when `NODE_ENV=production`.
- `/bootstrap` returns a real 404 when disabled; the home-page link is hidden. Playwright enables the flag only for its local test server; `.env.example` keeps it false.
- Tenant bootstrap requests have a 16 KiB body limit and 120-character field limits. Oversized, malformed, validation, disabled, and service failures use stable non-sensitive responses.
- The production `POST` export still resolves the real `DATABASE_URL` and Neon database client. The route integration test injects only a normal handler dependency and uses a migrated disposable PGlite database.
- Added Request -> route handler -> real foundation service -> migrated PGlite -> serialized Response coverage, while retaining the intercepted browser UI test.
- Documented repository-root Vercel Project Root, root-relative build/output (`apps/web/.next`), preview-deployment gate, liveness/readiness boundary, and Phase 02 authenticated/rate-controlled provisioning work.

## Node 22 evidence

All commands below were run with Node.js 22.14.0 and pnpm 11.5.0:

- `pnpm vitest run apps/web/app/api/health/route.test.ts apps/web/app/api/tenants/route.test.ts apps/web/app/api/tenants/route.integration.test.ts apps/web/lib/env.test.ts` — 4 files, 21 tests passed.
- `pnpm test:db` — 2 files, 8 migrated PGlite tests passed.
- `pnpm test:e2e` — 1 Playwright test passed.
- `pnpm typecheck` — all 4 typecheck targets passed.
- `pnpm build` — Next.js production build passed; `/api/tenants` and `/bootstrap` are dynamic routes.
- `pnpm lint` — passed.
- `git diff --check` — passed; only line-ending normalization warnings were reported.

## Owned files

`.env.example`, `apps/web/app/api/tenants/route.ts`, its route tests and migrated-database integration test, `apps/web/app/bootstrap/page.tsx`, `apps/web/app/bootstrap/form.tsx`, `apps/web/app/page.tsx`, `apps/web/lib/env.ts`, `playwright.config.ts`, `vercel.json`, `docs/development.md`, and `packages/db/src/integration/route-test-support.ts`.

## Residual gates

No Vercel preview deployment was performed. Native Neon multi-session/RLS/role verification, production credentials and provisioning, and the authenticated/rate-controlled provisioning plus protected readiness check remain launch/Phase 02 gates.
