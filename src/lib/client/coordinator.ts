/**
 * Client-side API functions for Coordinator endpoints.
 */

import { ResponseProps } from '@/types/common';

export interface CoordinatorTranscriptSeedResult {
  logEventId: number;
}

export async function seedCoordinatorOpener(
  coordinatorId: string | number,
  content: string
): Promise<CoordinatorTranscriptSeedResult | ResponseProps> {
  try {
    const res = await fetch('/api/coordinator-transcript-seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinatorId: String(coordinatorId), content }),
    });
    const contentType = res.headers.get('content-type');
    const data = contentType?.includes('application/json') ? await res.json() : {};

    if (!res.ok) {
      return {
        detail:
          data?.detail || data?.error || `Failed to seed Coordinator opener: ${res.statusText}`,
        status: res.status,
      };
    }

    return data as CoordinatorTranscriptSeedResult;
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Failed to seed Coordinator opener',
    };
  }
}
