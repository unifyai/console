/**
 * Organization-related Orchestra API calls
 *
 * This file consolidates all direct Orchestra calls for organizations,
 * teams, roles, and resource access.
 * Uses the typed OpenAPI client for type-safe API calls.
 */

import { cookies } from 'next/headers';
import {
  Organization,
  OrganizationMember,
  OrganizationRole,
  OrganizationListResponse,
  OrganizationInviteListResponse,
  UserOrganizationCheckResult,
} from '@/types/organization';
import { Team } from '@/types/team';
import { Role, Permission } from '@/types/role';
import {
  ResourceAccessGrant,
  ResourceAccessRevoke,
  ResourceAccessUpdate,
  ResourceAccessResponse,
  ResourceAccessListResponse,
} from '@/types/resource';
import { ResponseProps } from '@/types/common';
import { createOrchestraClient } from '@/lib/orchestra/client';
import { snakeToCamelObject } from '@/utils/casing';

const backendUrl = `${process.env.ORCHESTRA_URL}/v0`;
const adminKey = process.env.ORCHESTRA_ADMIN_KEY;

// Helper for admin endpoints that aren't in the public OpenAPI spec
const safeFetch = async (url: string, options: RequestInit, context: string): Promise<unknown> => {
  try {
    const response = await fetch(url, options);

    if (response.status === 204) {
      return;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        const errorMessage =
          data.detail || data.error || `Operation failed: ${response.statusText}`;
        return { detail: errorMessage, status: response.status };
      }
      return snakeToCamelObject(data as Record<string, unknown>);
    }

    if (!response.ok) return { detail: response.statusText, status: response.status };
    return {};
  } catch (error) {
    console.error(`[orchestra/api/organization ${context}] Network/System Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage, status: 500 };
  }
};

// =============================================================================
// Organization Functions
// =============================================================================

export const createOrganizationAction = async (apiKey: string) => {
  return async (name: string): Promise<Organization | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.POST('/v0/organizations', {
      body: { name } as never,
    });

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to create organization',
        status: response?.status || 500,
      };
    }

    return data as unknown as Organization;
  };
};

export const updateOrganizationAction = async (apiKey: string) => {
  return async (
    orgId: number,
    name: string,
    timezone?: string | null
  ): Promise<Organization | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);

    // Build the update body, only including fields that are provided
    const body: { name?: string; timezone?: string | null } = {};
    if (name) body.name = name;
    if (timezone !== undefined) body.timezone = timezone;

    const { data, error, response } = await client.PATCH('/v0/organizations/{organization_id}', {
      params: { path: { organization_id: orgId } },
      body: body as never,
    });

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to update organization',
        status: response?.status || 500,
      };
    }

    return data as unknown as Organization;
  };
};

export const deleteOrganizationAction = async (apiKey: string) => {
  return async (orgId: number): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.DELETE('/v0/organizations/{organization_id}', {
      params: { path: { organization_id: orgId } },
    });

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to delete organization',
        status: response?.status || 500,
      };
    }

    return;
  };
};

export const getMembersAction = async (apiKey: string) => {
  return async (orgId: number): Promise<OrganizationMember[] | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.GET(
      '/v0/organizations/{organization_id}/members',
      {
        params: { path: { organization_id: orgId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to get members',
        status: response?.status || 500,
      };
    }

    return data as unknown as OrganizationMember[];
  };
};

export const inviteMemberAction = async (apiKey: string) => {
  return async (orgId: number, email: string, roleId?: number): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.POST('/v0/organizations/{organization_id}/invites', {
      params: { path: { organization_id: orgId } },
      body: { email, role_id: roleId } as never,
    });

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to invite member',
        status: response?.status || 500,
      };
    }

    return;
  };
};

export const acceptInviteAction = async (apiKey: string) => {
  return async (token: string): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.POST('/v0/invites/{token}/accept', {
      params: { path: { token } },
    });

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to accept invite',
        status: response?.status || 500,
      };
    }

    const responseData = data as unknown as Record<string, unknown>;
    if (responseData && responseData.organizationId) {
      cookies().set('unify_workspace_id', String(responseData.organizationId), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
    }

    return;
  };
};

export const getInvitesAction = async (apiKey: string) => {
  return async (orgId: number): Promise<OrganizationInviteListResponse | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.GET(
      '/v0/organizations/{organization_id}/invites',
      {
        params: { path: { organization_id: orgId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to get invites',
        status: response?.status || 500,
      };
    }

    return data as unknown as OrganizationInviteListResponse;
  };
};

export const cancelInviteAction = async (apiKey: string) => {
  return async (orgId: number, inviteId: string): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.DELETE(
      '/v0/organizations/{organization_id}/invites/{invite_id}',
      {
        params: { path: { organization_id: orgId, invite_id: inviteId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to cancel invite',
        status: response?.status || 500,
      };
    }

    return;
  };
};

export const removeMemberAction = async (apiKey: string) => {
  return async (orgId: number, userId: string): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.DELETE(
      '/v0/organizations/{organization_id}/members/{user_id}',
      {
        params: { path: { organization_id: orgId, user_id: userId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to remove member',
        status: response?.status || 500,
      };
    }

    return;
  };
};

export const getOrganizationRolesAction = async (apiKey: string) => {
  return async (orgId: number): Promise<OrganizationRole[] | ResponseProps> => {
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
        detail:
          ((error as Record<string, unknown>)?.detail as string) ||
          'Failed to get organization roles',
        status: response?.status || 500,
      };
    }

    return data as unknown as OrganizationRole[];
  };
};

export const updateMemberRoleAction = async (apiKey: string) => {
  return async (orgId: number, userId: string, roleId: number): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.PATCH(
      '/v0/organizations/{organization_id}/members/{member_user_id}/role',
      {
        params: { path: { organization_id: orgId, member_user_id: userId } },
        body: { role_id: roleId } as never,
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to update role',
        status: response?.status || 500,
      };
    }

    return;
  };
};

export const transferOwnershipAction = async (apiKey: string) => {
  return async (orgId: number, newOwnerId: string): Promise<Organization | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.POST(
      '/v0/organizations/{organization_id}/transfer-ownership',
      {
        params: { path: { organization_id: orgId } },
        body: { new_owner_id: newOwnerId } as never,
      }
    );

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to transfer ownership',
        status: response?.status || 500,
      };
    }

    return data as unknown as Organization;
  };
};

// Admin endpoints - these use raw fetch because they're not in the public OpenAPI spec
export const getAllOrganizationsAction = async () => {
  return async (nameFilter?: string): Promise<OrganizationListResponse | ResponseProps> => {
    'use server';
    const query = nameFilter ? `?name=${encodeURIComponent(nameFilter)}` : '';

    return safeFetch(
      `${backendUrl}/admin/organizations${query}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
      },
      'getAllOrganizations'
    ) as Promise<OrganizationListResponse | ResponseProps>;
  };
};

