import { describe, expect, it } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { assertTenantId, withTenant, type TenantTransaction } from "./tenant-context";

describe("tenant context", () => {
  it("accepts a UUID tenant identifier", () => {
    expect(assertTenantId("00000000-0000-4000-8000-000000000001")).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("normalizes UUID spelling at the tenant boundary", () => {
    expect(assertTenantId("00000000-0000-4000-8000-00000000000A")).toBe(
      "00000000-0000-4000-8000-00000000000a",
    );
  });

  it("rejects a malformed tenant identifier before database access", async () => {
    let transactionCalled = false;
    const db = {
      transaction: async () => {
        transactionCalled = true;
        throw new Error("database access should not occur");
      },
    };

    expect(() => assertTenantId("not-a-tenant")).toThrow("Invalid tenant ID");
    expect(() => withTenant(db, "not-a-tenant", async () => "unreachable")).toThrow("Invalid tenant ID");
    expect(transactionCalled).toBe(false);
  });

  it("sets transaction-local context before the operation and clears it after commit", async () => {
    const tenantId = "00000000-0000-4000-8000-000000000001";
    let context: string | null = null;
    let transactionCount = 0;
    let executeCount = 0;
    let operationTransaction: TenantTransaction | undefined;
    let contextDuringOperation: string | null = null;
    const executedQueries: { sql: string; params: unknown[] }[] = [];

    const db = {
      async transaction<T>(operation: (tx: TenantTransaction) => Promise<T>): Promise<T> {
        transactionCount += 1;
        const tx = {
          async execute(query: SQL) {
            executeCount += 1;
            const generated = new PgDialect().sqlToQuery(query);
            executedQueries.push(generated);
            if (generated.sql === "select set_config('app.tenant_id', $1, true)" && generated.params[0] === tenantId) {
              context = tenantId;
            }
          },
        } satisfies TenantTransaction;

        try {
          return await operation(tx);
        } finally {
          context = null;
        }
      },
    };

    const result = await withTenant(db, tenantId, async (tx) => {
      operationTransaction = tx;
      contextDuringOperation = context;
      return "inside transaction";
    });

    expect(result).toBe("inside transaction");
    expect(transactionCount).toBe(1);
    expect(executeCount).toBe(1);
    expect(executedQueries).toEqual([
      { sql: "select set_config('app.tenant_id', $1, true)", params: [tenantId], typings: ["none"] },
    ]);
    expect(contextDuringOperation).toBe(tenantId);
    expect(operationTransaction).toBeDefined();
    expect(operationTransaction).not.toBe(db);
    expect(context).toBeNull();
  });
});
