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
      return {
        detail: data?.detail || `Failed to list assistants: ${res.statusText}`,
        status: res.status,
      } as ResponseProps;
    }
    return data;
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch assistants' };
  }
}

export async function fetchAssistantStatus(assistantId: string): Promise<AssistantStatus | null> {
  try {
    const res = await fetch(`/api/assistant/${assistantId}/status`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && 'running' in data ? (data as AssistantStatus) : null;
  } catch {
    return null;
  }
}

/**
 * Batch-fetches signed photo URLs for preset assistants.
 * Returns a map of "FirstName_Surname" → signed URL.
 */
export async function fetchPresetPhotoUrls(
  presets: { firstName: string; surname: string }[]
): Promise<Record<string, string>> {
  if (presets.length === 0) return {};
  try {
    const res = await fetch('/api/assistant/preset/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presets }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.urls ?? {};
  } catch {
    return {};
  }
}

/**
 * Batch-fetches signed URLs for arbitrary GCS media paths (photos/videos).
 * Accepts GCS URLs (gs://…) or raw object paths.
 * Returns a map of original path → signed URL.
 */
export async function fetchMediaSignedUrls(
  paths: string[],
  options?: {
    onDiagnostic?: (diagnostic: {
      pathCount: number;
      ok: boolean;
      status: number | null;
      returnedUrlCount: number;
      durationMs: number;
      error?: string;
    }) => void;
  }
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const startedAt = Date.now();
  try {
    const res = await fetch('/api/assistant/media/batch-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      options?.onDiagnostic?.({
        pathCount: paths.length,
        ok: false,
        status: res.status,
        returnedUrlCount: 0,
        durationMs: Date.now() - startedAt,
        error: 'non_ok_response',
      });
      return {};
    }
    const data = await res.json();
    const urls = data.urls ?? {};
    options?.onDiagnostic?.({
      pathCount: paths.length,
      ok: true,
      status: res.status,
      returnedUrlCount: Object.keys(urls).length,
      durationMs: Date.now() - startedAt,
    });
    return urls;
  } catch (error) {
    options?.onDiagnostic?.({
      pathCount: paths.length,
      ok: false,
      status: null,
      returnedUrlCount: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return {};
  }
}
