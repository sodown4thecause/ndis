import { describe, expect, it } from "vitest";
import {
  canonicalize,
  computeAuditHash,
  computeAuditEventHash,
  computePayloadHash,
  verifyAuditChain,
  type AuditEnvelope,
  type AuditEvent,
} from "./audit";

const envelopeDefaults: AuditEnvelope = {
  id: "00000000-0000-4000-8000-000000000010",
  previousHash: null,
  tenantId: "00000000-0000-4000-8000-000000000001",
  actorReference: "system",
  action: "create",
  entityType: "tenant",
  entityId: "00000000-0000-4000-8000-000000000001",
  payload: '{"name":"Example SIL"}',
  payloadHash: computePayloadHash('{"name":"Example SIL"}'),
  retentionUntil: "2033-08-28T14:35:27.123Z",
  createdAt: "2026-08-28T14:35:27.123Z",
  createdOrder: 1,
};

function makeEvent(overrides: Partial<AuditEnvelope> = {}): AuditEvent {
  const envelope = { ...envelopeDefaults, ...overrides };
  return { ...envelope, eventHash: computeAuditEventHash(envelope) };
}

describe("audit chain", () => {
  it("canonicalizes object keys in stable order", () => {
    expect(canonicalize({ z: 1, a: "two" })).toBe('{"a":"two","z":1}');
  });

  it("sorts nested object keys independently of locale", () => {
    expect(canonicalize({ nested: { a: 2, Z: 1 } })).toBe(
      '{"nested":{"Z":1,"a":2}}',
    );
  });

  it("preserves array order while canonicalizing array values", () => {
    expect(canonicalize([{ b: 2, a: 1 }, "two", null])).toBe(
      '[{"a":1,"b":2},"two",null]',
    );
  });

  it("hashes a null previous link deterministically", () => {
    expect(computeAuditHash(null, '{"action":"create"}')).toBe(
      "e7e4f446ad1ae5e2af6590a040d2d75379b5304927c51104e9519bdac0965184",
    );
  });

  it("hashes every immutable audit envelope field", () => {
    const event = makeEvent();

    expect(event.eventHash).toBe(computeAuditEventHash(envelopeDefaults));
    expect(makeEvent({ tenantId: "00000000-0000-4000-8000-000000000002" }).eventHash).not.toBe(event.eventHash);
    expect(makeEvent({ createdOrder: 2 }).eventHash).not.toBe(event.eventHash);
  });

  it("accepts a valid non-empty chain", () => {
    const first = makeEvent();
    const secondEnvelope: AuditEnvelope = {
      ...envelopeDefaults,
      previousHash: first.eventHash,
      action: "update",
      createdOrder: 2,
      createdAt: "2026-08-28T14:35:28.123Z",
    };

    expect(
      verifyAuditChain([first, { ...secondEnvelope, eventHash: computeAuditEventHash(secondEnvelope) }]),
    ).toEqual({ valid: true, checked: 2, firstInvalidIndex: null });
  });

  it.each([
    ["tenant", { tenantId: "00000000-0000-4000-8000-000000000002" }],
    ["actor", { actorReference: "different-actor" }],
    ["action", { action: "update" }],
    ["entity type", { entityType: "site" }],
    ["entity id", { entityId: "00000000-0000-4000-8000-000000000002" }],
    ["payload", { payload: '{"name":"Tampered"}' }],
    ["payload hash", { payloadHash: "0".repeat(64) }],
    ["retention timestamp", { retentionUntil: "2034-08-28T14:35:27.123Z" }],
    ["creation timestamp", { createdAt: "2026-08-28T14:35:28.123Z" }],
    ["creation order", { createdOrder: 2 }],
  ] as const)("detects tampering with %s", (_field, change) => {
    expect(verifyAuditChain([{ ...makeEvent(), ...change }])).toEqual({
      valid: false,
      checked: 1,
      firstInvalidIndex: 0,
    });
  });

  it("detects a broken previous link even when the forged event hash matches it", () => {
    const first = makeEvent();
    const second = makeEvent({ previousHash: "wrong-link", createdOrder: 2 });

    expect(verifyAuditChain([first, second])).toEqual({
      valid: false,
      checked: 2,
      firstInvalidIndex: 1,
    });
  });

  it("detects an order that is not increasing even when its hash is recomputed", () => {
    const first = makeEvent();
    const secondEnvelope: AuditEnvelope = {
      ...envelopeDefaults,
      previousHash: first.eventHash,
      action: "update",
      createdOrder: 1,
      createdAt: "2026-08-28T14:35:28.123Z",
    };

    expect(verifyAuditChain([first, { ...secondEnvelope, eventHash: computeAuditEventHash(secondEnvelope) }])).toEqual({
      valid: false,
      checked: 2,
      firstInvalidIndex: 1,
    });
  });

  it("accepts an empty chain", () => {
    expect(verifyAuditChain([])).toEqual({
      valid: true,
      checked: 0,
      firstInvalidIndex: null,
    });
  });
});
