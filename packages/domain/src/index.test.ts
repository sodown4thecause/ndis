import { describe, expect, it } from "vitest";
import { createTenantBootstrap } from "@attesta/domain";

describe("domain package", () => {
  it("resolves the package name through its exports map", () => {
    expect(
      createTenantBootstrap({
        name: "Example provider",
        siteName: "Example site",
        workerName: "Example worker",
        participantName: "Example participant",
      }),
    ).toEqual({
      tenant: { name: "Example provider" },
      site: { name: "Example site" },
      worker: { name: "Example worker" },
      participant: {
        name: "Example participant",
        preferredFormat: "plain-language",
      },
    });
  });
});
