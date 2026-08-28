import { describe, expect, it } from "vitest";
import { assertTenantId } from "./tenant-context";

describe("tenant context", () => {
  it("accepts a UUID tenant identifier", () => {
    expect(assertTenantId("00000000-0000-4000-8000-000000000001")).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("rejects a malformed tenant identifier before database access", () => {
    expect(() => assertTenantId("not-a-tenant")).toThrow("Invalid tenant ID");
  });
});
