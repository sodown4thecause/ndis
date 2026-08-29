import { expect, test } from "@playwright/test";

test("verifies the public foundation and synthetic bootstrap boundary", async ({ page }) => {
  const baseUrl = "http://localhost:3000";
  const home = await page.goto(`${baseUrl}/`);
  expect(home?.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Attesta foundation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bootstrap synthetic tenant" })).toBeVisible();

  const health = await page.request.get(`${baseUrl}/api/health`);
  expect(health.status()).toBe(200);
  await expect(health.json()).resolves.toEqual({ status: "ok" });

  const invalid = await page.request.post(`${baseUrl}/api/tenants`, {
    data: {
      name: "Synthetic Example SIL",
      siteName: "Synthetic House",
      workerName: "Synthetic Worker",
      participantName: "Synthetic Participant",
      tenantId: "caller-supplied-id",
    },
  });
  expect(invalid.status()).toBe(400);
  await expect(invalid.json()).resolves.toEqual({ error: "Invalid request" });

  let submittedBody: Record<string, unknown> | undefined;
  await page.route(`${baseUrl}/api/tenants`, async (route) => {
    expect(route.request().method()).toBe("POST");
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        tenant: { id: "synthetic-tenant-id", name: "Synthetic Example SIL" },
        site: { id: "synthetic-site-id", name: "Synthetic House" },
        worker: { id: "synthetic-worker-id", name: "Synthetic Worker" },
        participant: { id: "synthetic-participant-id", name: "Synthetic Participant" },
      }),
    });
  });

  await page.goto(`${baseUrl}/bootstrap`);
  await page.getByLabel("Tenant name").fill("Synthetic Example SIL");
  await page.getByLabel("Site name").fill("Synthetic House");
  await page.getByLabel("Worker name").fill("Synthetic Worker");
  await page.getByLabel("Participant name").fill("Synthetic Participant");
  await page.getByRole("button", { name: "Create synthetic tenant" }).click();

  await expect(page.getByRole("status")).toHaveText(
    'Created synthetic tenant “Synthetic Example SIL” (synthetic-tenant-id).',
  );
  expect(submittedBody).toEqual({
    name: "Synthetic Example SIL",
    siteName: "Synthetic House",
    workerName: "Synthetic Worker",
    participantName: "Synthetic Participant",
  });
  expect(submittedBody).not.toHaveProperty("tenantId");
});
