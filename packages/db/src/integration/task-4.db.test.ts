import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { verifyAuditChain, type AuditEvent } from "@attesta/domain";
import { createDrizzleFoundationStore } from "../repositories/tenant-repository";
import { createFoundationService } from "../services/foundation-service";
import { auditEvents } from "../schema";
import type { AppDb } from "../client";

const migrationPath = fileURLToPath(new URL("../../migrations/0000_foundation.sql", import.meta.url));
const appRole = "attesta_app";

const bootstrapInput = (suffix: string) => ({
  name: `Synthetic provider ${suffix}`,
  siteName: `Synthetic site ${suffix}`,
  workerName: `Synthetic worker ${suffix}`,
  participantName: `Synthetic participant ${suffix}`,
});

const databases: PGlite[] = [];

async function createDatabase() {
  const pg = new PGlite();
  databases.push(pg);
  await pg.waitReady;
  await pg.exec(await readFile(migrationPath, "utf8"));
  await pg.exec(`
    CREATE ROLE ${appRole} LOGIN;
    GRANT USAGE ON SCHEMA public TO ${appRole};
    GRANT SELECT, INSERT ON tenants, sites, workers, participants, audit_events TO ${appRole};
    GRANT UPDATE, DELETE ON audit_events TO ${appRole};
  `);
  await pg.query(`SET ROLE ${appRole}`);
  const db = drizzlePglite(pg, { schema: { auditEvents } }) as unknown as AppDb;
  return { pg, service: createFoundationService(createDrizzleFoundationStore(db)) };
}

async function rows<T>(pg: PGlite, query: string, params: unknown[] = []): Promise<T[]> {
  const result = await pg.query<T>(query, params);
  return result.rows;
}

async function countRows(pg: PGlite, table: string): Promise<number> {
  const result = await rows<{ count: string }>(pg, `SELECT count(*)::text AS count FROM ${table}`);
  return Number(result[0]?.count ?? 0);
}

function errorMessageChain(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current === "string") {
      messages.push(current);
      break;
    }
    if (typeof current !== "object") break;
    const message = Reflect.get(current, "message");
    if (typeof message === "string") messages.push(message);
    current = Reflect.get(current, "cause");
  }

  return messages.join("\n");
}

async function withTenantContext<T>(pg: PGlite, tenantId: string, operation: () => Promise<T>): Promise<T> {
  await pg.query("BEGIN");
  try {
    await pg.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await operation();
    await pg.query("COMMIT");
    return result;
  } catch (error) {
    await pg.query("ROLLBACK");
    throw error;
  }
}

afterEach(async () => {
  while (databases.length > 0) await databases.pop()?.close();
});

