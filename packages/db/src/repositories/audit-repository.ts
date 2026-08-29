import {
  canonicalize,
  computeAuditEventHash,
  computePayloadHash,
  type AuditEnvelope,
  type AuditHash,
} from "@attesta/domain";

export type AuditEventInput = {
  tenantId: string;
  actorReference: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: unknown;
};

export type AuditEventImmutableValues = {
  id: string;
  createdAt: Date;
  createdOrder: number;
};

export type PersistedAuditEventInput = Omit<AuditEventInput, "payload"> & AuditEventImmutableValues & {
  payload: string;
  payloadHash: string;
  previousHash: AuditHash | null;
  eventHash: AuditHash;
  retentionUntil: Date;
};

type AuditEventWithPreviousHash = AuditEventInput & { previousHash: AuditHash | null };

export function createAuditEventInput(
  input: AuditEventWithPreviousHash,
  immutableValues: AuditEventImmutableValues,
): PersistedAuditEventInput {
  const payload = canonicalize(input.payload);
  const createdAt = new Date(immutableValues.createdAt);
  const retentionUntil = new Date(createdAt);
  retentionUntil.setUTCFullYear(retentionUntil.getUTCFullYear() + 7);
  const payloadHash = computePayloadHash(payload);
  const envelope: AuditEnvelope = {
    id: immutableValues.id,
    previousHash: input.previousHash,
    tenantId: input.tenantId,
    actorReference: input.actorReference,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    payload,
    payloadHash,
    retentionUntil: retentionUntil.toISOString(),
    createdAt: createdAt.toISOString(),
    createdOrder: immutableValues.createdOrder,
  };

  return {
    id: immutableValues.id,
    tenantId: input.tenantId,
    actorReference: input.actorReference,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    payload,
    payloadHash,
    eventHash: computeAuditEventHash(envelope),
    previousHash: input.previousHash,
    createdAt,
    createdOrder: immutableValues.createdOrder,
    retentionUntil,
  };
}
