import { describe, expect, it } from "vitest";
import * as domain from "./index";

describe("domain package", () => {
  it("exports a package entry point", () => {
    expect(domain).toBeDefined();
  });
});
