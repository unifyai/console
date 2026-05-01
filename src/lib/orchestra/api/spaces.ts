/**
 * Read-only Orchestra API calls for spaces.
 */

import { createOrchestraClient } from '@/lib/orchestra/client';
import type { ResponseProps } from '@/types/common';
import type { Space, SpaceSummary } from '@/types/spaces/space';

type OrchestraGet = (
  path: string,
  init?: { params?: { path?: Record<string, string | number> } }
) => Promise<{ data?: unknown; error?: unknown; response?: Response }>;

function responseError(
  error: unknown,
  status?: number,
  fallback = 'Failed to load spaces'
): ResponseProps {
  return {
    detail: ((error as Record<string, unknown>)?.detail as string) || fallback,
    status: status || 500,
  };
}

function toSpaceSummary(space: Space | SpaceSummary): SpaceSummary {
  return {
    spaceId: space.spaceId,
    name: space.name,
    description: space.description,
    organizationId: space.organizationId,
    status: space.status,
  };
}

export async function listSpaces(apiKey: string): Promise<SpaceSummary[] | ResponseProps> {
  const client = createOrchestraClient(apiKey);
  const get = client.GET as unknown as OrchestraGet;
  const { data, error, response } = await get('/v0/spaces');

  if (error) {
    return responseError(error, response?.status, 'Failed to list spaces');
  }

  return (data as Space[]).map(toSpaceSummary);
}

export async function listSpacesForAssistant(
  apiKey: string,
  assistantId: number
): Promise<SpaceSummary[] | ResponseProps> {
  const client = createOrchestraClient(apiKey);
  const get = client.GET as unknown as OrchestraGet;
  const { data, error, response } = await get('/v0/assistants/{assistant_id}/spaces', {
    params: { path: { assistant_id: assistantId } },
  });

  if (error) {
    return responseError(error, response?.status, 'Failed to list assistant spaces');
  }

  return (data as SpaceSummary[]).map(toSpaceSummary);
}
