import { afterEach, describe, expect, it } from "vitest";
import { createDefaultPostHandler } from "./route";
import { createMigratedFoundationDatabase } from "../../../../../packages/db/src/integration/route-test-support";

const databases: Array<{ pg: { close(): Promise<void> } }> = [];
const environment = process.env as unknown as Record<string, string | undefined>;

afterEach(async () => {
  while (databases.length > 0) await databases.pop()?.pg.close();
  delete process.env.ENABLE_SYNTHETIC_BOOTSTRAP;
  environment.NODE_ENV = "test";
});

describe("POST /api/tenants against a migrated disposable database", () => {
  it("passes a real Request through the route, service, migrated database, and serialized Response", async () => {
    environment.NODE_ENV = "test";
    process.env.ENABLE_SYNTHETIC_BOOTSTRAP = "true";
    const database = await createMigratedFoundationDatabase();
    databases.push(database);

    const response = await createDefaultPostHandler({
      getDatabaseUrl: () => "pglite://route-test",
      createDb: () => ({ close: async () => undefined }),
      createService: () => database.service,
    })(new Request("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "Route Test SIL",
        siteName: "Route Test House",
        workerName: "Route Test Worker",
        participantName: "Route Test Participant",
      }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(201);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      tenant: { name: "Route Test SIL" },
      site: { name: "Route Test House" },
      worker: { name: "Route Test Worker" },
      participant: { name: "Route Test Participant" },
    });
    expect(body).not.toHaveProperty("auditEvents");
    expect(body).not.toHaveProperty("tenant.tenantId");

    await database.pg.query("RESET ROLE");
    const counts = await Promise.all(["tenants", "sites", "workers", "participants", "audit_events"].map(async (table) => {
      const result = await database.pg.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`);
      return Number(result.rows[0]?.count ?? 0);
    }));
    expect(counts).toEqual([1, 1, 1, 1, 4]);
  });
});
