# Database setup

Attesta uses Neon PostgreSQL in deployed environments and PostgreSQL locally. The database is the system of record for tenant-owned data and audit events.

1. Create a disposable Neon branch or PostgreSQL database for local development.
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` locally.
3. Run `pnpm --filter @attesta/db db:migrate` to apply the checked-in Drizzle migrations.
4. Run `pnpm --filter @attesta/db db:check` to verify the migration files are in sync.
5. Run `pnpm --filter @attesta/db test:db` for database-backed tests.

Never use participant, worker, audio, or evidence data in local development or preview environments.
