import { describe, expect, it, expectTypeOf } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { FoundationTransaction } from "../services/foundation-service";
import { auditEvents } from "../schema";
import { createDrizzleFoundationStore } from "./tenant-repository";
import { createAuditEventInput, type AuditEventInput } from "./audit-repository";

describe("audit repository input", () => {
  it("keeps chain links and computed hashes out of the public append input", () => {
    expectTypeOf<AuditEventInput>().not.toHaveProperty("previousHash");
    expectTypeOf<AuditEventInput>().not.toHaveProperty("eventHash");
    expectTypeOf<FoundationTransaction>().not.toHaveProperty("updateAuditEvent");
    expectTypeOf<FoundationTransaction>().not.toHaveProperty("deleteAuditEvent");
  });

  it("creates a canonical payload and hash-chain input", () => {
    const input = createAuditEventInput({
      tenantId: "tenant-1",
      actorReference: "system",
      action: "create",
      entityType: "tenant",
      entityId: "tenant-1",
      payload: { name: "Example SIL" },
      previousHash: null,
    });

    expect(input.payload).toBe('{"name":"Example SIL"}');
    expect(input.payloadHash).toHaveLength(64);
    expect(input.eventHash).toHaveLength(64);
    expect(input.previousHash).toBeNull();
  });

  it("locks the tenant chain before reading its head and inserting", async () => {
    const calls: string[] = [];
    const dialect = new PgDialect();
    const db = {
      async transaction<T>(operation: (tx: unknown) => Promise<T>): Promise<T> {
        const tx = {
          async execute(query: Parameters<PgDialect["sqlToQuery"]>[0]) {
            calls.push(dialect.sqlToQuery(query).sql.includes("pg_advisory_xact_lock") ? "lock" : "execute");
          },
          select() {
            return {
              from() {
                return {
                  where() {
                    return {
                      orderBy() {
                        return {
                          async limit() {
                            calls.push("head");
                            return [{ eventHash: "stored-head" }];
                          },
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
                expect(table).toBe(auditEvents);
                expect(values.previousHash).toBe("stored-head");
                return {
                  async returning() {
                    calls.push("insert");
                    return [{
                      id: "00000000-0000-4000-8000-000000000010",
                      createdOrder: 2,
                      createdAt: new Date(),
                      ...values,
                    }];
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
    await store.transaction((tx) => tx.appendAuditEvent({
      tenantId: "00000000-0000-4000-8000-000000000001",
      actorReference: "system",
      action: "note",
      entityType: "tenant",
      entityId: null,
      payload: { message: "event" },
    }));

    expect(calls).toEqual(["lock", "head", "insert"]);
  });
});
