import { randomUUID } from "node:crypto";
import {
  createTenantBootstrap,
  computeAuditHash,
  verifyAuditChain,
  type AuditVerification,
  type NewTenantInput,
} from "@attesta/domain";
import type { AuditEventInput, PersistedAuditEventInput } from "../repositories/audit-repository";
import { assertTenantId } from "../tenant-context";

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
export type AuditEventClock = () => Date;

export type FoundationTransaction = {
  setTenantContext(tenantId: string): Promise<void>;
  createTenant(id: string, name: string): Promise<TenantRecord>;
  createSite(tenantId: string, name: string): Promise<SiteRecord>;
  createWorker(tenantId: string, siteId: string, name: string): Promise<WorkerRecord>;
  createParticipant(tenantId: string, siteId: string, name: string, preferredFormat: string): Promise<ParticipantRecord>;
  appendAuditEvent(input: AuditEventInput, now?: AuditEventClock): Promise<AuditEventRecord>;
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

export type FoundationServiceOptions = { now?: AuditEventClock };

export function createFoundationService(store: FoundationStore, options: FoundationServiceOptions = {}): FoundationService {
  const now = options.now ?? (() => new Date());

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
          }, now);
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
      const normalizedInput = { ...input, tenantId: assertTenantId(input.tenantId) };

      return store.transaction(async (tx) => {
        await tx.setTenantContext(normalizedInput.tenantId);
        return tx.appendAuditEvent(normalizedInput, now);
      });
    },

    verifyTenantAuditChain(tenantId) {
      const normalizedTenantId = assertTenantId(tenantId);

      return store.transaction(async (tx) => {
        await tx.setTenantContext(normalizedTenantId);
        const events = await tx.listAuditEvents(normalizedTenantId);
        const invalidPayloadHashIndex = events.findIndex(
          (event) => event.payloadHash !== computeAuditHash(null, event.payload),
        );
        if (invalidPayloadHashIndex >= 0) {
          return { valid: false, checked: invalidPayloadHashIndex + 1, firstInvalidIndex: invalidPayloadHashIndex };
        }

        return verifyAuditChain(events.map(({ previousHash, payload, eventHash }) => ({ previousHash, payload, eventHash })));
      });
    },
  };
}
