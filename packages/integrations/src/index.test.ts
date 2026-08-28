import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createAiAuditMetadata,
  createNoopNotificationAdapter,
  createWorkOSIdentityReference,
  type AiAuditMetadata,
  type NotificationRequest,
} from "./index";

describe("Phase 01 integration boundaries", () => {
  it("provides a no-op notification adapter without sending message content", async () => {
    const request: NotificationRequest = {
      channel: "email",
      recipientAddress: "synthetic@example.test",
      templateName: "briefing-nudge",
      variables: { firstName: "Synthetic" },
      applicationReference: "briefing-123",
    };

    await expect(createNoopNotificationAdapter().send(request)).resolves.toEqual({
      status: "noop",
      applicationReference: "briefing-123",
    });
  });

  it("keeps AI audit metadata to hashes, routing, version, and human approver", () => {
    const metadata = createAiAuditMetadata({
      model: "model-synthetic",
      provider: "provider-synthetic",
      version: "v1",
      promptHash: "a".repeat(64),
      outputHash: "b".repeat(64),
      approver: "user-synthetic",
    });

    expect(metadata).toEqual<AiAuditMetadata>({
      model: "model-synthetic",
      provider: "provider-synthetic",
      version: "v1",
      promptHash: "a".repeat(64),
      outputHash: "b".repeat(64),
      approver: "user-synthetic",
    });
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(() => createAiAuditMetadata({ ...metadata, promptHash: "not-a-hash" })).toThrow("promptHash");
  });

  it("drops runtime properties outside the AI audit metadata contract", () => {
    const inputWithExtraProperty = {
      model: "model-synthetic",
      provider: "provider-synthetic",
      version: "v1",
      promptHash: "a".repeat(64),
      outputHash: "b".repeat(64),
      approver: "user-synthetic",
      rawPrompt: "must not cross the audit metadata boundary",
    };

    expect(createAiAuditMetadata(inputWithExtraProperty)).toEqual({
      model: "model-synthetic",
      provider: "provider-synthetic",
      version: "v1",
      promptHash: "a".repeat(64),
      outputHash: "b".repeat(64),
      approver: "user-synthetic",
    });
  });

  it("exposes only a WorkOS identity reference at the identity boundary", () => {
    expect(createWorkOSIdentityReference({ subject: "user-synthetic" })).toEqual({
      provider: "workos",
      subject: "user-synthetic",
    });
    expectTypeOf<Parameters<typeof createWorkOSIdentityReference>[0]>().not.toHaveProperty("email");
  });
});
