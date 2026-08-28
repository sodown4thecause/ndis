import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: [
      ...configDefaults.exclude,
      "packages/db/src/integration/**/*.test.ts",
      "**/*.integration.test.ts",
    ],
    passWithNoTests: false,
  },
});
