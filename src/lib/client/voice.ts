/**
 * Client-side API functions for voice endpoints.
 */

import { Voice } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';

export async function fetchVoices(): Promise<(Voice & { isPreset?: boolean })[] | ResponseProps> {
  try {
    const res = await fetch('/api/assistant/voice');
    const data = await res.json();

    if (!res.ok) {
      return { detail: data?.detail || 'Failed to fetch voices' };
    }
    return data;
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch voices' };
  }
}
