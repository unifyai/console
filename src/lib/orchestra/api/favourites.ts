'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { Favourite } from '@/types/interfaces/grid';
import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * Favourites-related Orchestra API calls.
 *
 * Uses the typed OpenAPI client for type-safe API calls.
 */

export async function getFavourites(): Promise<Favourite[]> {
  const apiKey = await requireUserApiKey();
  const client = createOrchestraClient(apiKey);
  const { data, error } = await client.GET('/v0/project/favorites');

  if (error) {
    console.error('Error fetching favourites:', error);
    return [];
  }

  return data as unknown as Favourite[];
}

export async function createFavourite(
  projectName: string,
  icon: string,
  position: number
): Promise<Favourite> {
  const apiKey = await requireUserApiKey();
  if (!projectName || typeof projectName !== 'string') {
    throw new Error(`Invalid project name: ${projectName}`);
  }

  const resolvedIcon = !icon || typeof icon !== 'string' ? 'folder' : icon;
  const resolvedPosition = typeof position !== 'number' ? 0 : position;

  const client = createOrchestraClient(apiKey);
  const { data, error } = await client.POST('/v0/project/favorites', {
    body: {
      project_name: projectName,
      icon: resolvedIcon,
      position: resolvedPosition,
    } as never,
  });

  if (error) {
    console.error('Error in createFavourite:', error);
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to create favourite'
    );
  }

  return data as unknown as Favourite;
}

export async function updateFavourite(
  id: number,
  updates: { icon?: string; position?: number }
): Promise<Favourite> {
  const apiKey = await requireUserApiKey();
  const client = createOrchestraClient(apiKey);
  const { data, error } = await client.PATCH('/v0/project/favorites/{id}', {
    params: { path: { id } },
    body: updates as never,
  });

  if (error) {
    console.error('Error in updateFavourite:', error);
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to update favourite'
    );
  }

  return data as unknown as Favourite;
}

export async function deleteFavourite(id: number): Promise<boolean> {
  const apiKey = await requireUserApiKey();
  const client = createOrchestraClient(apiKey);
  const { error, response } = await client.DELETE('/v0/project/favorites/{id}', {
    params: { path: { id } },
  });

  if (error) {
    console.error('Error in deleteFavourite:', error);
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to delete favourite'
    );
  }

  return response?.ok ?? true;
}
