# Database setup

Attesta uses Neon PostgreSQL in deployed environments. The database is the system of record for tenant-owned data and audit events.

For local setup, use a disposable PostgreSQL database or the in-process PGlite test harness:

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to the application runtime connection and `DATABASE_MIGRATION_URL` to a separate migration-owner connection. Do not put either credential in source control.
3. Run `pnpm --filter @attesta/db db:migrate` to apply the checked-in Drizzle migrations.
4. Run `pnpm --filter @attesta/db db:check` to verify the migration files are in sync.
5. Run `pnpm --filter @attesta/db test:db` for actual-migrator and database-backed tests.

`DATABASE_MIGRATION_URL` is read by `drizzle.config.ts` for `db:migrate`, `db:generate`, and related Drizzle Kit commands. `DATABASE_URL` is read by the application client at runtime. The migration owner must not be used by application requests.

## Least-privilege runtime role

Provision roles out of band on the target PostgreSQL/Neon database. The example contains no password or credential:

```sql
CREATE ROLE attesta_app NOLOGIN NOBYPASSRLS;
CREATE ROLE attesta_runtime LOGIN NOBYPASSRLS;
GRANT attesta_app TO attesta_runtime;

GRANT USAGE ON SCHEMA public TO attesta_app;
GRANT SELECT, INSERT ON tenants, sites, workers, participants, audit_events TO attesta_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO attesta_app;
REVOKE UPDATE, DELETE ON audit_events FROM attesta_app;
```

Provision the `attesta_runtime` login's authentication through the deployment/provider secret store, not source control. `attesta_app` is the non-login group role carrying the explicit grants; both roles have `NOBYPASSRLS`. The migration-owner connection remains separately provisioned and is used only to run migrations.

The foundation migration enables and forces RLS on all five tenant-owned tables. Each policy reads the transaction-local `app.tenant_id`; application transactions must set that context before accessing tenant data. The audit table also has a database trigger that rejects `UPDATE` and `DELETE`. Runtime permissions deny those operations before the trigger, while the migration regression test verifies the trigger exists.

`test:db` runs in-process PGlite and invokes the actual Drizzle PGlite migrator against `packages/db/migrations`. It verifies schema objects, RLS metadata, policies, and the append-only trigger, but it does not prove native Neon multi-session contention, pooling behavior, or production role provisioning. Native Neon verification remains a launch gate.

Never use participant, worker, audio, or evidence data in local development or preview environments.
