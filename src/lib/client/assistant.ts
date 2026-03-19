/**
 * Client-side API functions for assistant endpoints.
 *
 * These call the Next.js API routes directly via fetch(), which:
 *   - Authenticate via the session cookie (no API key in the browser)
 *   - Run in parallel (unlike server actions, which serialize on the client)
 *   - Proxy to Orchestra server-side using getApiKeyFromRequest()
 *
 * Usage: import from hooks or client components. Do NOT use in server
 * components or server actions — those should use the Orchestra client
 * or server-side libs directly.
 */

import { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';

export async function fetchAssistants(
  isOrgContext: boolean,
  includeDemo: boolean = true
): Promise<Assistant[] | ResponseProps> {
  try {
    const params = new URLSearchParams();
    if (isOrgContext) params.set('list_all_org', 'true');
    if (includeDemo) params.set('demo', 'true');

    const res = await fetch(`/api/assistant?${params}`);
    const data = await res.json();

    if (!res.ok) {
      return { detail: data?.detail || `Failed to list assistants: ${res.statusText}`, status: res.status } as ResponseProps;
    }
    return data;
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch assistants' };
  }
}

export async function fetchAssistantStatus(
  assistantId: string
): Promise<AssistantStatus | null> {
  try {
    const res = await fetch(`/api/assistant/${assistantId}/status`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && 'running' in data ? (data as AssistantStatus) : null;
  } catch {
    return null;
  }
}
