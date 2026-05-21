import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, getPersonalApiKeyFromRequest, unauthorized } from '../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';
import { snakeToCamelObject } from '@/utils/casing';

function unwrapInfoPayload(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'info' in payload) {
    return (payload as { info: unknown }).info;
  }
  return payload;
}

function asInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

function readAgentId(row: unknown): number | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  return asInteger(record.agentId ?? record.agent_id);
}

function readAssistantUserId(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const value = record.userId ?? record.user_id;
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

function readOrganizationId(row: unknown): number | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  return asInteger(record.organizationId ?? record.organization_id);
}

function readIsCoordinator(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  const record = row as Record<string, unknown>;
  return record.isCoordinator === true || record.is_coordinator === true;
}

function readUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const value = record.userId ?? record.user_id;
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

function mergePersonalCoordinator(assistants: unknown[], personalCoordinator: unknown): unknown[] {
  const coordinatorAgentId = readAgentId(personalCoordinator);
  if (!coordinatorAgentId) return assistants;

  return [
    personalCoordinator,
    ...assistants.filter((assistant) => readAgentId(assistant) !== coordinatorAgentId),
  ];
}

function normalizePersonalCoordinatorRow(row: unknown): unknown {
  if (!row || typeof row !== 'object') return row;
  return snakeToCamelObject(row);
}

async function fetchPersonalCoordinatorRow(
  request: NextRequest,
  includeDemo: boolean
): Promise<unknown | null> {
  const personalApiKey = await getPersonalApiKeyFromRequest(request);
  if (!personalApiKey) return null;

  const orchestraBaseUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';
  const requestHeaders = {
    Authorization: `Bearer ${personalApiKey}`,
    'Content-Type': 'application/json',
  };

  const basicInfoResponse = await fetch(`${orchestraBaseUrl}/v0/user/basic-info`, {
    method: 'GET',
    headers: requestHeaders,
  });
  if (!basicInfoResponse.ok) return null;

  const basicInfoPayload = await basicInfoResponse.json();
  const userId = readUserId(basicInfoPayload);
  if (!userId) return null;

  const assistantParams = new URLSearchParams({ list_all_org: 'true' });
  if (includeDemo) {
    assistantParams.set('demo', 'true');
  }

  const assistantsResponse = await fetch(
    `${orchestraBaseUrl}/v0/assistant?${assistantParams.toString()}`,
    {
      method: 'GET',
      headers: requestHeaders,
    }
  );
  if (!assistantsResponse.ok) return null;

  const assistantsPayload = await assistantsResponse.json();
  const assistantRows = unwrapInfoPayload(assistantsPayload);
  if (!Array.isArray(assistantRows) || assistantRows.length === 0) return null;

  const personalCoordinator = assistantRows
    .map(normalizePersonalCoordinatorRow)
    .find(
      (assistant) =>
        readIsCoordinator(assistant) &&
        readOrganizationId(assistant) === null &&
        readAssistantUserId(assistant) === userId
    );

  return personalCoordinator ?? null;
}

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const listAllOrg = request.nextUrl.searchParams.get('list_all_org');
  const demo = request.nextUrl.searchParams.get('demo');
  const includePersonalCoordinator =
    request.nextUrl.searchParams.get('include_personal_coordinator') === 'true';

  try {
    const { data, error, response } = await client.GET('/v0/assistant', {
      params: {
        query: {
          list_all_org: listAllOrg === 'true' ? true : undefined,
          demo: demo === 'true' ? true : undefined,
        },
      },
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    // Orchestra wraps list responses in { info: [...] }, unwrap for cleaner client API.
    let responseData = unwrapInfoPayload(data);
    if (includePersonalCoordinator && Array.isArray(responseData)) {
      try {
        const personalCoordinator = await fetchPersonalCoordinatorRow(request, demo === 'true');
        if (personalCoordinator) {
          responseData = mergePersonalCoordinator(responseData, personalCoordinator);
        }
      } catch (coordinatorError) {
        console.warn(
          '[API /api/assistant GET] Failed to inject personal coordinator row:',
          coordinatorError instanceof Error ? coordinatorError.message : coordinatorError
        );
      }
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (e: unknown) {
    console.error('[API /api/assistant GET] Error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ detail: 'Failed to connect to backend API' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const requestBody = await request.json();

  try {
    const { data, error, response } = await client.POST('/v0/assistant', {
      body: requestBody,
    });

    if (error) {
      console.error(
        `[API /api/assistant POST] Timestamp: ${new Date().toISOString()} - Orchestra API Error (${response.status}):`,
        error
      );
      return NextResponse.json(error, { status: response.status });
    }

    console.log(
      `[API /api/assistant POST] Timestamp: ${new Date().toISOString()} - Successfully proxied. Returning to client action.`
    );
    return NextResponse.json(data ?? { info: 'Operation successful' }, { status: response.status });
  } catch (e: unknown) {
    console.error(
      `[API /api/assistant POST] Timestamp: ${new Date().toISOString()} - Error fetching Orchestra API:`,
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      {
        error: 'Failed to connect to backend API',
        details: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
