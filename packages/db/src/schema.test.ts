import { describe, expect, it } from "vitest";
import { auditEvents, participants, sites, tenants, workers } from "./schema";

describe("foundation schema", () => {
  it("exposes every required foundation table", () => {
    expect(tenants).toBeDefined();
    expect(sites).toBeDefined();
    expect(workers).toBeDefined();
    expect(participants).toBeDefined();
    expect(auditEvents).toBeDefined();
  });

  it("defines tenant ownership on every tenant-owned table", () => {
    for (const table of [sites, workers, participants, auditEvents]) {
      expect("tenantId" in table).toBe(true);
    }
  });
});
