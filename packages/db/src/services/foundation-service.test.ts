import { describe, expect, expectTypeOf, it } from "vitest";
import { verifyAuditChain } from "@attesta/domain";
import { createAuditEventInput, type AuditEventInput } from "../repositories/audit-repository";
import {
  createFoundationService,
  type AuditEventRecord,
  type FoundationStore,
  type FoundationService,
  type FoundationTransaction,
} from "./foundation-service";

type State = {
  tenants: { id: string; name: string }[];
  sites: { id: string; tenantId: string; name: string }[];
  workers: { id: string; tenantId: string; siteId: string; name: string }[];
  participants: { id: string; tenantId: string; siteId: string; name: string; preferredFormat: string }[];
  auditEvents: AuditEventRecord[];
};

const bootstrapInput = {
  name: "Example SIL",
  siteName: "House 1",
  workerName: "Worker One",
  participantName: "Participant One",
};

function cloneState(state: State): State {
  return {
    tenants: state.tenants.map((row) => ({ ...row })),
    sites: state.sites.map((row) => ({ ...row })),
    workers: state.workers.map((row) => ({ ...row })),
    participants: state.participants.map((row) => ({ ...row })),
    auditEvents: state.auditEvents.map((row) => ({ ...row, retentionUntil: new Date(row.retentionUntil), createdAt: new Date(row.createdAt) })),
  };
}

function makeStore(options: { failAuditAt?: number } = {}): FoundationStore & { state: State; calls: string[] } {
  let nextId = 1;
  const state: State = { tenants: [], sites: [], workers: [], participants: [], auditEvents: [] };
  const calls: string[] = [];

  return {
    state,
    calls,
    async transaction<T>(operation: (tx: FoundationTransaction) => Promise<T>) {
      const working = cloneState(state);
      const tx: FoundationTransaction = {
        async setTenantContext(tenantId) {
          calls.push(`context:${tenantId}`);
        },
        async createTenant(id, name) {
          calls.push("tenant");
          const row = { id, name };
          working.tenants.push(row);
          return row;
        },
        async createSite(tenantId, name) {
          calls.push("site");
          const row = { id: `00000000-0000-4000-8000-0000000000${nextId++}`, tenantId, name };
          working.sites.push(row);
          return row;
        },
        async createWorker(tenantId, siteId, name) {
          calls.push("worker");
          const row = { id: `00000000-0000-4000-8000-0000000000${nextId++}`, tenantId, siteId, name };
          working.workers.push(row);
          return row;
        },
        async createParticipant(tenantId, siteId, name, preferredFormat) {
          calls.push("participant");
          const row = { id: `00000000-0000-4000-8000-0000000000${nextId++}`, tenantId, siteId, name, preferredFormat };
          working.participants.push(row);
          return row;
        },
        async appendAuditEvent(input: AuditEventInput) {
          calls.push("audit");
          if (options.failAuditAt === working.auditEvents.length + 1) throw new Error("forced audit insert failure");
          const previousHash = working.auditEvents.filter((event) => event.tenantId === input.tenantId).at(-1)?.eventHash ?? null;
          const event = createAuditEventInput({ ...input, previousHash });
          const row: AuditEventRecord = {
            id: `00000000-0000-4000-8000-0000000000${nextId++}`,
            ...event,
            createdAt: new Date(Date.UTC(2026, 7, 28, 0, 0, working.auditEvents.length)),
            createdOrder: working.auditEvents.length + 1,
          };
          working.auditEvents.push(row);
          return row;
        },
        async listAuditEvents(tenantId) {
          calls.push("list-audit");
          return working.auditEvents.filter((event) => event.tenantId === tenantId).sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
        },
      };

      const result = await operation(tx);
      Object.assign(state, working);
      return result;
    },
  };
}

describe("foundation service", () => {
  it("creates all bootstrap rows and a linked audit event for each record", async () => {
    const store = makeStore();
    const service = createFoundationService(store);

    const result = await service.bootstrapTenant(bootstrapInput);

    expect(store.state.tenants).toHaveLength(1);
    expect(store.state.sites).toHaveLength(1);
    expect(store.state.workers).toHaveLength(1);
    expect(store.state.participants).toHaveLength(1);
    expect(result.auditEvents).toHaveLength(4);
    expect(verifyAuditChain(store.state.auditEvents)).toEqual({ valid: true, checked: 4, firstInvalidIndex: null });
  });

  it("rolls back domain and audit rows when an audit insert fails", async () => {
    const store = makeStore({ failAuditAt: 4 });
    const service = createFoundationService(store);

    await expect(service.bootstrapTenant(bootstrapInput)).rejects.toThrow("forced audit insert failure");

    expect(store.state).toEqual({ tenants: [], sites: [], workers: [], participants: [], auditEvents: [] });
  });

  it("appends from the stored current head instead of trusting a caller link", async () => {
    const store = makeStore();
    const service = createFoundationService(store);
    const bootstrap = await service.bootstrapTenant(bootstrapInput);

    const result = await service.appendAuditEvent({
      tenantId: bootstrap.tenant.id,
      actorReference: "system",
      action: "note",
      entityType: "tenant",
      entityId: bootstrap.tenant.id,
      payload: { message: "second event" },
      ...({ previousHash: "forged" } as Record<string, string>),
    });

    expect(result.previousHash).toBe(bootstrap.auditEvents.at(-1)?.eventHash);
    expect(result.eventHash).not.toBe("forged");
  });

  it("verifies the tenant chain through the domain verifier", async () => {
    const store = makeStore();
    const service = createFoundationService(store);
    const bootstrap = await service.bootstrapTenant(bootstrapInput);

    await expect(service.verifyTenantAuditChain(bootstrap.tenant.id)).resolves.toEqual({
      valid: true,
      checked: 4,
      firstInvalidIndex: null,
    });
    expect(store.calls).toContain("list-audit");
  });

  it("reports the first invalid event when a stored event is tampered with", async () => {
    const store = makeStore();
    const service = createFoundationService(store);
    const bootstrap = await service.bootstrapTenant(bootstrapInput);
    store.state.auditEvents[2] = { ...store.state.auditEvents[2], payload: '{"tampered":true}' };

    await expect(service.verifyTenantAuditChain(bootstrap.tenant.id)).resolves.toEqual({
      valid: false,
      checked: 3,
      firstInvalidIndex: 2,
    });
  });

  it("keeps the public append method free of caller-supplied chain links", () => {
    expectTypeOf<Parameters<FoundationService["appendAuditEvent"]>[0]>().not.toHaveProperty("previousHash");
  });
});
