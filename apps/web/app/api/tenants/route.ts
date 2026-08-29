import {
  createDb,
  createDrizzleFoundationStore,
  createFoundationService,
  type AppDb,
  type TenantBootstrapResult,
} from "@attesta/db";
import type { NewTenantInput } from "@attesta/domain";
import { z } from "zod";
import { getDatabaseUrl, isSyntheticBootstrapEnabled } from "../../../lib/env";

export const runtime = "nodejs";

const tenantInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  siteName: z.string().trim().min(1).max(120),
  workerName: z.string().trim().min(1).max(120),
  participantName: z.string().trim().min(1).max(120),
}).strict();

const MAX_REQUEST_BYTES = 16 * 1024;

export type FoundationServiceLike = {
  bootstrapTenant(input: NewTenantInput): Promise<TenantBootstrapResult>;
};

type DatabaseHandle = {
  close(): Promise<unknown>;
};

export type DefaultPostHandlerDependencies = {
  getDatabaseUrl?: typeof getDatabaseUrl;
  createDb?: (databaseUrl: string) => DatabaseHandle;
  createService?: (db: DatabaseHandle) => FoundationServiceLike;
};

function responseBody(result: TenantBootstrapResult) {
  return {
    tenant: { id: result.tenant.id, name: result.tenant.name },
    site: { id: result.site.id, name: result.site.name },
    worker: { id: result.worker.id, name: result.worker.name },
    participant: { id: result.participant.id, name: result.participant.name },
  };
}

function isDomainValidationError(error: unknown): boolean {
  return error instanceof Error && /^(Tenant|Site|Worker|Participant) name is required$|^Invalid tenant ID$/.test(error.message);
}

function invalidRequestResponse(): Response {
  return Response.json({ error: "Invalid request" }, { status: 400 });
}

function serviceFailureResponse(error: unknown): Response {
  if (isDomainValidationError(error)) {
    return invalidRequestResponse();
  }

  return Response.json({ error: "Service unavailable" }, { status: 503 });
}

function disabledResponse(): Response {
  return Response.json({ error: "Not found" }, { status: 404 });
}

type ParsedTenantInput = { input: NewTenantInput } | { response: Response };

async function readBodyWithinLimit(request: Request): Promise<string | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > MAX_REQUEST_BYTES) {
    return null;
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function parseTenantInput(request: Request): Promise<ParsedTenantInput> {
  let body: string | null;
  try {
    body = await readBodyWithinLimit(request);
  } catch {
    return { response: invalidRequestResponse() };
  }
  if (body === null) return { response: Response.json({ error: "Request too large" }, { status: 413 }) };

  try {
    return { input: tenantInputSchema.parse(JSON.parse(body)) };
  } catch {
    return { response: invalidRequestResponse() };
  }
}

export function createPostHandler(service: FoundationServiceLike) {
  return async function postTenant(request: Request): Promise<Response> {
    if (!isSyntheticBootstrapEnabled()) return disabledResponse();
    const parsed = await parseTenantInput(request);
    if ("response" in parsed) return parsed.response;

    try {
      const result = await service.bootstrapTenant(parsed.input);
      return Response.json(responseBody(result), { status: 201 });
    } catch (error) {
      return serviceFailureResponse(error);
    }
  };
}

function defaultCreateService(db: DatabaseHandle): FoundationServiceLike {
  return createFoundationService(createDrizzleFoundationStore(db as AppDb));
}

export function createDefaultPostHandler(
  dependencies: DefaultPostHandlerDependencies = {},
) {
  const resolveDatabaseUrl = dependencies.getDatabaseUrl ?? getDatabaseUrl;
  const createDatabase = dependencies.createDb ?? ((databaseUrl: string) => createDb(databaseUrl));
  const createService = dependencies.createService ?? defaultCreateService;

  return async function postTenant(request: Request): Promise<Response> {
    if (!isSyntheticBootstrapEnabled()) return disabledResponse();
    const parsed = await parseTenantInput(request);
    if ("response" in parsed) return parsed.response;

    let db: DatabaseHandle | undefined;
    try {
      db = createDatabase(resolveDatabaseUrl());
      const result = await createService(db).bootstrapTenant(parsed.input);
      return Response.json(responseBody(result), { status: 201 });
    } catch (error) {
      return serviceFailureResponse(error);
    } finally {
      if (db) {
        try {
          await db.close();
        } catch {
          // A failed cleanup must not replace the safe response above.
        }
      }
    }
  };
}

export async function POST(request: Request): Promise<Response> {
  return createDefaultPostHandler()(request);
}
