import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000" },
  webServer: {
    command: "pnpm --filter @attesta/web dev",
    url: "http://127.0.0.1:3000/api/health",
    env: { ENABLE_SYNTHETIC_BOOTSTRAP: "true" },
    reuseExistingServer: true,
  },
});
