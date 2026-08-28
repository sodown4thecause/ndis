import { describe, expect, it } from "vitest";
import {
  canonicalize,
  computeAuditHash,
  verifyAuditChain,
  type AuditEvent,
} from "./audit";

describe("audit chain", () => {
  it("canonicalizes object keys in stable order", () => {
    expect(canonicalize({ z: 1, a: "two" })).toBe('{"a":"two","z":1}');
  });

  it("detects a changed payload", () => {
    const payload = canonicalize({ action: "create", entity: "tenant" });
    const event: AuditEvent = {
      previousHash: null,
      payload,
      eventHash: computeAuditHash(null, payload),
    };

    expect(
      verifyAuditChain([{ ...event, payload: canonicalize({ action: "update" }) }]),
    ).toEqual({ valid: false, checked: 1, firstInvalidIndex: 0 });
  });

  it("detects a broken previous link", () => {
    const firstPayload = canonicalize({ action: "create" });
    const secondPayload = canonicalize({ action: "update" });
    const first: AuditEvent = {
      previousHash: null,
      payload: firstPayload,
      eventHash: computeAuditHash(null, firstPayload),
    };
    const second: AuditEvent = {
      previousHash: "wrong-link",
      payload: secondPayload,
      eventHash: computeAuditHash("wrong-link", secondPayload),
    };

    expect(verifyAuditChain([first, second])).toEqual({
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
