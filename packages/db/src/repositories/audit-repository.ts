import { canonicalize, computeAuditHash, type AuditHash } from "@attesta/domain";

export type AuditEventInput = {
  tenantId: string;
  actorReference: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: string;
  payloadHash: string;
  previousHash: AuditHash | null;
  eventHash: AuditHash;
  retentionUntil: Date;
};

type NewAuditEventInput = Omit<AuditEventInput, "payload" | "payloadHash" | "eventHash" | "retentionUntil"> & {
  payload: unknown;
  retentionUntil?: Date;
};

export function createAuditEventInput(input: NewAuditEventInput): AuditEventInput {
  const payload = canonicalize(input.payload);
  const retentionUntil = input.retentionUntil ?? new Date(Date.UTC(new Date().getUTCFullYear() + 7, new Date().getUTCMonth(), new Date().getUTCDate()));

  return {
    ...input,
    payload,
    payloadHash: computeAuditHash(null, payload),
    eventHash: computeAuditHash(input.previousHash, payload),
    retentionUntil,
  };
}
