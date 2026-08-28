import { describe, expect, it } from "vitest";
import { verifyAuditChain, type AuditEvent } from "@attesta/domain";
import { createFoundationService, type FoundationTransaction, type FoundationStore } from "./foundation-service";

function makeStore(): FoundationStore & { events: AuditEvent[] } {
  let nextId = 1;
  const events: AuditEvent[] = [];
  const store: FoundationStore & { events: AuditEvent[] } = {
    events,
    async transaction<T>(operation: (tx: FoundationTransaction) => Promise<T>) {
      const snapshot = events.length;
      try {
        return await operation({
          async setTenantContext() {},
          async createTenant(name) {
            return { id: `tenant-${nextId++}`, name };
          },
          async createSite(tenantId, name) {
            return { id: `site-${nextId++}`, tenantId, name };
          },
          async createWorker(tenantId, siteId, name) {
            return { id: `worker-${nextId++}`, tenantId, siteId, name };
          },
          async createParticipant(tenantId, siteId, name, preferredFormat) {
            return { id: `participant-${nextId++}`, tenantId, siteId, name, preferredFormat };
          },
          async appendAuditEvent(event) {
            events.push({ previousHash: event.previousHash, payload: event.payload, eventHash: event.eventHash });
            return { id: `audit-${nextId++}`, ...event };
          },
        });
      } catch (error) {
        events.length = snapshot;
        throw error;
      }
    },
  };
  return store;
}

describe("foundation service", () => {
  it("creates a tenant bootstrap and a linked audit event for each record", async () => {
    const store = makeStore();
    const service = createFoundationService(store);

    const result = await service.bootstrapTenant({
      name: "Example SIL",
      siteName: "House 1",
      workerName: "Worker One",
      participantName: "Participant One",
    });

    expect(result.tenant.name).toBe("Example SIL");
    expect(result.site.tenantId).toBe(result.tenant.id);
    expect(result.worker.siteId).toBe(result.site.id);
    expect(result.participant.siteId).toBe(result.site.id);
    expect(result.auditEvents).toHaveLength(4);
    expect(verifyAuditChain(store.events)).toEqual({ valid: true, checked: 4, firstInvalidIndex: null });
  });

  it("rolls back audit writes when a transaction fails", async () => {
    const store = makeStore();
    const service = createFoundationService({
      async transaction(operation) {
        return store.transaction(async (tx) => {
          const result = await operation(tx);
          throw new Error("forced transaction failure");
        }).catch((error) => {
          throw error;
        });
      },
    });

    await expect(
      service.bootstrapTenant({
        name: "Example SIL",
        siteName: "House 1",
        workerName: "Worker One",
        participantName: "Participant One",
      }),
    ).rejects.toThrow("forced transaction failure");
    expect(store.events).toHaveLength(0);
  });
});
