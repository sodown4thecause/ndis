import { describe, expect, it } from "vitest";
import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import { auditEvents, participants, sites, tenants, workers } from "./schema";

const dialect = new PgDialect();

function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

function constraintSql(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).checks.map((check) => dialect.sqlToQuery(check.value).sql);
}

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

  it("exposes the required columns with stable database names", () => {
    expect(columnNames(tenants)).toEqual(["id", "name", "created_at"]);
    expect(columnNames(sites)).toEqual(["id", "tenant_id", "name", "status", "created_at"]);
    expect(columnNames(workers)).toEqual(["id", "tenant_id", "site_id", "name", "status", "created_at"]);
    expect(columnNames(participants)).toEqual([
      "id",
      "tenant_id",
      "site_id",
      "name",
      "preferred_format",
      "status",
      "created_at",
    ]);
    expect(columnNames(auditEvents)).toEqual([
      "id",
      "created_order",
      "tenant_id",
      "actor_reference",
      "action",
      "entity_type",
      "entity_id",
      "payload",
      "payload_hash",
      "previous_hash",
      "event_hash",
      "created_at",
      "retention_until",
    ]);
  });

  it("defines tenant indexes in the schema metadata", () => {
    expect(getTableConfig(sites).indexes.map((index) => index.config.name)).toContain("sites_tenant_id_idx");
    expect(getTableConfig(workers).indexes.map((index) => index.config.name)).toContain("workers_tenant_id_idx");
    expect(getTableConfig(participants).indexes.map((index) => index.config.name)).toContain("participants_tenant_id_idx");
    expect(getTableConfig(auditEvents).indexes.map((index) => index.config.name)).toContain(
      "audit_events_tenant_id_created_at_idx",
    );
    expect(getTableConfig(auditEvents).indexes.map((index) => index.config.name)).toContain(
      "audit_events_tenant_id_created_order_idx",
    );
  });

  it("constrains status and preferred communication values to known values", () => {
    expect(constraintSql(sites)).toEqual([`\"sites\".\"status\" in ('active', 'inactive', 'archived')`]);
    expect(constraintSql(workers)).toEqual([`\"workers\".\"status\" in ('active', 'inactive', 'archived')`]);
    expect(constraintSql(participants)).toEqual([
      `\"participants\".\"preferred_format\" in ('plain-language', 'easy-read', 'audio')`,
      `\"participants\".\"status\" in ('active', 'inactive', 'archived')`,
    ]);
  });

  it("requires worker and participant sites to belong to the same tenant", () => {
    expect(getTableConfig(sites).uniqueConstraints.map((constraint) => constraint.getName())).toContain(
      "sites_tenant_id_id_unique",
    );

    for (const table of [workers, participants]) {
      const compositeForeignKey = getTableConfig(table).foreignKeys.find(
        (foreignKey) => foreignKey.getName() === `${table === workers ? "workers" : "participants"}_tenant_site_fk`,
      );
      expect(compositeForeignKey).toBeDefined();
      expect(compositeForeignKey?.reference().columns.map((column) => column.name)).toEqual(["tenant_id", "site_id"]);
      expect(compositeForeignKey?.reference().foreignColumns.map((column) => column.name)).toEqual(["tenant_id", "id"]);
    }
  });
});
