import { describe, expect, it } from "vitest";
import { createTenantRepository } from "./tenant-repository";

const tenantId = "00000000-0000-4000-8000-000000000001";

describe("tenant repository", () => {
  it("exposes tenant-scoped tenant and people reads", async () => {
    const transactions: unknown[] = [];
    const db = {
      async transaction<T>(operation: (tx: unknown) => Promise<T>): Promise<T> {
        const tx = {
          async execute() {},
          select() {
            return {
              from() {
                return {
                  where() {
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

    await expect(repository.getTenant(tenantId)).resolves.toBeNull();
    await expect(repository.listTenantPeople(tenantId)).resolves.toEqual([]);
    expect(transactions).toHaveLength(2);
  });
});
