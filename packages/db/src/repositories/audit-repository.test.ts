import { describe, expect, it, expectTypeOf } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { computeAuditEventHash, type AuditEnvelope } from "@attesta/domain";
import type { FoundationTransaction } from "../services/foundation-service";
import { auditEvents } from "../schema";
import { createDrizzleFoundationStore } from "./tenant-repository";
import { createAuditEventInput, type AuditEventInput } from "./audit-repository";

describe("audit repository input", () => {
  it("keeps chain links and computed hashes out of the public append input", () => {
    expectTypeOf<AuditEventInput>().not.toHaveProperty("previousHash");
    expectTypeOf<AuditEventInput>().not.toHaveProperty("eventHash");
    expectTypeOf<AuditEventInput>().not.toHaveProperty("retentionUntil");
    expectTypeOf<AuditEventInput>().not.toHaveProperty("createdAt");
    expectTypeOf<AuditEventInput>().not.toHaveProperty("createdOrder");
    expectTypeOf<AuditEventInput>().not.toHaveProperty("id");
    expectTypeOf<FoundationTransaction>().not.toHaveProperty("updateAuditEvent");
    expectTypeOf<FoundationTransaction>().not.toHaveProperty("deleteAuditEvent");
  });

  it("creates a canonical payload and hash-chain input", () => {
    const createdAt = new Date("2026-08-28T14:35:27.123Z");
    const input = createAuditEventInput({
      tenantId: "tenant-1",
      actorReference: "system",
      action: "create",
      entityType: "tenant",
      entityId: "tenant-1",
      payload: { name: "Example SIL" },
      previousHash: null,
    }, { id: "audit-1", createdAt, createdOrder: 7 });

    expect(input.payload).toBe('{"name":"Example SIL"}');
    expect(input.payloadHash).toHaveLength(64);
    expect(input.eventHash).toHaveLength(64);
    expect(input.previousHash).toBeNull();
    expect(input.id).toBe("audit-1");
    expect(input.createdAt).toEqual(createdAt);
    expect(input.createdOrder).toBe(7);
    expect(input.retentionUntil).toEqual(new Date("2033-08-28T14:35:27.123Z"));
    const envelope: AuditEnvelope = {
      id: input.id,
      previousHash: input.previousHash,
      tenantId: input.tenantId,
      actorReference: input.actorReference,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
      payloadHash: input.payloadHash,
      retentionUntil: input.retentionUntil.toISOString(),
      createdAt: input.createdAt.toISOString(),
      createdOrder: input.createdOrder,
    };
    expect(input.eventHash).toBe(computeAuditEventHash(envelope));
  });

  it("locks the tenant chain before reading its head and inserting", async () => {
    const calls: string[] = [];
    let lockKey: unknown;
    let headTenantId: unknown;
    const dialect = new PgDialect();
    const db = {
      async transaction<T>(operation: (tx: unknown) => Promise<T>): Promise<T> {
        const tx = {
          async execute(query: Parameters<PgDialect["sqlToQuery"]>[0]) {
            const generated = dialect.sqlToQuery(query);
            if (generated.sql.includes("pg_advisory_xact_lock")) {
              lockKey = generated.params[0];
              calls.push("lock");
            } else if (generated.sql.includes("nextval")) {
              calls.push("order");
              return { rows: [{ created_order: 2 }] };
            } else {
              calls.push("execute");
            }
          },
          select() {
            return {
              from() {
                return {
                  where(predicate: Parameters<PgDialect["sqlToQuery"]>[0]) {
                    headTenantId = dialect.sqlToQuery(predicate).params[0];
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
      tenantId: "00000000-0000-4000-8000-00000000000A",
      actorReference: "system",
      action: "note",
      entityType: "tenant",
      entityId: null,
      payload: { message: "event" },
    }));

    expect(calls).toEqual(["lock", "head", "order", "insert"]);
    expect(lockKey).toBe("attesta:audit-chain:00000000-0000-4000-8000-00000000000a");
    expect(headTenantId).toBe("00000000-0000-4000-8000-00000000000a");
  });
});
