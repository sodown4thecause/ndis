export type NewTenantInput = {
  name: string;
  siteName: string;
  workerName: string;
  participantName: string;
};

export type TenantBootstrap = {
  tenant: { name: string };
  site: { name: string };
  worker: { name: string };
  participant: { name: string; preferredFormat: "plain-language" };
};

function requiredName(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export function createTenantBootstrap(input: NewTenantInput): TenantBootstrap {
  return {
    tenant: { name: requiredName(input.name, "Tenant name") },
    site: { name: requiredName(input.siteName, "Site name") },
    worker: { name: requiredName(input.workerName, "Worker name") },
    participant: {
      name: requiredName(input.participantName, "Participant name"),
      preferredFormat: "plain-language",
    },
  };
}
