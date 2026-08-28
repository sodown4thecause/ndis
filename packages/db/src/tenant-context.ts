import { sql, type SQL } from "drizzle-orm";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TenantTransaction = {
  execute(query: SQL): Promise<unknown>;
};

export type TenantDb<TTransaction extends TenantTransaction = TenantTransaction> = {
  transaction<T>(callback: (tx: TTransaction) => Promise<T>): Promise<T>;
};

export function assertTenantId(tenantId: string): string {
  if (!UUID_PATTERN.test(tenantId)) throw new Error("Invalid tenant ID");
  return tenantId;
}

export function withTenant<T, TTransaction extends TenantTransaction>(
  db: TenantDb<TTransaction>,
  tenantId: string,
  operation: (tx: TTransaction) => Promise<T>,
): Promise<T> {
  const validTenantId = assertTenantId(tenantId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${validTenantId}, true)`);
    return await operation(tx);
  });
}
