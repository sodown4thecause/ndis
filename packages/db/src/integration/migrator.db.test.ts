import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, it } from "vitest";

const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));
const foundationTables = ["audit_events", "participants", "sites", "tenants", "workers"];
const databases: PGlite[] = [];

async function rows<T>(pg: PGlite, query: string, params: unknown[] = []): Promise<T[]> {
  const result = await pg.query<T>(query, params);
  return result.rows;
}

afterEach(async () => {
  while (databases.length > 0) await databases.pop()?.close();
});

describe("Drizzle foundation migration", () => {
  it("creates the foundation schema through the actual PGlite migrator", async () => {
    const pg = new PGlite();
    databases.push(pg);
    await pg.waitReady;

    const db = drizzlePglite(pg);
    await migrate(db, { migrationsFolder });

    const tables = await rows<{ tableName: string }>(
      pg,
      `SELECT tablename AS "tableName"
       FROM pg_catalog.pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1)
       ORDER BY tablename`,
      [foundationTables],
    );
    expect(tables.map(({ tableName }) => tableName)).toEqual(foundationTables);

    const rls = await rows<{ tableName: string; rlsEnabled: boolean; rlsForced: boolean }>(
      pg,
      `SELECT c.relname AS "tableName",
              c.relrowsecurity AS "rlsEnabled",
              c.relforcerowsecurity AS "rlsForced"
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1)
       ORDER BY c.relname`,
      [foundationTables],
    );
    expect(rls).toEqual(foundationTables.map((tableName) => ({ tableName, rlsEnabled: true, rlsForced: true })));

    const policies = await rows<{ tableName: string; policyName: string }>(
      pg,
      `SELECT tablename AS "tableName", policyname AS "policyName"
       FROM pg_catalog.pg_policies
       WHERE schemaname = 'public'
       ORDER BY tablename, policyname`,
    );
    expect(policies).toEqual(foundationTables.map((tableName) => ({
      tableName,
      policyName: `${tableName}_tenant_isolation`,
    })));

    const triggerEvents = await rows<{ event: string }>(
      pg,
      `SELECT event_manipulation AS event
       FROM information_schema.triggers
       WHERE trigger_schema = 'public'
         AND event_object_table = 'audit_events'
         AND trigger_name = 'audit_events_append_only'
       ORDER BY event_manipulation`,
    );
    expect(triggerEvents).toEqual([{ event: "DELETE" }, { event: "UPDATE" }]);

    const identity = await rows<{ generation: string | null }>(
      pg,
      `SELECT identity_generation AS generation
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'audit_events' AND column_name = 'created_order'`,
    );
    expect(identity).toEqual([{ generation: "BY DEFAULT" }]);
  });
});
