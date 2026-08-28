import { describe, expect, it, vi } from "vitest";
import { createDefaultPostHandler, createPostHandler, type FoundationServiceLike } from "./route";

const service: FoundationServiceLike = {
  async bootstrapTenant(input) {
    return {
      tenant: { id: "tenant-1", name: input.name },
      site: { id: "site-1", tenantId: "tenant-1", name: input.siteName },
      worker: { id: "worker-1", tenantId: "tenant-1", siteId: "site-1", name: input.workerName },
      participant: {
        id: "participant-1",
        tenantId: "tenant-1",
        siteId: "site-1",
        name: input.participantName,
        preferredFormat: "plain-language",
      },
      auditEvents: [],
    };
  },
};

describe("POST /api/tenants", () => {
  it("returns a created synthetic bootstrap", async () => {
    const request = new Request("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "Example SIL",
        siteName: "House 1",
        workerName: "Worker One",
        participantName: "Participant One",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await createPostHandler(service)(request);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      tenant: { id: "tenant-1", name: "Example SIL" },
      site: { id: "site-1", name: "House 1" },
      worker: { id: "worker-1", name: "Worker One" },
      participant: { id: "participant-1", name: "Participant One" },
    });
  });

  it("rejects a blank name", async () => {
    const request = new Request("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify({ name: "", siteName: "House 1", workerName: "Worker One", participantName: "Participant One" }),
      headers: { "content-type": "application/json" },
    });

    const response = await createPostHandler(service)(request);

    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON", async () => {
    const bootstrapTenant = vi.fn(service.bootstrapTenant);
    const request = new Request("http://localhost/api/tenants", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });

    const response = await createPostHandler({ bootstrapTenant })(request);

    expect(response.status).toBe(400);
    expect(bootstrapTenant).not.toHaveBeenCalled();
  });

  it.each(["siteName", "workerName", "participantName"])("rejects a blank %s", async (field) => {
    const bootstrapTenant = vi.fn(service.bootstrapTenant);
    const body = {
      name: "Example SIL",
      siteName: "House 1",
      workerName: "Worker One",
      participantName: "Participant One",
      [field]: "   ",
    };

    const response = await createPostHandler({ bootstrapTenant })(new Request("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(400);
    expect(bootstrapTenant).not.toHaveBeenCalled();
  });

  it.each([
    ["missing participantName", { name: "Example SIL", siteName: "House 1", workerName: "Worker One" }],
    ["caller-supplied tenantId", { name: "Example SIL", siteName: "House 1", workerName: "Worker One", participantName: "Participant One", tenantId: "caller-id" }],
  ])("rejects %s without calling the service", async (_caseName, body) => {
    const bootstrapTenant = vi.fn(service.bootstrapTenant);
    const request = new Request("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });

    const response = await createPostHandler({ bootstrapTenant })(request);

    expect(response.status).toBe(400);
    expect(bootstrapTenant).not.toHaveBeenCalled();
  });

  it("maps a known domain validation failure to a safe 400 response", async () => {
    const failingService: FoundationServiceLike = {
      async bootstrapTenant() {
        throw new Error("Tenant name is required");
      },
    };

    const request = new Request("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "Example SIL",
        siteName: "House 1",
        workerName: "Worker One",
        participantName: "Participant One",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await createPostHandler(failingService)(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request" });
  });

  it("maps database failures to a stable response without leaking details", async () => {
    const failingService: FoundationServiceLike = {
      async bootstrapTenant() {
        throw new Error("password=secret select * from tenants");
      },
    };

    const request = new Request("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "Example SIL",
        siteName: "House 1",
        workerName: "Worker One",
        participantName: "Participant One",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await createPostHandler(failingService)(request);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Service unavailable" });
  });

  it("validates before creating the database and closes it after a valid request", async () => {
    const close = vi.fn(async () => undefined);
    const createDb = vi.fn(() => ({ close }));
    const createService = vi.fn(() => service);
    const handler = createDefaultPostHandler({
      getDatabaseUrl: () => "postgresql://runtime.example/attesta",
      createDb,
      createService,
    });

    const invalidResponse = await handler(new Request("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify({ name: "", siteName: "House 1", workerName: "Worker One", participantName: "Participant One" }),
      headers: { "content-type": "application/json" },
    }));

    expect(invalidResponse.status).toBe(400);
    expect(createDb).not.toHaveBeenCalled();
    expect(createService).not.toHaveBeenCalled();

    const validResponse = await handler(new Request("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify({ name: "Example SIL", siteName: "House 1", workerName: "Worker One", participantName: "Participant One" }),
      headers: { "content-type": "application/json" },
    }));

    expect(validResponse.status).toBe(201);
    expect(createDb).toHaveBeenCalledOnce();
    expect(createService).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("maps missing database configuration to a stable response", async () => {
    const createDb = vi.fn(() => ({ close: vi.fn(async () => undefined) }));
    const handler = createDefaultPostHandler({
      getDatabaseUrl: () => {
        throw new Error("DATABASE_URL is required");
      },
      createDb,
    });

    const response = await handler(new Request("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify({ name: "Example SIL", siteName: "House 1", workerName: "Worker One", participantName: "Participant One" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Service unavailable" });
    expect(createDb).not.toHaveBeenCalled();
  });
});
