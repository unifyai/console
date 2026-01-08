import { Role, Permission } from '@/types/role';
import { ResponseProps } from '@/types/common';
import { snakeToCamelObject } from '@/utils/casing';

const backendUrl = `${process.env.ORCHESTRA_URL}/v0`;

const safeFetch = async (url: string, options: RequestInit, context: string): Promise<any> => {
  try {
    const response = await fetch(url, options);
    if (response.status === 204) return {};
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        return { detail: data.detail || 'Operation failed', status: response.status };
      }
      // Transform snake_case response to camelCase
      return snakeToCamelObject(data);
    }
    if (!response.ok) return { detail: response.statusText, status: response.status };
    return {};
  } catch (error) {
    console.error(`[Roles] ${context} error:`, error);
    return { detail: 'Network error', status: 500 };
  }
};

const getHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  accept: 'application/json',
  Authorization: `Bearer ${apiKey}`,
});

export const getRolesAction =
  (apiKey: string) =>
  async (orgId: number): Promise<Role[] | ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/organizations/${orgId}/roles`,
      {
        method: 'GET',
        headers: getHeaders(apiKey),
      },
      'getRoles'
    );
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
    return safeFetch(
      `${backendUrl}/organizations/${orgId}/roles`,
      {
        method: 'POST',
        headers: getHeaders(apiKey),
        body: JSON.stringify({ name, description, permissionIds: permissionIds }), // API expects snake_case
      },
      'createRole'
    );
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
    return safeFetch(
      `${backendUrl}/organizations/${orgId}/roles/${roleId}`,
      {
        method: 'PATCH',
        headers: getHeaders(apiKey),
        body: JSON.stringify({ name, description }),
      },
      'updateRole'
    );
  };

export const deleteRoleAction =
  (apiKey: string) =>
  async (orgId: number, roleId: number): Promise<void | ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/organizations/${orgId}/roles/${roleId}`,
      {
        method: 'DELETE',
        headers: getHeaders(apiKey),
      },
      'deleteRole'
    );
  };

export const getAllPermissionsAction =
  (apiKey: string) => async (): Promise<Permission[] | ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/permissions`,
      {
        method: 'GET',
        headers: getHeaders(apiKey),
      },
      'getAllPermissions'
    );
  };

export const addPermissionsToRoleAction =
  (apiKey: string) =>
  async (orgId: number, roleId: number, permissionIds: number[]): Promise<Role | ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/organizations/${orgId}/roles/${roleId}/permissions`,
      {
        method: 'POST',
        headers: getHeaders(apiKey),
        body: JSON.stringify({ permissionIds: permissionIds }), // API expects snake_case
      },
      'addPermissionsToRole'
    );
  };

export const removePermissionFromRoleAction =
  (apiKey: string) =>
  async (orgId: number, roleId: number, permissionId: number): Promise<Role | ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/organizations/${orgId}/roles/${roleId}/permissions/${permissionId}`,
      {
        method: 'DELETE',
        headers: getHeaders(apiKey),
      },
      'removePermissionFromRole'
    );
  };
