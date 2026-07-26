/**
 * Client-side API functions for the default-model catalog.
 */

import { DefaultModelOption } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';

export type ModelCatalogUsage = 'actor' | 'slow_brain';

export async function fetchDefaultModelOptions(
  usage: ModelCatalogUsage = 'actor'
): Promise<DefaultModelOption[] | ResponseProps> {
  try {
    const params = new URLSearchParams({ usage });
    const res = await fetch(`/api/assistant/default-model-options?${params}`);
    const data = await res.json();

    if (!res.ok) {
      return { detail: data?.detail || 'Failed to fetch default model options' };
    }
    return data;
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Failed to fetch default model options',
    };
  }
}

export async function searchDefaultModelOptions(
  query: string,
  usage: ModelCatalogUsage = 'actor',
  limit = 50
): Promise<DefaultModelOption[] | ResponseProps> {
  try {
    const params = new URLSearchParams({
      usage,
      q: query,
      limit: String(limit),
    });
    const res = await fetch(`/api/assistant/default-model-options/search?${params}`);
    const data = await res.json();

    if (!res.ok) {
      return { detail: data?.detail || 'Failed to search default model options' };
    }
    return data;
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Failed to search default model options',
    };
  }
}
