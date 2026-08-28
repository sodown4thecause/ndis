import { describe, expect, it } from "vitest";
import { createTenantBootstrap } from "./tenant";

describe("tenant bootstrap", () => {
  it("rejects a blank tenant name", () => {
    expect(() =>
      createTenantBootstrap({
        name: " ",
        siteName: "House 1",
        workerName: "Worker One",
        participantName: "Participant One",
      }),
    ).toThrow("Tenant name is required");
  });

  it("returns one site, worker, and participant seed", () => {
    expect(
      createTenantBootstrap({
        name: "Example SIL",
        siteName: "House 1",
        workerName: "Worker One",
        participantName: "Participant One",
      }),
    ).toEqual({
      tenant: { name: "Example SIL" },
      site: { name: "House 1" },
      worker: { name: "Worker One" },
      participant: { name: "Participant One", preferredFormat: "plain-language" },
    });
  });
});
