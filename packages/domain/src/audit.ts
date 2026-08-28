import { createHash } from "node:crypto";
import type { AuditHash } from "./ids";

export type AuditEvent = {
  id: string;
  previousHash: AuditHash | null;
  tenantId: string;
  actorReference: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: string;
  payloadHash: AuditHash;
  retentionUntil: string;
  createdAt: string;
  createdOrder: number;
  eventHash: AuditHash;
};

export type AuditEnvelope = Omit<AuditEvent, "eventHash">;

export type AuditVerification = {
  valid: boolean;
  checked: number;
  firstInvalidIndex: number | null;
};

export function canonicalize(value: unknown): string {
  if (value === null) return "null";

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Audit payload contains a non-finite number");
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`);
    return `{${entries.join(",")}}`;
  }

  throw new TypeError("Audit payload contains an unsupported value");
}

export function computeAuditHash(previousHash: AuditHash | null, payload: string): AuditHash {
  return createHash("sha256")
    .update(`${previousHash ?? ""}${payload}`, "utf8")
    .digest("hex");
}

export function computePayloadHash(payload: string): AuditHash {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function computeAuditEventHash(envelope: AuditEnvelope): AuditHash {
  return computeAuditHash(envelope.previousHash, canonicalize({
    id: envelope.id,
    previousHash: envelope.previousHash,
    tenantId: envelope.tenantId,
    actorReference: envelope.actorReference,
    action: envelope.action,
    entityType: envelope.entityType,
    entityId: envelope.entityId,
    payload: envelope.payload,
    payloadHash: envelope.payloadHash,
    retentionUntil: envelope.retentionUntil,
    createdAt: envelope.createdAt,
    createdOrder: envelope.createdOrder,
  }));
}

export function verifyAuditChain(events: AuditEvent[]): AuditVerification {
  let previousHash: AuditHash | null = null;
  let previousOrder: number | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const validLink = event.previousHash === previousHash;
    const validPayloadHash = event.payloadHash === computePayloadHash(event.payload);
    const validOrder = Number.isSafeInteger(event.createdOrder)
      && event.createdOrder > 0
      && (previousOrder === null || event.createdOrder > previousOrder);
    const validHash = event.eventHash === computeAuditEventHash({
      id: event.id,
      previousHash: event.previousHash,
      tenantId: event.tenantId,
      actorReference: event.actorReference,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload,
      payloadHash: event.payloadHash,
      retentionUntil: event.retentionUntil,
      createdAt: event.createdAt,
      createdOrder: event.createdOrder,
    });

    if (!validLink || !validPayloadHash || !validOrder || !validHash) {
      return { valid: false, checked: index + 1, firstInvalidIndex: index };
    }

    previousHash = event.eventHash;
    previousOrder = event.createdOrder;
  }

  return { valid: true, checked: events.length, firstInvalidIndex: null };
}
