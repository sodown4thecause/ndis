import {
  createTenantBootstrap,
  type NewTenantInput,
  type TenantBootstrap,
} from "@attesta/domain";
import {
  createAuditEventInput,
  type AuditEventInput,
} from "../repositories/audit-repository";

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
export type AuditEventRecord = AuditEventInput & { id: string };

export type FoundationTransaction = {
  setTenantContext(tenantId: string): Promise<void>;
  createTenant(name: string): Promise<TenantRecord>;
  createSite(tenantId: string, name: string): Promise<SiteRecord>;
  createWorker(tenantId: string, siteId: string, name: string): Promise<WorkerRecord>;
  createParticipant(tenantId: string, siteId: string, name: string, preferredFormat: string): Promise<ParticipantRecord>;
  appendAuditEvent(event: AuditEventInput): Promise<AuditEventRecord>;
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

export function createFoundationService(store: FoundationStore) {
  return {
    bootstrapTenant(input: NewTenantInput, actorReference = "system"): Promise<TenantBootstrapResult> {
      const seed: TenantBootstrap = createTenantBootstrap(input);

      return store.transaction(async (tx) => {
        let previousHash: string | null = null;
        const auditEvents: AuditEventRecord[] = [];
        const recordCreate = async (entityType: string, entityId: string, payload: unknown) => {
          const event = await tx.appendAuditEvent(
            createAuditEventInput({
              tenantId: tenant.id,
              actorReference,
              action: "create",
              entityType,
              entityId,
              payload,
              previousHash,
            }),
          );
          previousHash = event.eventHash;
          auditEvents.push(event);
        };

        const tenant = await tx.createTenant(seed.tenant.name);
        await tx.setTenantContext(tenant.id);
        await recordCreate("tenant", tenant.id, seed.tenant);

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
  };
}
