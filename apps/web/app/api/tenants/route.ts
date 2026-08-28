import {
  createDb,
  createDrizzleFoundationStore,
  createFoundationService,
  type AppDb,
  type TenantBootstrapResult,
} from "@attesta/db";
import type { NewTenantInput } from "@attesta/domain";
import { z } from "zod";
import { getDatabaseUrl } from "../../../lib/env";

export const runtime = "nodejs";

const tenantInputSchema = z.object({
  name: z.string().trim().min(1),
  siteName: z.string().trim().min(1),
  workerName: z.string().trim().min(1),
  participantName: z.string().trim().min(1),
}).strict();

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

async function parseTenantInput(request: Request): Promise<NewTenantInput | null> {
  try {
    return tenantInputSchema.parse(await request.json());
  } catch {
    return null;
  }
}

export function createPostHandler(service: FoundationServiceLike) {
  return async function postTenant(request: Request): Promise<Response> {
    const input = await parseTenantInput(request);
    if (!input) return invalidRequestResponse();

    try {
      const result = await service.bootstrapTenant(input);
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
    const input = await parseTenantInput(request);
    if (!input) return invalidRequestResponse();

    let db: DatabaseHandle | undefined;
    try {
      db = createDatabase(resolveDatabaseUrl());
      const result = await createService(db).bootstrapTenant(input);
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
