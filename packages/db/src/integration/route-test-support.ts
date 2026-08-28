import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../schema";
import { createDrizzleFoundationStore } from "../repositories/tenant-repository";
import { createFoundationService } from "../services/foundation-service";
import type { AppDb } from "../client";

const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));
const appRole = "attesta_route_test_app";
const runtimeRole = "attesta_route_test_runtime";

export async function createMigratedFoundationDatabase() {
  const pg = new PGlite();
  await pg.waitReady;
  const db = drizzlePglite(pg, { schema });
  await migrate(db, { migrationsFolder });
  await pg.exec(`
    CREATE ROLE ${appRole} NOLOGIN NOBYPASSRLS;
    CREATE ROLE ${runtimeRole} LOGIN NOBYPASSRLS;
    GRANT ${appRole} TO ${runtimeRole};
    GRANT USAGE ON SCHEMA public TO ${appRole};
    GRANT SELECT, INSERT ON tenants, sites, workers, participants, audit_events TO ${appRole};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${appRole};
  `);
  await pg.query(`SET ROLE ${runtimeRole}`);

  return {
    pg,
    db: db as unknown as AppDb,
    service: createFoundationService(createDrizzleFoundationStore(db as unknown as AppDb)),
    close: () => pg.close(),
  };
}
