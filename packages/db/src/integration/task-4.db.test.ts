import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { verifyAuditChain, type AuditEvent } from "@attesta/domain";
import { createDrizzleFoundationStore } from "../repositories/tenant-repository";
import { createFoundationService } from "../services/foundation-service";
import { auditEvents } from "../schema";
import type { AppDb } from "../client";

const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));
const appRole = "attesta_app";
const runtimeRole = "attesta_runtime";

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
  const pgliteDb = drizzlePglite(pg, { schema: { auditEvents } });
  await migrate(pgliteDb, { migrationsFolder });
  await pg.exec(`
    CREATE ROLE ${appRole} NOLOGIN NOBYPASSRLS;
    CREATE ROLE ${runtimeRole} LOGIN NOBYPASSRLS;
    GRANT ${appRole} TO ${runtimeRole};
    GRANT USAGE ON SCHEMA public TO ${appRole};
    GRANT SELECT, INSERT ON tenants, sites, workers, participants, audit_events TO ${appRole};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${appRole};
  `);
  await pg.query(`SET ROLE ${runtimeRole}`);
  const db = pgliteDb as unknown as AppDb;
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
  it("uses a non-bypass runtime login granted the least-privilege application role", async () => {
    const { pg } = await createDatabase();
    const role = await rows<{ currentUser: string; login: boolean; bypassRls: boolean }>(
      pg,
      `SELECT current_user AS "currentUser", rolcanlogin AS login, rolbypassrls AS "bypassRls"
       FROM pg_roles
       WHERE rolname = $1`,
      [runtimeRole],
    );

    expect(role).toEqual([{ currentUser: runtimeRole, login: true, bypassRls: false }]);
    await expect(rows<{ member: string; parent: string }>(
      pg,
      `SELECT member.rolname AS member, parent.rolname AS parent
       FROM pg_auth_members
       JOIN pg_roles member ON member.oid = pg_auth_members.member
       JOIN pg_roles parent ON parent.oid = pg_auth_members.roleid
       WHERE member.rolname = $1 AND parent.rolname = $2`,
      [runtimeRole, appRole],
    )).resolves.toEqual([{ member: runtimeRole, parent: appRole }]);
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
      `SELECT id,
              previous_hash AS "previousHash",
              tenant_id AS "tenantId",
              actor_reference AS "actorReference",
              action,
              entity_type AS "entityType",
              entity_id AS "entityId",
              payload,
              payload_hash AS "payloadHash",
              retention_until::text AS "retentionUntil",
              created_at::text AS "createdAt",
              created_order::int AS "createdOrder",
              event_hash AS "eventHash"
       FROM audit_events ORDER BY created_order ASC`,
    ));
    const canonicalEvents = events.map((event) => ({
      ...event,
      retentionUntil: new Date(event.retentionUntil).toISOString(),
      createdAt: new Date(event.createdAt).toISOString(),
    }));

    expect(counts).toEqual({ tenants: 1, sites: 1, workers: 1, participants: 1, auditEvents: 4 });
    expect(verifyAuditChain(canonicalEvents)).toEqual({ valid: true, checked: 4, firstInvalidIndex: null });
    expect(events.map((event) => event.createdOrder)).toEqual(result.auditEvents.map((event) => event.createdOrder));
    await expect(service.verifyTenantAuditChain(result.tenant.id)).resolves.toEqual({ valid: true, checked: 4, firstInvalidIndex: null });
  });

  it("allocates globally unique audit order values across tenants", async () => {
    const { pg, service } = await createDatabase();
    const first = await service.bootstrapTenant(bootstrapInput("sequence-first"));
    const second = await service.bootstrapTenant(bootstrapInput("sequence-second"));

    const firstOrders = await withTenantContext(pg, first.tenant.id, () => rows<{ createdOrder: number }>(
      pg,
      "SELECT created_order::int AS \"createdOrder\" FROM audit_events ORDER BY created_order",
    ));
    const secondOrders = await withTenantContext(pg, second.tenant.id, () => rows<{ createdOrder: number }>(
      pg,
      "SELECT created_order::int AS \"createdOrder\" FROM audit_events ORDER BY created_order",
    ));
    const allOrders = [...firstOrders, ...secondOrders].map(({ createdOrder }) => createdOrder);

    expect(allOrders).toHaveLength(8);
    expect(new Set(allOrders).size).toBe(8);
    expect(firstOrders.every(({ createdOrder }) => !secondOrders.some((row) => row.createdOrder === createdOrder))).toBe(true);
  });

  it("keeps a valid chain across a sequence gap consumed by a rolled-back append", async () => {
    const { pg, service } = await createDatabase();
    const bootstrap = await service.bootstrapTenant(bootstrapInput("sequence-gap"));
    const beforeFailure = bootstrap.auditEvents.at(-1);

    await pg.query("RESET ROLE");
    await pg.query(`
      CREATE FUNCTION fail_forced_audit() RETURNS trigger LANGUAGE plpgsql AS $f$
      BEGIN
        IF NEW.action = 'forced-failure' THEN RAISE EXCEPTION 'forced sequence-consuming failure'; END IF;
        RETURN NEW;
      END;
      $f$;
    `);
    await pg.query("CREATE TRIGGER fail_forced_audit_trigger BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_forced_audit()");
    await pg.query(`SET ROLE ${runtimeRole}`);

    let appendError: unknown;
    try {
      await service.appendAuditEvent({
        tenantId: bootstrap.tenant.id,
        actorReference: "system",
        action: "forced-failure",
        entityType: "tenant",
        entityId: bootstrap.tenant.id,
        payload: { synthetic: true },
      });
    } catch (error) {
      appendError = error;
    }
    expect(errorMessageChain(appendError)).toContain("forced sequence-consuming failure");

    await pg.query("RESET ROLE");
    await pg.query("DROP TRIGGER fail_forced_audit_trigger ON audit_events");
    await pg.query("DROP FUNCTION fail_forced_audit()");
    await pg.query(`SET ROLE ${runtimeRole}`);

    const committed = await service.appendAuditEvent({
      tenantId: bootstrap.tenant.id,
      actorReference: "system",
      action: "after-failure",
      entityType: "tenant",
      entityId: bootstrap.tenant.id,
      payload: { synthetic: true },
    });

    expect(beforeFailure).toBeDefined();
    expect(committed.createdOrder).toBe((beforeFailure?.createdOrder ?? 0) + 2);
    await expect(service.verifyTenantAuditChain(bootstrap.tenant.id)).resolves.toEqual({
      valid: true,
      checked: 5,
      firstInvalidIndex: null,
    });
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

    // The runtime role has no UPDATE/DELETE grants; reset to the PGlite owner to exercise the trigger itself.
    await pg.query("RESET ROLE");
    await expect(withTenantContext(pg, result.tenant.id, () => pg.query("UPDATE audit_events SET action = 'tampered' WHERE id = $1", [event?.id]))).rejects.toThrow(/append-only/);
    await expect(withTenantContext(pg, result.tenant.id, () => pg.query("DELETE FROM audit_events WHERE id = $1", [event?.id]))).rejects.toThrow(/append-only/);
  });
});