export const checkUserOrganizationAction = async () => {
  return async (email: string): Promise<UserOrganizationCheckResult | ResponseProps> => {
    'use server';
    try {
      const result = (await safeFetch(
        `${backendUrl}/admin/user/by-email?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            accept: 'application/json',
            Authorization: `Bearer ${adminKey}`,
          },
        },
        'checkUserOrganization'
      )) as Record<string, unknown>;

      if (!result || 'detail' in result) {
        return { isInOrganization: false };
      }

      const orgs = result.organizations as Array<{ name: string }> | undefined;
      const hasOrganizations = orgs && orgs.length > 0;

      return {
        isInOrganization: hasOrganizations,
        organizationName: hasOrganizations ? orgs[0].name : undefined,
      };
    } catch (error) {
      console.error('Failed to check user organization:', error);
      return { isInOrganization: false };
    }
  };
};

// =============================================================================
// Role Functions
// =============================================================================

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

// =============================================================================
// Team Functions
// =============================================================================

export const createTeamAction =
  (apiKey: string) =>
  async (orgId: number, name: string, description?: string): Promise<Team | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.POST(
      '/v0/organizations/{organization_id}/teams',
      {
        params: { path: { organization_id: orgId } },
        body: { name, description } as never,
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to create team',
        status: response?.status || 500,
      };
    }

    return data as unknown as Team;
  };

export const updateTeamAction =
  (apiKey: string) =>
  async (
    orgId: number,
    teamId: number,
    name: string,
    description?: string
  ): Promise<Team | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.PATCH(
      '/v0/organizations/{organization_id}/teams/{team_id}',
      {
        params: { path: { organization_id: orgId, team_id: teamId } },
        body: { name, description } as never,
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to update team',
        status: response?.status || 500,
      };
    }

    return data as unknown as Team;
  };

export const getTeamsAction =
  (apiKey: string) =>
  async (orgId: number): Promise<Team[] | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.GET(
      '/v0/organizations/{organization_id}/teams',
      {
        params: { path: { organization_id: orgId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to get teams',
        status: response?.status || 500,
      };
    }

    return data as unknown as Team[];
  };

export const getTeamDetailsAction =
  (apiKey: string) =>
  async (orgId: number, teamId: number): Promise<Team | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.GET(
      '/v0/organizations/{organization_id}/teams/{team_id}',
      {
        params: { path: { organization_id: orgId, team_id: teamId } },
      }
    );

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to get team details',
        status: response?.status || 500,
      };
    }

    return data as unknown as Team;
  };

export const deleteTeamAction =
  (apiKey: string) =>
  async (orgId: number, teamId: number): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.DELETE(
      '/v0/organizations/{organization_id}/teams/{team_id}',
      {
        params: { path: { organization_id: orgId, team_id: teamId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to delete team',
        status: response?.status || 500,
      };
    }

    return;
  };

export const addTeamMemberAction =
  (apiKey: string) =>
  async (orgId: number, teamId: number, userId: string): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.POST(
      '/v0/organizations/{organization_id}/teams/{team_id}/members',
      {
        params: { path: { organization_id: orgId, team_id: teamId } },
        body: { user_ids: [userId] } as never,
      }
    );

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to add team member',
        status: response?.status || 500,
      };
    }

    return;
  };

export const removeTeamMemberAction =
  (apiKey: string) =>
  async (orgId: number, teamId: number, userId: string): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.DELETE(
      '/v0/organizations/{organization_id}/teams/{team_id}/members/{user_id_to_remove}',
      {
        params: { path: { organization_id: orgId, team_id: teamId, user_id_to_remove: userId } },
      }
    );

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to remove team member',
        status: response?.status || 500,
      };
    }

    return;
  };

// =============================================================================
// Resource Access Functions
// =============================================================================

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
