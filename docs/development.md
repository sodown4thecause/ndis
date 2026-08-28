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

Database setup uses a disposable Neon branch or PostgreSQL database. Set `DATABASE_URL` in `.env.local`, then run `pnpm --filter @attesta/db db:migrate` and `pnpm --filter @attesta/db db:check`. Database-backed verification runs with `pnpm test:db`.

## Deployment boundary

The Next.js application deploys to Vercel with regulated functions configured for Sydney (`syd1`). Neon PostgreSQL is the application system of record and must use the Australian region target when available. Set vendor secrets only in Vercel environment configuration; never place them in source control, preview logs, or browser code.

WorkOS handles authentication and organization identity, Resend handles transactional email, and Vercel AI Gateway handles model routing. The application remains the source of truth for tenant membership, roles, audit events, and regulated records.

## Verification gate

Before Phase 01 is marked complete, run the full command set above plus `git diff --check`. Database-backed RLS and rollback checks require a disposable PostgreSQL instance. If that service is unavailable, report the phase as partially verified.
