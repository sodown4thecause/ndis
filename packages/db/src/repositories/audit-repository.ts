import { canonicalize, computeAuditHash, type AuditHash } from "@attesta/domain";

export type AuditEventInput = {
  tenantId: string;
  actorReference: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: unknown;
  retentionUntil?: Date;
};

export type PersistedAuditEventInput = Omit<AuditEventInput, "payload" | "retentionUntil"> & {
  payload: string;
  payloadHash: string;
  previousHash: AuditHash | null;
  eventHash: AuditHash;
  retentionUntil: Date;
};

type AuditEventWithPreviousHash = AuditEventInput & { previousHash: AuditHash | null };

export function createAuditEventInput(input: AuditEventWithPreviousHash): PersistedAuditEventInput {
  const payload = canonicalize(input.payload);
  const retentionUntil = input.retentionUntil ?? new Date(Date.UTC(new Date().getUTCFullYear() + 7, new Date().getUTCMonth(), new Date().getUTCDate()));

  return {
    tenantId: input.tenantId,
    actorReference: input.actorReference,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    payload,
    payloadHash: computeAuditHash(null, payload),
    eventHash: computeAuditHash(input.previousHash, payload),
    previousHash: input.previousHash,
    retentionUntil,
  };
}
