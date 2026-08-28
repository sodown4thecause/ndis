import { randomUUID } from "node:crypto";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { AppDb } from "../client";
import { auditEvents, participants, sites, tenants, workers, type PreferredCommunicationFormat, type TenantStatus } from "../schema";
import { assertTenantId, withTenant } from "../tenant-context";
import { computeAuditEventHash, type AuditEnvelope, type NewTenantInput } from "@attesta/domain";
import { createAuditEventInput, type AuditEventInput } from "./audit-repository";
import type {
  AuditEventRecord,
  FoundationStore,
  FoundationTransaction,
  ParticipantRecord,
  SiteRecord,
  TenantBootstrapResult,
  TenantRecord,
  WorkerRecord,
} from "../services/foundation-service";
import { createFoundationService } from "../services/foundation-service";

function requiredRow<T>(row: T | undefined): T {
  if (!row) throw new Error("Database insert returned no row");
  return row;
}

export type TenantRepository = {
  createTenantBootstrap(input: NewTenantInput, actorReference?: string): Promise<TenantBootstrapResult>;
  getTenant(tenantId: string): Promise<TenantRecord | null>;
  listTenantPeople(tenantId: string): Promise<TenantPerson[]>;
};

export type TenantPerson = {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  status: TenantStatus;
  kind: "worker" | "participant";
  preferredFormat: PreferredCommunicationFormat | null;
};

export function createTenantBootstrap(
  db: AppDb,
  input: NewTenantInput,
  actorReference = "system",
): Promise<TenantBootstrapResult> {
  return createFoundationService(createDrizzleFoundationStore(db)).bootstrapTenant(input, actorReference);
}

export function createTenantRepository(db: AppDb): TenantRepository {
  return {
    createTenantBootstrap(input, actorReference) {
      return createTenantBootstrap(db, input, actorReference);
    },
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
          ...workerRows.map((row) => ({ ...row, status: row.status as TenantStatus, kind: "worker" as const, preferredFormat: null })),
          ...participantRows.map((row) => ({ ...row, status: row.status as TenantStatus, kind: "participant" as const, preferredFormat: row.preferredFormat as PreferredCommunicationFormat })),
        ];
      });
    },
  };
}

export function createDrizzleFoundationStore(db: AppDb, options: { now?: () => Date } = {}): FoundationStore {
  const now = options.now ?? (() => new Date());

  return {
    transaction<T>(operation: (tx: FoundationTransaction) => Promise<T>): Promise<T> {
      return db.transaction(async (tx) => {
        const adapter: FoundationTransaction = {
          async setTenantContext(tenantId) {
            const normalizedTenantId = assertTenantId(tenantId);
            await tx.execute(sql`select set_config('app.tenant_id', ${normalizedTenantId}, true)`);
          },
          async createTenant(id, name): Promise<TenantRecord> {
            const [row] = await tx.insert(tenants).values({ id, name }).returning({ id: tenants.id, name: tenants.name });
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
          async appendAuditEvent(input: AuditEventInput, eventNow = now): Promise<AuditEventRecord> {
            const normalizedTenantId = assertTenantId(input.tenantId);
            // PostgreSQL transaction-level advisory locks serialize a tenant's chain even when its first event does not exist yet.
            await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"attesta:audit-chain:" + normalizedTenantId}, 0))`);
            const [head] = await tx
              .select({ eventHash: auditEvents.eventHash })
              .from(auditEvents)
              .where(eq(auditEvents.tenantId, normalizedTenantId))
              .orderBy(desc(auditEvents.createdOrder))
              .limit(1);
            const orderResult = await tx.execute(sql`select nextval('audit_events_created_order_seq') as created_order`);
            const createdOrder = Number((orderResult as { rows?: Array<{ created_order?: number | string }> }).rows?.[0]?.created_order);
            if (!Number.isSafeInteger(createdOrder) || createdOrder < 1) {
              throw new Error("Database did not return a valid audit order");
            }
            const createdAt = new Date(eventNow().getTime());
            const event = createAuditEventInput(
              { ...input, tenantId: normalizedTenantId, previousHash: head?.eventHash ?? null },
              { id: randomUUID(), createdAt, createdOrder },
            );
            const [row] = await tx.insert(auditEvents).values(event).returning();
            const persisted = requiredRow(row);
            const persistedEnvelope: AuditEnvelope = {
              id: persisted.id,
              previousHash: persisted.previousHash,
              tenantId: persisted.tenantId,
              actorReference: persisted.actorReference,
              action: persisted.action,
              entityType: persisted.entityType,
              entityId: persisted.entityId,
              payload: persisted.payload,
              payloadHash: persisted.payloadHash,
              retentionUntil: persisted.retentionUntil.toISOString(),
              createdAt: persisted.createdAt.toISOString(),
              createdOrder: persisted.createdOrder,
            };
            if (
              persisted.id !== event.id
              || persisted.createdOrder !== event.createdOrder
              || persisted.createdAt.getTime() !== event.createdAt.getTime()
              || persisted.retentionUntil.getTime() !== event.retentionUntil.getTime()
              || persisted.eventHash !== computeAuditEventHash(persistedEnvelope)
            ) {
              throw new Error("Persisted audit event does not match its hashed envelope");
            }
            return persisted;
          },
          async listAuditEvents(tenantId): Promise<AuditEventRecord[]> {
            const normalizedTenantId = assertTenantId(tenantId);
            return tx
              .select()
              .from(auditEvents)
              .where(eq(auditEvents.tenantId, normalizedTenantId))
              .orderBy(asc(auditEvents.createdOrder));
          },
        };

        return operation(adapter);
      });
    },
  };
}
