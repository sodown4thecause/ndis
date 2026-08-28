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

  it("accepts a valid non-empty chain", () => {
    const firstHash =
      "e7e4f446ad1ae5e2af6590a040d2d75379b5304927c51104e9519bdac0965184";

    expect(
      verifyAuditChain([
        {
          previousHash: null,
          payload: '{"action":"create"}',
          eventHash: firstHash,
        },
        {
          previousHash: firstHash,
          payload: '{"action":"update"}',
          eventHash:
            "6a75e7c81664f781699d4bd3328472c290cb60fbeea1b5adb337507b5dc0c060",
        },
      ]),
    ).toEqual({ valid: true, checked: 2, firstInvalidIndex: null });
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
