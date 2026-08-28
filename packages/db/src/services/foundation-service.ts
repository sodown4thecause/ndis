import { randomUUID } from "node:crypto";
import {
  createTenantBootstrap,
  verifyAuditChain,
  type AuditVerification,
  type NewTenantInput,
} from "@attesta/domain";
import type { AuditEventInput, PersistedAuditEventInput } from "../repositories/audit-repository";

export type TenantRecord = { id: string; name: string };
export type SiteRecord = { id: string; tenantId: string; name: string };
export type WorkerRecord = { id: string; tenantId: string; siteId: string; name: string };
export type ParticipantRecord = {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  preferredFormat: string;
};
export type AuditEventRecord = PersistedAuditEventInput & { id: string; createdAt: Date; createdOrder: number };

export type FoundationTransaction = {
  setTenantContext(tenantId: string): Promise<void>;
  createTenant(id: string, name: string): Promise<TenantRecord>;
  createSite(tenantId: string, name: string): Promise<SiteRecord>;
  createWorker(tenantId: string, siteId: string, name: string): Promise<WorkerRecord>;
  createParticipant(tenantId: string, siteId: string, name: string, preferredFormat: string): Promise<ParticipantRecord>;
  appendAuditEvent(input: AuditEventInput): Promise<AuditEventRecord>;
  listAuditEvents(tenantId: string): Promise<AuditEventRecord[]>;
};

export type FoundationStore = {
  transaction<T>(operation: (tx: FoundationTransaction) => Promise<T>): Promise<T>;
};

export type TenantBootstrapResult = {
  tenant: TenantRecord;
  site: SiteRecord;
  worker: WorkerRecord;
  participant: ParticipantRecord;
  auditEvents: AuditEventRecord[];
};

export type FoundationService = {
  bootstrapTenant(input: NewTenantInput, actorReference?: string): Promise<TenantBootstrapResult>;
  appendAuditEvent(input: AuditEventInput): Promise<AuditEventRecord>;
  verifyTenantAuditChain(tenantId: string): Promise<AuditVerification>;
};

export function createFoundationService(store: FoundationStore): FoundationService {
  return {
    bootstrapTenant(input, actorReference = "system"): Promise<TenantBootstrapResult> {
      const seed = createTenantBootstrap(input);
      const tenantId = randomUUID();

      return store.transaction(async (tx) => {
        await tx.setTenantContext(tenantId);
        const tenant = await tx.createTenant(tenantId, seed.tenant.name);
        const auditEvents: AuditEventRecord[] = [];
        const recordCreate = async (entityType: string, entityId: string, payload: unknown) => {
          const event = await tx.appendAuditEvent({
            tenantId: tenant.id,
            actorReference,
            action: "create",
            entityType,
            entityId,
            payload,
          });
          auditEvents.push(event);
        };

        await recordCreate("tenant", tenant.id, tenant);

        const site = await tx.createSite(tenant.id, seed.site.name);
        await recordCreate("site", site.id, site);

        const worker = await tx.createWorker(tenant.id, site.id, seed.worker.name);
        await recordCreate("worker", worker.id, worker);

        const participant = await tx.createParticipant(
          tenant.id,
          site.id,
          seed.participant.name,
          seed.participant.preferredFormat,
        );
        await recordCreate("participant", participant.id, participant);

        return { tenant, site, worker, participant, auditEvents };
      });
    },

    appendAuditEvent(input) {
      return store.transaction(async (tx) => {
        await tx.setTenantContext(input.tenantId);
        return tx.appendAuditEvent({
          tenantId: input.tenantId,
          actorReference: input.actorReference,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          payload: input.payload,
          retentionUntil: input.retentionUntil,
        });
      });
    },

    verifyTenantAuditChain(tenantId) {
      return store.transaction(async (tx) => {
        await tx.setTenantContext(tenantId);
        const events = await tx.listAuditEvents(tenantId);
        return verifyAuditChain(events.map(({ previousHash, payload, eventHash }) => ({ previousHash, payload, eventHash })));
      });
    },
  };
}
