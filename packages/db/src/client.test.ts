import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";

describe("database client", () => {
  it("runs an interactive transaction through an injected local pool without production access", async () => {
    const queries: string[] = [];
    const pool = {
      async query(config: { text?: string } | string) {
        queries.push((typeof config === "string" ? config : (config.text ?? "")).trim());
        return { rows: [] };
      },
      async end() {},
    } as unknown as Pool;

    const db = createDb("postgres://local.test/attesta", { poolFactory: () => pool });

    await expect(db.transaction(async (tx) => {
      await tx.execute(sql`select 1`);
      return "committed";
    })).resolves.toBe("committed");
    await db.close();

    expect(queries).toEqual(["begin", "select 1", "commit"]);
  });
});
