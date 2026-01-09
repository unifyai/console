import { Role, Permission } from '@/types/role';
import { ResponseProps } from '@/types/common';
import { createOrchestraClient } from '@/lib/orchestra/client';

export const getRolesAction =
  (apiKey: string) =>
  async (orgId: number): Promise<Role[] | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.GET(
      '/v0/organizations/{organization_id}/roles',
      {
        params: { path: { organization_id: orgId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to get roles',
        status: response?.status || 500,
      };
    }

    return data as unknown as Role[];
  };

export const createRoleAction =
  (apiKey: string) =>
  async (
    orgId: number,
    name: string,
    description: string,
    permissionIds: number[]
  ): Promise<Role | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.POST(
      '/v0/organizations/{organization_id}/roles',
      {
        params: { path: { organization_id: orgId } },
        body: { name, description, permission_ids: permissionIds } as never,
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to create role',
        status: response?.status || 500,
      };
    }

    return data as unknown as Role;
  };

export const updateRoleAction =
  (apiKey: string) =>
  async (
    orgId: number,
    roleId: number,
    name: string,
    description: string
  ): Promise<Role | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.PATCH(
      '/v0/organizations/{organization_id}/roles/{role_id}',
      {
        params: { path: { organization_id: orgId, role_id: roleId } },
        body: { name, description } as never,
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to update role',
        status: response?.status || 500,
      };
    }

    return data as unknown as Role;
  };

export const deleteRoleAction =
  (apiKey: string) =>
  async (orgId: number, roleId: number): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.DELETE(
      '/v0/organizations/{organization_id}/roles/{role_id}',
      {
        params: { path: { organization_id: orgId, role_id: roleId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to delete role',
        status: response?.status || 500,
      };
    }

    return;
  };

export const getAllPermissionsAction =
  (apiKey: string) => async (): Promise<Permission[] | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.GET('/v0/permissions');

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to get permissions',
        status: response?.status || 500,
      };
    }

    return data as unknown as Permission[];
  };

export const addPermissionsToRoleAction =
  (apiKey: string) =>
  async (orgId: number, roleId: number, permissionIds: number[]): Promise<Role | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.POST(
      '/v0/organizations/{organization_id}/roles/{role_id}/permissions',
      {
        params: { path: { organization_id: orgId, role_id: roleId } },
        body: { permission_ids: permissionIds } as never,
      }
    );

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) ||
          'Failed to add permissions to role',
        status: response?.status || 500,
      };
    }

    return data as unknown as Role;
  };

export const removePermissionFromRoleAction =
  (apiKey: string) =>
  async (orgId: number, roleId: number, permissionId: number): Promise<Role | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.DELETE(
      '/v0/organizations/{organization_id}/roles/{role_id}/permissions/{permission_id}',
      {
        params: {
          path: { organization_id: orgId, role_id: roleId, permission_id: permissionId },
        },
      }
    );

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) ||
          'Failed to remove permission from role',
        status: response?.status || 500,
      };
    }

    return data as unknown as Role;
  };
