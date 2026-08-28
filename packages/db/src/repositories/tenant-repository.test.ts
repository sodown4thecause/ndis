import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { auditEvents, participants, tenants, workers } from "../schema";
import { createDrizzleFoundationStore, createTenantRepository } from "./tenant-repository";

const tenantId = "00000000-0000-4000-8000-000000000001";

describe("tenant repository", () => {
  it("exposes tenant-scoped tenant and people reads", async () => {
    const transactions: unknown[] = [];
    const executedQueries: { sql: string; params: unknown[] }[] = [];
    const predicates: { sql: string; params: unknown[]; context: string | null }[] = [];
    let context: string | null = null;
    const db = {
      async transaction<T>(operation: (tx: unknown) => Promise<T>): Promise<T> {
        const tx = {
          async execute(query: Parameters<PgDialect["sqlToQuery"]>[0]) {
            const generated = new PgDialect().sqlToQuery(query);
            executedQueries.push(generated);
            if (generated.sql === "select set_config('app.tenant_id', $1, true)") context = String(generated.params[0]);
          },
          select() {
            return {
              from(table: unknown) {
                return {
                  where(predicate: Parameters<PgDialect["sqlToQuery"]>[0]) {
                    const generated = new PgDialect().sqlToQuery(predicate);
                    predicates.push({ ...generated, context });
                    if (table === tenants) return Promise.resolve([{ id: tenantId, name: "Example SIL" }]);
                    if (table === workers) {
                      return Promise.resolve([
                        { id: "00000000-0000-4000-8000-000000000002", tenantId, siteId: "00000000-0000-4000-8000-000000000003", name: "Worker One", status: "active" },
                      ]);
                    }
                    if (table === participants) {
                      return Promise.resolve([
                        { id: "00000000-0000-4000-8000-000000000004", tenantId, siteId: "00000000-0000-4000-8000-000000000003", name: "Participant One", status: "active", preferredFormat: "plain-language" },
                      ]);
                    }
                    if (table === auditEvents) return Promise.resolve([]);
                    return Promise.resolve([]);
                  },
                };
              },
            };
          },
        };
        transactions.push(tx);
        return operation(tx);
      },
    };

    const repository = createTenantRepository(db as Parameters<typeof createTenantRepository>[0]);

    await expect(repository.getTenant(tenantId)).resolves.toEqual({ id: tenantId, name: "Example SIL" });
    await expect(repository.listTenantPeople(tenantId)).resolves.toEqual([
      {
        id: "00000000-0000-4000-8000-000000000002",
        tenantId,
        siteId: "00000000-0000-4000-8000-000000000003",
        name: "Worker One",
        status: "active",
        kind: "worker",
        preferredFormat: null,
      },
      {
        id: "00000000-0000-4000-8000-000000000004",
        tenantId,
        siteId: "00000000-0000-4000-8000-000000000003",
        name: "Participant One",
        status: "active",
        kind: "participant",
        preferredFormat: "plain-language",
      },
    ]);
    expect(transactions).toHaveLength(2);
    expect(executedQueries).toHaveLength(2);
    expect(predicates).toHaveLength(3);
    expect(predicates.every((predicate) => predicate.context === tenantId)).toBe(true);
    expect(predicates.every((predicate) => predicate.params[0] === tenantId)).toBe(true);
    expect(predicates.map((predicate) => predicate.sql)).toEqual([
      '"tenants"."id" = $1',
      '"workers"."tenant_id" = $1',
      '"participants"."tenant_id" = $1',
    ]);
  });

  it("creates an audited bootstrap through the FoundationStore path", async () => {
    const ids = {
      tenant: "00000000-0000-4000-8000-000000000011",
      site: "00000000-0000-4000-8000-000000000012",
      worker: "00000000-0000-4000-8000-000000000013",
      participant: "00000000-0000-4000-8000-000000000014",
    };
    const insertedTables: unknown[] = [];
    const db = {
      async transaction<T>(operation: (tx: unknown) => Promise<T>): Promise<T> {
        const tx = {
          async execute() {},
          select() {
            return {
              from() {
                return {
                  where() {
                    return {
                      orderBy() {
                        return {
                          limit: async () => [],
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          insert(table: unknown) {
            return {
              values(values: Record<string, unknown>) {
                insertedTables.push(table);
                return {
                  async returning() {
                    if (table === tenants) return [{ id: ids.tenant, name: values.name }];
                    if (table === auditEvents) return [{ id: `audit-${insertedTables.length}`, ...values }];
                    if (table === workers) return [{ id: ids.worker, tenantId: values.tenantId, siteId: values.siteId, name: values.name }];
                    if (table === participants) return [{ id: ids.participant, tenantId: values.tenantId, siteId: values.siteId, name: values.name, preferredFormat: values.preferredFormat }];
                    return [{ id: ids.site, tenantId: values.tenantId, name: values.name }];
                  },
                };
              },
            };
          },
        };
        return operation(tx);
      },
    };

    const repository = createTenantRepository(db as Parameters<typeof createTenantRepository>[0]);
    const result = await repository.createTenantBootstrap({
      name: "Example SIL",
      siteName: "House 1",
      workerName: "Worker One",
      participantName: "Participant One",
    });

    expect(result.tenant.id).toBe(ids.tenant);
    expect(result.auditEvents).toHaveLength(4);
    expect(insertedTables.filter((table) => table === auditEvents)).toHaveLength(4);
  });

  it("orders listed audit events by created_order ascending", async () => {
    const dialect = new PgDialect();
    const orderByQueries: { sql: string; params: unknown[] }[] = [];
    const expectedEvents = [
      { id: "audit-1", createdOrder: 1 },
      { id: "audit-2", createdOrder: 2 },
    ];
    const db = {
      async transaction<T>(operation: (tx: unknown) => Promise<T>): Promise<T> {
        const tx = {
          select() {
            return {
              from() {
                return {
                  where() {
                    return {
                      async orderBy(order: Parameters<PgDialect["sqlToQuery"]>[0]) {
                        orderByQueries.push(dialect.sqlToQuery(order));
                        return expectedEvents;
                      },
                    };
                  },
                };
              },
            };
          },
        };
        return operation(tx);
      },
    };

    const store = createDrizzleFoundationStore(db as Parameters<typeof createDrizzleFoundationStore>[0]);
    await expect(store.transaction((tx) => tx.listAuditEvents(tenantId))).resolves.toEqual(expectedEvents);
    expect(orderByQueries).toEqual([{ sql: '"audit_events"."created_order" asc', params: [] }]);
  });
});
