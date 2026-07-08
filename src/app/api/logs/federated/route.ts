import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface FederatedContextSpec {
  context: string;
  source?: string;
  filter?: string;
  fromFields?: string[];
  excludeFields?: string[];
  projectName?: string;
}

interface FederatedLogsBody {
  projectName?: string;
  contexts?: FederatedContextSpec[];
  filter?: string;
  sorting?: Array<{ field: string; direction?: string; missing?: string }>;
  offset?: number;
  limit?: number;
  uniqueIdField?: string;
  annotate?: boolean;
  valueLimit?: number;
}

/**
 * Proxy for Orchestra's federated multi-context log read. One request reads
 * several contexts (personal root, team roots, …) and returns a single
 * globally-ordered window with an exact total, replacing client-side
 * cross-root pagination.
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as FederatedLogsBody | null;
  if (!body?.projectName || !Array.isArray(body.contexts) || body.contexts.length === 0) {
    return badRequest('projectName and a non-empty contexts array are required.');
  }

  const payload = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    project_name: body.projectName,
    contexts: body.contexts.map((spec) => ({
      context: spec.context,
      source: spec.source,
      filter: spec.filter,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      from_fields: spec.fromFields,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      exclude_fields: spec.excludeFields,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      project_name: spec.projectName,
    })),
    filter: body.filter,
    sorting: body.sorting ?? [],
    offset: body.offset ?? 0,
    limit: body.limit ?? 100,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    unique_id_field: body.uniqueIdField,
    annotate: body.annotate ?? true,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    value_limit: body.valueLimit,
  };

  try {
    const response = await fetch(`${ORCHESTRA_URL}/v0/logs/federated`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { error: (data as { detail?: string } | null)?.detail ?? 'Federated logs read failed' },
        { status: response.status }
      );
    }
    // Match /api/logs: Orchestra speaks snake_case, the frontend camelCase.
    return NextResponse.json(snakeToCamelObject(data as Record<string, unknown>));
  } catch (error) {
    console.error('[api/logs/federated] proxy error', error);
    return NextResponse.json({ error: 'Federated logs read failed' }, { status: 502 });
  }
}
