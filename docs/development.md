# Attesta development

## Commands

```text
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm build
```

The supported toolchain is Node.js 22.x and pnpm 11.5.0. The current development host must use that toolchain before release verification; Node 25 is not a release target.

Synthetic bootstrap is disabled by default. For local development only, set `ENABLE_SYNTHETIC_BOOTSTRAP=true` in an untracked `.env.local`; Playwright sets the same flag in its test web server configuration. The route also rejects the flag whenever `NODE_ENV=production`, and `/bootstrap` is not rendered when the flag is disabled. The endpoint uses a 16 KiB request limit and 120-character field limits, and returns stable non-sensitive errors. Production provisioning is intentionally disabled; authenticated, rate-controlled provisioning is Phase 02 work and must not rely on an in-memory serverless limiter.

Database setup uses a disposable Neon branch or PostgreSQL database. Set `DATABASE_URL` for the application and a separate `DATABASE_MIGRATION_URL` for the migration owner in `.env.local`, then run `pnpm --filter @attesta/db db:migrate`, `pnpm --filter @attesta/db db:check`, and `pnpm --filter @attesta/db db:generate` as needed. Root `pnpm test:db` runs all three live PGlite files sequentially: the two package database tests plus the real web route integration. For focused package work, `pnpm --filter @attesta/db test:db` continues to run only the two package database tests.

The deployed application uses a least-privilege `attesta_runtime` login granted the `attesta_app` group role. `attesta_app` is `NOLOGIN NOBYPASSRLS` with explicit schema/table/sequence grants and no audit `UPDATE` or `DELETE` grant. Provision the login authentication and the separate migration-owner connection outside source control; no password or real credential belongs in this repository. See `packages/db/README.md` for the role posture and example grants.

## Vercel project root

Use one Vercel project with the repository root as Project Root (leave the dashboard Root Directory empty). `vercel.json` therefore uses root-relative commands and output: Vercel installs from the repository root, runs `pnpm --filter @attesta/web build`, and consumes the Next.js output at `apps/web/.next`. The explicit output directory is valid here because it is relative to the repository Project Root and points to the nested app's framework output. A Vercel preview deployment is still a launch gate and has not been performed by this local verification.

Liveness is intentionally independent of database credentials (`GET /api/health`). A separate authenticated readiness check that verifies database connectivity and migrations is Phase 02/production work.

## Deployment boundary

The Next.js application deploys to Vercel with regulated functions configured for Sydney (`syd1`). Neon PostgreSQL is the application system of record and must use the Australian region target when available. Set vendor secrets only in Vercel environment configuration; never place them in source control, preview logs, or browser code.

WorkOS handles authentication and organization identity, Resend handles transactional email, and Vercel AI Gateway handles model routing. The application remains the source of truth for tenant membership, roles, audit events, and regulated records.

## Verification gate

Before Phase 01 is marked complete, run the full command set above plus `git diff --check`. Root `test:db` is the sequential in-process PGlite release gate covering the actual Drizzle migrator, live database invariants, and real tenant route serialization; it does not prove native Neon multi-session contention or pooling behavior. Native Neon RLS, role, and contention verification remain launch gates. Database-backed RLS and rollback checks require a disposable PostgreSQL instance for that native gate. If it is unavailable, report the phase as partially verified.
