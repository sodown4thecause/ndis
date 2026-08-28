import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/db/src/integration/migrator.db.test.ts",
      "packages/db/src/integration/task-4.db.test.ts",
      "apps/web/app/api/tenants/route.integration.test.ts",
    ],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15_000,
    passWithNoTests: false,
  },
});
