import { describe, expect, it } from "vitest";
import type { SQL } from "drizzle-orm";
import { assertTenantId, withTenant, type TenantTransaction } from "./tenant-context";

describe("tenant context", () => {
  it("accepts a UUID tenant identifier", () => {
    expect(assertTenantId("00000000-0000-4000-8000-000000000001")).toBe(
      "00000000-0000-4000-8000-000000000001",
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

    const db = {
      async transaction<T>(operation: (tx: TenantTransaction) => Promise<T>): Promise<T> {
        transactionCount += 1;
        const tx = {
          async execute(_query: SQL) {
            executeCount += 1;
            context = tenantId;
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
    expect(contextDuringOperation).toBe(tenantId);
    expect(operationTransaction).toBeDefined();
    expect(operationTransaction).not.toBe(db);
    expect(context).toBeNull();
  });
});
