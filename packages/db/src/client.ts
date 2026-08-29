import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type CreateDbOptions = {
  poolFactory?: (databaseUrl: string) => Pool;
  webSocketConstructor?: typeof ws;
};

export function createDb(databaseUrl = process.env.DATABASE_URL, options: CreateDbOptions = {}) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  neonConfig.webSocketConstructor = options.webSocketConstructor ?? ws;
  const pool = (options.poolFactory ?? ((connectionString) => new Pool({ connectionString })))(databaseUrl);
  const db = drizzle(pool, { schema });
  return Object.assign(db, { close: () => pool.end() });
}

export type AppDb = ReturnType<typeof createDb>;
