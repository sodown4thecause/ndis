import { describe, expect, it } from "vitest";
import { createAuditEventInput } from "./audit-repository";

describe("audit repository input", () => {
  it("creates a canonical payload and hash-chain input", () => {
    const input = createAuditEventInput({
      tenantId: "tenant-1",
      actorReference: "system",
      action: "create",
      entityType: "tenant",
      entityId: "tenant-1",
      payload: { name: "Example SIL" },
      previousHash: null,
    });

    expect(input.payload).toBe('{"name":"Example SIL"}');
    expect(input.payloadHash).toHaveLength(64);
    expect(input.eventHash).toHaveLength(64);
    expect(input.previousHash).toBeNull();
  });
});
