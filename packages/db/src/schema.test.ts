import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { auditEvents, participants, sites, tenants, workers } from "./schema";

describe("foundation schema", () => {
  it("exposes every required foundation table", () => {
    expect(tenants).toBeDefined();
    expect(sites).toBeDefined();
    expect(workers).toBeDefined();
    expect(participants).toBeDefined();
    expect(auditEvents).toBeDefined();
  });

  it("defines tenant ownership on every tenant-owned table", () => {
    for (const table of [sites, workers, participants, auditEvents]) {
      expect("tenantId" in table).toBe(true);
    }
  });

  it("defines tenant indexes in the schema metadata", () => {
    expect(getTableConfig(sites).indexes.map((index) => index.config.name)).toContain("sites_tenant_id_idx");
    expect(getTableConfig(workers).indexes.map((index) => index.config.name)).toContain("workers_tenant_id_idx");
    expect(getTableConfig(participants).indexes.map((index) => index.config.name)).toContain("participants_tenant_id_idx");
    expect(getTableConfig(auditEvents).indexes.map((index) => index.config.name)).toContain(
      "audit_events_tenant_id_created_at_idx",
    );
  });

  it("constrains status and preferred communication values to known values", () => {
    expect(getTableConfig(sites).checks).toHaveLength(1);
    expect(getTableConfig(workers).checks).toHaveLength(1);
    expect(getTableConfig(participants).checks).toHaveLength(2);
  });
});
