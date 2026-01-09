'use server';

import { ResponseProps } from '@/types/common';
import {
  ResourceAccessGrant,
  ResourceAccessRevoke,
  ResourceAccessUpdate,
  ResourceAccessResponse,
  ResourceAccessListResponse,
} from '@/types/resource';
import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * Grant access to a resource (project or org).
 * Only works for organizational resources.
 */
export const grantResourceAccessAction =
  (apiKey: string) =>
  async (
    resourceType: 'project' | 'org',
    resourceId: number,
    grantData: ResourceAccessGrant
  ): Promise<ResourceAccessResponse | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.POST(
      '/v0/resources/{resource_type}/{resource_id}/access',
      {
        params: { path: { resource_type: resourceType, resource_id: resourceId } },
        body: grantData as never,
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to grant access',
        status: response?.status || 500,
      };
    }

    return data as unknown as ResourceAccessResponse;
  };

/**
 * Revoke access to a resource (project or org).
 */
export const revokeResourceAccessAction =
  (apiKey: string) =>
  async (
    resourceType: 'project' | 'org',
    resourceId: number,
    revokeData: ResourceAccessRevoke
  ): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.DELETE(
      '/v0/resources/{resource_type}/{resource_id}/access',
      {
        params: { path: { resource_type: resourceType, resource_id: resourceId } },
        body: revokeData as never,
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to revoke access',
        status: response?.status || 500,
      };
    }

    return;
  };

/**
 * Update an existing resource access grant (change role).
 */
export const updateResourceAccessAction =
  (apiKey: string) =>
  async (
    resourceType: 'project' | 'org',
    resourceId: number,
    accessId: number,
    updateData: ResourceAccessUpdate
  ): Promise<ResourceAccessResponse | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.PATCH(
      '/v0/resources/{resource_type}/{resource_id}/access/{access_id}',
      {
        params: {
          path: { resource_type: resourceType, resource_id: resourceId, access_id: accessId },
        },
        body: updateData as never,
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to update access',
        status: response?.status || 500,
      };
    }

    return data as unknown as ResourceAccessResponse;
  };

/**
 * List all access entries for a resource (project or org).
 */
export const listResourceAccessAction =
  (apiKey: string) =>
  async (
    resourceType: 'project' | 'org',
    resourceId: number
  ): Promise<ResourceAccessListResponse | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.GET(
      '/v0/resources/{resource_type}/{resource_id}/access',
      {
        params: { path: { resource_type: resourceType, resource_id: resourceId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to list access',
        status: response?.status || 500,
      };
    }

    return data as unknown as ResourceAccessListResponse;
  };
