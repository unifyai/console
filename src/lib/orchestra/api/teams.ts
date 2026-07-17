/**
 * Read-only Orchestra API calls for organization team shared brain.
 */

import { createOrchestraClient } from '@/lib/orchestra/client';
import type { ResponseProps } from '@/types/common';
import type { SharedTeamSummary } from '@/types/teams/sharedTeam';

type OrchestraGet = (
  path: string,
  init?: { params?: { path?: Record<string, string | number> } }
) => Promise<{ data?: unknown; error?: unknown; response?: Response }>;

function responseError(
  error: unknown,
  status?: number,
  fallback = 'Failed to load teams'
): ResponseProps {
  return {
    detail: ((error as Record<string, unknown>)?.detail as string) || fallback,
    status: status || 500,
  };
}

function toSharedTeamSummary(team: Record<string, unknown>): SharedTeamSummary {
  const teamId = Number(team.teamId ?? team.team_id ?? team.id);
  const isOrgWideSharing = Boolean(team.isOrgWideSharing ?? team.is_org_wide_sharing);
  const image =
    typeof team.image === 'string'
      ? team.image
      : ((team.image as string | null | undefined) ?? null);
  return {
    teamId,
    name: String(team.name ?? ''),
    description: (team.description as string | null | undefined) ?? null,
    organizationId: (team.organizationId as number | null | undefined) ?? null,
    status: (team.status as SharedTeamSummary['status']) ?? undefined,
    isOrgWideSharing: isOrgWideSharing || undefined,
    image,
  };
}

export async function listTeamsForAssistant(
  apiKey: string,
  assistantId: number
): Promise<SharedTeamSummary[] | ResponseProps> {
  const client = createOrchestraClient(apiKey);
  const get = client.GET as unknown as OrchestraGet;
  const { data, error, response } = await get('/v0/assistants/{assistant_id}/teams', {
    params: { path: { assistant_id: assistantId } },
  });

  if (error) {
    return responseError(error, response?.status, 'Failed to list assistant teams');
  }

  return (data as Record<string, unknown>[]).map(toSharedTeamSummary);
}
