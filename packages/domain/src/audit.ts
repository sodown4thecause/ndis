import { createHash } from "node:crypto";
import type { AuditHash } from "./ids";

export type AuditEvent = {
  previousHash: AuditHash | null;
  payload: string;
  eventHash: AuditHash;
};

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

export function verifyAuditChain(events: AuditEvent[]): AuditVerification {
  let previousHash: AuditHash | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const validLink = event.previousHash === previousHash;
    const validHash = event.eventHash === computeAuditHash(event.previousHash, event.payload);

    if (!validLink || !validHash) {
      return { valid: false, checked: index + 1, firstInvalidIndex: index };
    }

    previousHash = event.eventHash;
  }

  return { valid: true, checked: events.length, firstInvalidIndex: null };
}
