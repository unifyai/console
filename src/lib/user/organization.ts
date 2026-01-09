import { cookies } from 'next/headers';
import {
  Organization,
  OrganizationMember,
  OrganizationRole,
  OrganizationListResponse,
  OrganizationInviteListResponse,
  UserOrganizationCheckResult,
} from '@/types/organization';
import { ResponseProps } from '@/types/common';
import { createOrchestraClient } from '@/lib/orchestra/client';
import { snakeToCamelObject } from '@/utils/casing';

const backendUrl = `${process.env.ORCHESTRA_URL}/v0`;
const adminKey = process.env.ORCHESTRA_ADMIN_KEY;

// Helper for admin endpoints that aren't in the public OpenAPI spec
const safeFetch = async (url: string, options: RequestInit, context: string): Promise<unknown> => {
  try {
    const response = await fetch(url, options);

    // Handle 204 No Content explicitly
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
    console.error(`[actions.ts ${context}] Network/System Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage, status: 500 };
  }
};

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
  return async (orgId: number, name: string): Promise<Organization | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.PATCH('/v0/organizations/{organization_id}', {
      params: { path: { organization_id: orgId } },
      body: { name } as never,
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

    // Set cookie if organization ID is returned
    const responseData = data as unknown as Record<string, unknown>;
    if (responseData && responseData.organizationId) {
      cookies().set('unify_workspace_id', String(responseData.organizationId), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
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

export const updateRoleAction = async (apiKey: string) => {
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
      // Use admin endpoint to fetch user by email
      const result = (await safeFetch(
        `${backendUrl}/admin/auth-user/by-email?email=${encodeURIComponent(email)}`,
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

      // If error or user not found, assume they're not in an organization
      if (!result || 'detail' in result) {
        return { isInOrganization: false };
      }

      // Check if user has organizations
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
