'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { ResponseProps } from '@/types/common';
import { OAuthProvider } from '@/types/assistants/contact';
import {
  WorkspaceFileNode,
  WorkspaceFilePolicy,
  WorkspaceFileDecision,
} from '@/types/assistants/workspace-files';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';

/**
 * Server actions for the workspace file-access allowlist.
 *
 * Each proxies to `/api/assistant/[id]/workspace-files/*`, which uses
 * `getOrchestraUserClient` (auto camelCase). Responses are wrapped in `info`.
 */

const base = () => getInternalApiBaseUrl();

function buildQuery(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export async function listWorkspaceFileRoots(
  assistantId: string,
  provider: OAuthProvider
): Promise<WorkspaceFileNode[] | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const query = buildQuery({ provider });
    const response = await fetch(
      `${base()}/api/assistant/${assistantId}/workspace-files/roots?${query}`,
      { method: 'GET', headers: { apiKey } }
    );
    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to list drives: ${response.statusText}` };
    }
    return (data.info?.items ?? []) as WorkspaceFileNode[];
  } catch (error) {
    console.error('[workspace-files listWorkspaceFileRoots] Error:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error listing drives.' };
  }
}

export async function listWorkspaceFileChildren(
  assistantId: string,
  provider: OAuthProvider,
  driveId: string,
  itemId: string
): Promise<WorkspaceFileNode[] | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const query = buildQuery({ provider, driveId, itemId });
    const response = await fetch(
      `${base()}/api/assistant/${assistantId}/workspace-files/children?${query}`,
      { method: 'GET', headers: { apiKey } }
    );
    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to list files: ${response.statusText}` };
    }
    return (data.info?.items ?? []) as WorkspaceFileNode[];
  } catch (error) {
    console.error('[workspace-files listWorkspaceFileChildren] Error:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error listing files.' };
  }
}

export async function getWorkspaceFilePolicy(
  assistantId: string,
  provider: OAuthProvider
): Promise<WorkspaceFilePolicy | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const query = buildQuery({ provider });
    const response = await fetch(
      `${base()}/api/assistant/${assistantId}/workspace-files/policy?${query}`,
      { method: 'GET', headers: { apiKey } }
    );
    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to load policy: ${response.statusText}` };
    }
    return data.info as WorkspaceFilePolicy;
  } catch (error) {
    console.error('[workspace-files getWorkspaceFilePolicy] Error:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error loading policy.' };
  }
}

export async function updateWorkspaceFilePolicy(
  assistantId: string,
  provider: OAuthProvider,
  defaultAllow: boolean,
  decisions: WorkspaceFileDecision[]
): Promise<WorkspaceFilePolicy | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const query = buildQuery({ provider });
    const response = await fetch(
      `${base()}/api/assistant/${assistantId}/workspace-files/policy?${query}`,
      {
        method: 'PATCH',
        headers: { apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultAllow, decisions }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to save policy: ${response.statusText}` };
    }
    return data.info as WorkspaceFilePolicy;
  } catch (error) {
    console.error('[workspace-files updateWorkspaceFilePolicy] Error:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error saving policy.' };
  }
}
