'use server';

import { isUnifyStaffMember } from '@/lib/auth/unify-staff';
import { requireUserApiKey } from '@/lib/server-action-session';
import { getCurrentUser } from '@/lib/user/user';
import { writeActiveWorkspaceId } from '@/lib/user/workspace-session';
/**
 * Organization-related Orchestra API calls
 *
 * This file consolidates all direct Orchestra calls for organizations,
 * teams, roles, and resource access.
 * Uses the typed OpenAPI client for type-safe API calls.
 */

import { cookies } from 'next/headers';
import {
  DataSharingMode,
  Organization,
  OrganizationMember,
  OrganizationRole,
  OrganizationListResponse,
  OrganizationInviteListResponse,
  OrgSharingSettings,
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
import { formatValidationDetail } from '@/utils/orchestra-error';

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
          formatValidationDetail(data.detail) ||
          data.error ||
          `Operation failed: ${response.statusText}`;
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

export async function createOrganizationAction(
  name: string,
  dataSharingMode: DataSharingMode = 'shared'
): Promise<Organization | ResponseProps> {
  const apiKey = await requireUserApiKey();
  return safeFetch(
    `${backendUrl}/organizations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ name, data_sharing_mode: dataSharingMode }),
    },
    'createOrganization'
  ) as Promise<Organization | ResponseProps>;
}

export async function createOrgAction(
  name: string,
  dataSharingMode: DataSharingMode = 'shared'
): Promise<Organization | ResponseProps> {
  const user = await getCurrentUser();
  if (!user?.apiKey) {
    return { detail: 'Unauthorized', status: 401 };
  }
  const isUnifyMember = isUnifyStaffMember(user.email, user.organizations);
  if (isUnifyMember) {
    return adminCreateOrganizationAction(user.id, name, dataSharingMode);
  }
  return createOrganizationAction(name, dataSharingMode);
}

export async function updateOrganizationAction(
  orgId: number,
  name: string,
  timezone?: string | null
): Promise<Organization | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function deleteOrganizationAction(orgId: number): Promise<void | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function getMembersAction(
  orgId: number
): Promise<OrganizationMember[] | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function inviteMemberAction(
  orgId: number,
  email: string,
  roleId?: number
): Promise<void | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export interface AcceptInviteResult {
  success: true;
  organizationName?: string;
  mfaSetupRequired?: boolean;
}

export async function acceptInviteAction(
  token: string
): Promise<AcceptInviteResult | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
    const cookieStore = await cookies();
    cookieStore.set('unify_workspace_id', String(responseData.organizationId), {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });
    await writeActiveWorkspaceId(String(responseData.organizationId));
  }

  return {
    success: true as const,
    organizationName: (responseData?.organizationName as string) ?? undefined,
    mfaSetupRequired: responseData?.mfaSetupRequired === true,
  };
}

export async function getInvitesAction(
  orgId: number
): Promise<OrganizationInviteListResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function cancelInviteAction(
  orgId: number,
  inviteId: string
): Promise<void | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function removeMemberAction(
  orgId: number,
  userId: string
): Promise<void | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function getOrganizationRolesAction(
  orgId: number
): Promise<OrganizationRole[] | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const client = createOrchestraClient(apiKey);
  const { data, error, response } = await client.GET('/v0/organizations/{organization_id}/roles', {
    params: { path: { organization_id: orgId } },
  });

  if (error) {
    return {
      detail:
        ((error as Record<string, unknown>)?.detail as string) ||
        'Failed to get organization roles',
      status: response?.status || 500,
    };
  }

  return data as unknown as OrganizationRole[];
}

export async function updateMemberRoleAction(
  orgId: number,
  userId: string,
  roleId: number
): Promise<void | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function transferOwnershipAction(
  orgId: number,
  newOwnerId: string
): Promise<Organization | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function adminCreateOrganizationAction(
  creatorUserId: string,
  name: string,
  dataSharingMode: DataSharingMode = 'shared'
): Promise<Organization | ResponseProps> {
  return safeFetch(
    `${backendUrl}/admin/organizations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify({
        name,
        creator_user_id: creatorUserId,
        data_sharing_mode: dataSharingMode,
      }),
    },
    'adminCreateOrganization'
  ) as Promise<Organization | ResponseProps>;
}

// Admin endpoints - these use raw fetch because they're not in the public OpenAPI spec
export async function getAllOrganizationsAction(
  nameFilter?: string
): Promise<OrganizationListResponse | ResponseProps> {
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
}

export async function checkUserOrganizationAction(
  email: string
): Promise<UserOrganizationCheckResult | ResponseProps> {
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
    const isUnifyEmployee = isUnifyStaffMember(email, orgs);
    const hasOrganizations = !isUnifyEmployee && orgs && orgs.length > 0;

    return {
      isInOrganization: hasOrganizations,
      organizationName: hasOrganizations ? orgs[0].name : undefined,
    };
  } catch (error) {
    console.error('Failed to check user organization:', error);
    return { isInOrganization: false };
  }
}

// =============================================================================
// Role Functions
// =============================================================================

