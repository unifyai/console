/**
 * Favourites-related Orchestra API calls
 *
 * This file consolidates all direct Orchestra calls for user favourites.
 * Uses the typed OpenAPI client for type-safe API calls.
 */
'use server';

import { Favourite } from '@/types/interfaces/grid';
import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * Get all favourites for the current user
 */
export const getFavourites = async (apiKey: string): Promise<Favourite[]> => {
  'use server';

  const client = createOrchestraClient(apiKey);
  const { data, error } = await client.GET('/v0/project/favorites');

  if (error) {
    console.error('Error fetching favourites:', error);
    return [];
  }

  return data as unknown as Favourite[];
};

/**
 * Create a new favourite for the current user
 */
export const createFavourite = async (apiKey: string) => {
  return async (projectName: string, icon: string, position: number) => {
    'use server';

    // Validate inputs
    if (!projectName || typeof projectName !== 'string') {
      throw new Error(`Invalid project name: ${projectName}`);
    }

    if (!icon || typeof icon !== 'string') {
      icon = 'folder'; // Use default if invalid
    }

    if (typeof position !== 'number') {
      position = 0; // Use default if invalid
    }

    const client = createOrchestraClient(apiKey);
    const { data, error } = await client.POST('/v0/project/favorites', {
      body: {
        project_name: projectName,
        icon,
        position,
      } as never,
    });

    if (error) {
      console.error('Error in createFavourite:', error);
      throw new Error(
        ((error as Record<string, unknown>)?.detail as string) || 'Failed to create favourite'
      );
    }

    return data as unknown as Favourite;
  };
};

/**
 * Update an existing favourite
 */
export const updateFavourite = async (apiKey: string) => {
  return async (id: number, updates: { icon?: string; position?: number }) => {
    'use server';

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
  };
};

/**
 * Delete a favourite
 */
export const deleteFavourite = async (apiKey: string) => {
  return async (id: number) => {
    'use server';

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
  };
};
