import { afterEach, describe, expect, it } from "vitest";
import { getDatabaseUrl } from "./env";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe("getDatabaseUrl", () => {
  it("reads DATABASE_URL when called instead of during module import", () => {
    process.env.DATABASE_URL = "postgresql://runtime.example/attesta";

    expect(getDatabaseUrl()).toBe("postgresql://runtime.example/attesta");
  });

  it("rejects a missing DATABASE_URL at request time", () => {
    delete process.env.DATABASE_URL;

    expect(() => getDatabaseUrl()).toThrow("DATABASE_URL is required");
  });
});