export async function getRolesAction(orgId: number): Promise<Role[] | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const client = createOrchestraClient(apiKey);
  const { data, error, response } = await client.GET('/v0/organizations/{organization_id}/roles', {
    params: { path: { organization_id: orgId } },
  });

  if (error) {
    return {
      detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to get roles',
      status: response?.status || 500,
    };
  }

  return data as unknown as Role[];
}

export async function createRoleAction(
  orgId: number,
  name: string,
  description: string,
  permissionIds: number[]
): Promise<Role | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const client = createOrchestraClient(apiKey);
  const { data, error, response } = await client.POST('/v0/organizations/{organization_id}/roles', {
    params: { path: { organization_id: orgId } },
    body: { name, description, permission_ids: permissionIds } as never,
  });

  if (error) {
    return {
      detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to create role',
      status: response?.status || 500,
    };
  }

  return data as unknown as Role;
}

export async function updateRoleAction(
  orgId: number,
  roleId: number,
  name: string,
  description: string
): Promise<Role | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function deleteRoleAction(
  orgId: number,
  roleId: number
): Promise<void | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function getAllPermissionsAction(): Promise<Permission[] | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const client = createOrchestraClient(apiKey);
  const { data, error, response } = await client.GET('/v0/permissions');

  if (error) {
    return {
      detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to get permissions',
      status: response?.status || 500,
    };
  }

  return data as unknown as Permission[];
}

export async function addPermissionsToRoleAction(
  orgId: number,
  roleId: number,
  permissionIds: number[]
): Promise<Role | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function removePermissionFromRoleAction(
  orgId: number,
  roleId: number,
  permissionId: number
): Promise<Role | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

// =============================================================================
// Team Functions
// =============================================================================

export async function createTeamAction(
  orgId: number,
  name: string,
  description?: string
): Promise<Team | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const client = createOrchestraClient(apiKey);
  const { data, error, response } = await client.POST('/v0/organizations/{organization_id}/teams', {
    params: { path: { organization_id: orgId } },
    body: { name, description } as never,
  });

  if (error) {
    return {
      detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to create team',
      status: response?.status || 500,
    };
  }

  return data as unknown as Team;
}

export async function updateTeamAction(
  orgId: number,
  teamId: number,
  name: string,
  description?: string
): Promise<Team | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function getTeamsAction(orgId: number): Promise<Team[] | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const client = createOrchestraClient(apiKey);
  const { data, error, response } = await client.GET('/v0/organizations/{organization_id}/teams', {
    params: { path: { organization_id: orgId } },
  });

  if (error) {
    return {
      detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to get teams',
      status: response?.status || 500,
    };
  }

  return data as unknown as Team[];
}

export async function getTeamDetailsAction(
  orgId: number,
  teamId: number
): Promise<Team | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function deleteTeamAction(
  orgId: number,
  teamId: number
): Promise<void | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function addTeamMemberAction(
  orgId: number,
  teamId: number,
  userId: string
): Promise<void | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
      detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to add team member',
      status: response?.status || 500,
    };
  }

  return;
}

export async function removeTeamMemberAction(
  orgId: number,
  teamId: number,
  userId: string
): Promise<void | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function updateOrgSharingModeAction(
  orgId: number,
  dataSharingMode: DataSharingMode
): Promise<OrgSharingSettings | ResponseProps> {
  const apiKey = await requireUserApiKey();
  return safeFetch(
    `${backendUrl}/organizations/${orgId}/sharing-settings`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ data_sharing_mode: dataSharingMode }),
    },
    'updateOrgSharingMode'
  ) as Promise<OrgSharingSettings | ResponseProps>;
}

// =============================================================================
// MFA Enforcement Functions
// =============================================================================

export interface OrgMFASettings {
  requireMfa: boolean;
}

export async function getMfaSettingsAction(orgId: number): Promise<OrgMFASettings | ResponseProps> {
  const apiKey = await requireUserApiKey();
  return safeFetch(
    `${backendUrl}/organizations/${orgId}/mfa-settings`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
    'getMfaSettings'
  ) as Promise<OrgMFASettings | ResponseProps>;
}

export async function updateMfaSettingsAction(
  orgId: number,
  requireMfa: boolean
): Promise<OrgMFASettings | ResponseProps> {
  const apiKey = await requireUserApiKey();
  return safeFetch(
    `${backendUrl}/organizations/${orgId}/mfa-settings`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ require_mfa: requireMfa }),
    },
    'updateMfaSettings'
  ) as Promise<OrgMFASettings | ResponseProps>;
}

// =============================================================================
// Resource Access Functions
// =============================================================================

export async function grantResourceAccessAction(
  resourceType: 'project' | 'org',
  resourceId: number,
  grantData: ResourceAccessGrant
): Promise<ResourceAccessResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function revokeResourceAccessAction(
  resourceType: 'project' | 'org',
  resourceId: number,
  revokeData: ResourceAccessRevoke
): Promise<void | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function updateResourceAccessAction(
  resourceType: 'project' | 'org',
  resourceId: number,
  accessId: number,
  updateData: ResourceAccessUpdate
): Promise<ResourceAccessResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}

export async function listResourceAccessAction(
  resourceType: 'project' | 'org',
  resourceId: number
): Promise<ResourceAccessListResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
}
