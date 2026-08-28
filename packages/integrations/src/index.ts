export type NotificationRequest = Readonly<{
  channel: "email";
  recipientAddress: string;
  templateName: string;
  variables: Readonly<Record<string, string>>;
  applicationReference: string;
}>;

export type NotificationResult = Readonly<{
  status: "noop";
  applicationReference: string;
}>;

export type NotificationAdapter = {
  send(request: NotificationRequest): Promise<NotificationResult>;
};

export function createNoopNotificationAdapter(): NotificationAdapter {
  return {
    async send(request) {
      return { status: "noop", applicationReference: request.applicationReference };
    },
  };
}

export type AiAuditMetadata = Readonly<{
  model: string;
  provider: string;
  version: string;
  promptHash: string;
  outputHash: string;
  approver: string;
}>;

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

export function createAiAuditMetadata(input: AiAuditMetadata): AiAuditMetadata {
  for (const field of ["model", "provider", "version", "approver"] as const) {
    if (!input[field].trim()) throw new Error(`${field} is required`);
  }
  for (const field of ["promptHash", "outputHash"] as const) {
    if (!SHA256_PATTERN.test(input[field])) throw new Error(`${field} must be a SHA-256 hash`);
  }
  return Object.freeze({ ...input });
}

export type WorkOSIdentityReference = Readonly<{
  provider: "workos";
  subject: string;
}>;

export function createWorkOSIdentityReference(input: { subject: string }): WorkOSIdentityReference {
  if (!input.subject.trim()) throw new Error("subject is required");
  return Object.freeze({ provider: "workos", subject: input.subject });
}

export type IntegrationAdapter = {
  readonly name: string;
};
