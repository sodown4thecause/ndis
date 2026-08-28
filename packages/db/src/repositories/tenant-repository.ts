import { eq, sql } from "drizzle-orm";
import type { AppDb } from "../client";
import { auditEvents, participants, sites, tenants, workers } from "../schema";
import { withTenant } from "../tenant-context";
import type { AuditEventInput } from "./audit-repository";
import type {
  AuditEventRecord,
  FoundationStore,
  FoundationTransaction,
  ParticipantRecord,
  SiteRecord,
  TenantRecord,
  WorkerRecord,
} from "../services/foundation-service";

function requiredRow<T>(row: T | undefined): T {
  if (!row) throw new Error("Database insert returned no row");
  return row;
}

export type TenantRepository = {
  getTenant(tenantId: string): Promise<TenantRecord | null>;
  listTenantPeople(tenantId: string): Promise<TenantPerson[]>;
};

export type TenantPerson = {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  status: string;
  kind: "worker" | "participant";
  preferredFormat: string | null;
};

export function createTenantRepository(db: AppDb): TenantRepository {
  return {
    async getTenant(tenantId) {
      return withTenant(db, tenantId, async (tx) => {
        const rows = await tx
          .select({ id: tenants.id, name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, tenantId));
        return rows[0] ?? null;
      });
    },
    async listTenantPeople(tenantId) {
      return withTenant(db, tenantId, async (tx) => {
        const workerRows = await tx
          .select({
            id: workers.id,
            tenantId: workers.tenantId,
            siteId: workers.siteId,
            name: workers.name,
            status: workers.status,
          })
          .from(workers)
          .where(eq(workers.tenantId, tenantId));
        const participantRows = await tx
          .select({
            id: participants.id,
            tenantId: participants.tenantId,
            siteId: participants.siteId,
            name: participants.name,
            status: participants.status,
            preferredFormat: participants.preferredFormat,
          })
          .from(participants)
          .where(eq(participants.tenantId, tenantId));

        return [
          ...workerRows.map((row) => ({ ...row, kind: "worker" as const, preferredFormat: null })),
          ...participantRows.map((row) => ({ ...row, kind: "participant" as const })),
        ];
      });
    },
  };
}

export function createDrizzleFoundationStore(db: AppDb): FoundationStore {
  return {
    transaction<T>(operation: (tx: FoundationTransaction) => Promise<T>): Promise<T> {
      return db.transaction(async (tx) => {
        const adapter: FoundationTransaction = {
          async setTenantContext(tenantId) {
            await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
          },
          async createTenant(name): Promise<TenantRecord> {
            const [row] = await tx.insert(tenants).values({ name }).returning({ id: tenants.id, name: tenants.name });
            return requiredRow(row);
          },
          async createSite(tenantId, name): Promise<SiteRecord> {
            const [row] = await tx.insert(sites).values({ tenantId, name }).returning({ id: sites.id, tenantId: sites.tenantId, name: sites.name });
            return requiredRow(row);
          },
          async createWorker(tenantId, siteId, name): Promise<WorkerRecord> {
            const [row] = await tx.insert(workers).values({ tenantId, siteId, name }).returning({ id: workers.id, tenantId: workers.tenantId, siteId: workers.siteId, name: workers.name });
            return requiredRow(row);
          },
          async createParticipant(tenantId, siteId, name, preferredFormat): Promise<ParticipantRecord> {
            const [row] = await tx.insert(participants).values({ tenantId, siteId, name, preferredFormat }).returning({ id: participants.id, tenantId: participants.tenantId, siteId: participants.siteId, name: participants.name, preferredFormat: participants.preferredFormat });
            return requiredRow(row);
          },
          async appendAuditEvent(event: AuditEventInput): Promise<AuditEventRecord> {
            const [row] = await tx.insert(auditEvents).values(event).returning();
            return requiredRow({ ...row, payload: row.payload });
          },
        };

        return operation(adapter);
      });
    },
  };
}
