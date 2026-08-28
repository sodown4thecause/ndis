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

Database setup uses a disposable Neon branch or PostgreSQL database. Set `DATABASE_URL` for the application and a separate `DATABASE_MIGRATION_URL` for the migration owner in `.env.local`, then run `pnpm --filter @attesta/db db:migrate`, `pnpm --filter @attesta/db db:check`, and `pnpm --filter @attesta/db db:generate` as needed. Database-backed verification runs with `pnpm test:db`.

The deployed application uses a least-privilege `attesta_runtime` login granted the `attesta_app` group role. `attesta_app` is `NOLOGIN NOBYPASSRLS` with explicit schema/table/sequence grants and no audit `UPDATE` or `DELETE` grant. Provision the login authentication and the separate migration-owner connection outside source control; no password or real credential belongs in this repository. See `packages/db/README.md` for the role posture and example grants.

## Deployment boundary

The Next.js application deploys to Vercel with regulated functions configured for Sydney (`syd1`). Neon PostgreSQL is the application system of record and must use the Australian region target when available. Set vendor secrets only in Vercel environment configuration; never place them in source control, preview logs, or browser code.

WorkOS handles authentication and organization identity, Resend handles transactional email, and Vercel AI Gateway handles model routing. The application remains the source of truth for tenant membership, roles, audit events, and regulated records.

## Verification gate

Before Phase 01 is marked complete, run the full command set above plus `git diff --check`. `test:db` is an in-process PGlite test using the actual Drizzle migrator; it does not prove native Neon multi-session contention or pooling behavior. Native Neon RLS, role, and contention verification remain launch gates. Database-backed RLS and rollback checks require a disposable PostgreSQL instance for that native gate. If it is unavailable, report the phase as partially verified.