describe("Task 4 live PostgreSQL persistence", () => {
  it("uses a non-bypass application role for database assertions", async () => {
    const { pg } = await createDatabase();
    const role = await rows<{ currentUser: string; bypassRls: boolean }>(
      pg,
      `SELECT current_user AS "currentUser", rolbypassrls AS "bypassRls" FROM pg_roles WHERE rolname = $1`,
      [appRole],
    );

    expect(role).toEqual([{ currentUser: appRole, bypassRls: false }]);
  });

  it("executes the tenant-chain advisory lock inside a transaction", async () => {
    const { pg } = await createDatabase();

    await pg.query("BEGIN");
    try {
      const result = await rows<{ transactionId: string }>(
        pg,
        "SELECT txid_current()::text AS \"transactionId\", pg_advisory_xact_lock(hashtextextended($1, 0)) AS locked",
        ["attesta:synthetic-lock"],
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.transactionId).toEqual(expect.any(String));
    } finally {
      await pg.query("COMMIT");
    }
  });

  it("bootstraps five rows with a valid deterministic audit chain", async () => {
    const { pg, service } = await createDatabase();

    const result = await service.bootstrapTenant(bootstrapInput("one"));
    const counts = await withTenantContext(pg, result.tenant.id, async () => ({
      tenants: await countRows(pg, "tenants"),
      sites: await countRows(pg, "sites"),
      workers: await countRows(pg, "workers"),
      participants: await countRows(pg, "participants"),
      auditEvents: await countRows(pg, "audit_events"),
    }));
    const events = await withTenantContext(pg, result.tenant.id, () => rows<AuditEvent>(
      pg,
      "SELECT previous_hash AS \"previousHash\", payload, event_hash AS \"eventHash\" FROM audit_events ORDER BY created_order ASC",
    ));

    expect(counts).toEqual({ tenants: 1, sites: 1, workers: 1, participants: 1, auditEvents: 4 });
    expect(verifyAuditChain(events)).toEqual({ valid: true, checked: 4, firstInvalidIndex: null });
    await expect(service.verifyTenantAuditChain(result.tenant.id)).resolves.toEqual({ valid: true, checked: 4, firstInvalidIndex: null });
  });

  it("rolls back every domain and audit row when the audit insert is forced to fail", async () => {
    const { pg, service } = await createDatabase();
    await pg.query("RESET ROLE");
    await pg.query(`
      CREATE FUNCTION fail_participant_audit() RETURNS trigger LANGUAGE plpgsql AS $f$
      BEGIN
        IF NEW.entity_type = 'participant' THEN RAISE EXCEPTION 'forced audit insert failure'; END IF;
        RETURN NEW;
      END;
      $f$;
    `);
    await pg.query(`CREATE TRIGGER fail_participant_audit_trigger BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_participant_audit()`);
    await pg.query(`SET ROLE ${appRole}`);

    let bootstrapError: unknown;
    try {
      await service.bootstrapTenant(bootstrapInput("rollback"));
    } catch (error) {
      bootstrapError = error;
    }
    expect(errorMessageChain(bootstrapError)).toContain("forced audit insert failure");

    await pg.query("RESET ROLE");
    await expect(Promise.all(["tenants", "sites", "workers", "participants", "audit_events"].map((table) => countRows(pg, table)))).resolves.toEqual([0, 0, 0, 0, 0]);
  });

  it("isolates a second tenant and rejects cross-tenant writes for a non-bypass role", async () => {
    const { pg, service } = await createDatabase();
    const first = await service.bootstrapTenant(bootstrapInput("first"));
    const second = await service.bootstrapTenant(bootstrapInput("second"));

    const hiddenCounts = await withTenantContext(pg, second.tenant.id, async () => ({
      tenants: await countRows(pg, "tenants"),
      sites: await rows(pg, "SELECT id FROM sites WHERE tenant_id = $1", [first.tenant.id]),
      workers: await rows(pg, "SELECT id FROM workers WHERE tenant_id = $1", [first.tenant.id]),
      participants: await rows(pg, "SELECT id FROM participants WHERE tenant_id = $1", [first.tenant.id]),
      auditEvents: await rows(pg, "SELECT id FROM audit_events WHERE tenant_id = $1", [first.tenant.id]),
    }));

    expect(hiddenCounts.tenants).toBe(1);
    expect(hiddenCounts.sites).toHaveLength(0);
    expect(hiddenCounts.workers).toHaveLength(0);
    expect(hiddenCounts.participants).toHaveLength(0);
    expect(hiddenCounts.auditEvents).toHaveLength(0);

    await expect(withTenantContext(pg, first.tenant.id, () => pg.query(
      "INSERT INTO sites (tenant_id, name) VALUES ($1, 'cross-tenant write')",
      [second.tenant.id],
    ))).rejects.toThrow();

    expect((await rows<{ value: string }>(pg, "SELECT current_setting('app.tenant_id', true) AS value"))[0]?.value).toBe("");
  });

  it("returns no rows after transaction-local tenant context is cleared", async () => {
    const { pg, service } = await createDatabase();
    const result = await service.bootstrapTenant(bootstrapInput("cleared-context"));

    await pg.query("BEGIN");
    await pg.query("SELECT set_config('app.tenant_id', $1, true)", [result.tenant.id]);
    await pg.query("COMMIT");

    await expect(
      Promise.all(["tenants", "sites", "workers", "participants", "audit_events"].map((table) => countRows(pg, table))),
    ).resolves.toEqual([0, 0, 0, 0, 0]);
  });

  it("rejects audit UPDATE and DELETE at the database layer", async () => {
    const { pg, service } = await createDatabase();
    const result = await service.bootstrapTenant(bootstrapInput("append-only"));
    const [event] = await withTenantContext(pg, result.tenant.id, () => rows<{ id: string }>(pg, "SELECT id FROM audit_events ORDER BY created_order ASC LIMIT 1"));

    await expect(withTenantContext(pg, result.tenant.id, () => pg.query("UPDATE audit_events SET action = 'tampered' WHERE id = $1", [event?.id]))).rejects.toThrow(/append-only/);
    await expect(withTenantContext(pg, result.tenant.id, () => pg.query("DELETE FROM audit_events WHERE id = $1", [event?.id]))).rejects.toThrow(/append-only/);
  });
});
