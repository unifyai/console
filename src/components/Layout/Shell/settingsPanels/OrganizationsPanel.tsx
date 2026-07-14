'use client';

import * as React from 'react';
import OrganizationMain from '@/components/Pages/Organization/Main';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';
import { useEnvironment } from '@/components/Pages/Providers/EnvironmentProvider';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import { useShellResource } from '@/hooks/Common/useShellResource';
import {
  addPermissionsToRoleAction,
  addTeamMemberAction,
  cancelInviteAction,
  checkUserOrganizationAction,
  createOrgAction,
  createRoleAction,
  createTeamAction,
  deleteOrganizationAction,
  deleteRoleAction,
  deleteTeamAction,
  getAllOrganizationsAction,
  getAllPermissionsAction,
  getInvitesAction,
  getMembersAction,
  getOrganizationRolesAction,
  getRolesAction,
  getTeamDetailsAction,
  getTeamsAction,
  inviteMemberAction,
  removeMemberAction,
  removePermissionFromRoleAction,
  removeTeamMemberAction,
  transferOwnershipAction,
  updateMemberRoleAction,
  updateOrganizationAction,
  updateOrgSharingModeAction,
  updateRoleAction,
  updateTeamAction,
} from '@/lib/orchestra/api/organization';
import { getOrgSpendingLimit, isOrgSpendingLimitData } from '@/lib/organizations/spending';
import { getMfaSettingsAction, updateMfaSettingsAction } from '@/lib/orchestra/api/organization';
import type { Organization } from '@/types/organization';
import type { UserOrganization } from '@/types/user';

const orgActions = {
  createOrg: createOrgAction,
  deleteOrg: deleteOrganizationAction,
  updateOrg: updateOrganizationAction,
  inviteMember: inviteMemberAction,
  getInvites: getInvitesAction,
  cancelInvite: cancelInviteAction,
  removeMember: removeMemberAction,
  updateRole: updateMemberRoleAction,
  transferOwnership: transferOwnershipAction,
  getMembers: getMembersAction,
  getRoles: getOrganizationRolesAction,
  getAllOrganizations: getAllOrganizationsAction,
  checkUserOrganization: checkUserOrganizationAction,
};

const teamActions = {
  createTeam: createTeamAction,
  updateTeam: updateTeamAction,
  deleteTeam: deleteTeamAction,
  addTeamMember: addTeamMemberAction,
  removeTeamMember: removeTeamMemberAction,
  getTeams: getTeamsAction,
  getTeamDetails: getTeamDetailsAction,
  updateOrgSharingMode: updateOrgSharingModeAction,
};

const roleActions = {
  getRoles: getRolesAction,
  createRole: createRoleAction,
  updateRole: updateRoleAction,
  deleteRole: deleteRoleAction,
  getAllPermissions: getAllPermissionsAction,
  addPermissionsToRole: addPermissionsToRoleAction,
  removePermissionFromRole: removePermissionFromRoleAction,
};

const mfaSettingsActions = {
  getMfaSettings: getMfaSettingsAction,
  updateMfaSettings: updateMfaSettingsAction,
};

function mapOrganizations(userOrganizations: UserOrganization[] | undefined): Organization[] {
  return (
    userOrganizations?.map((org) => {
      const sharing = org as UserOrganization &
        Partial<
          Pick<Organization, 'dataSharingMode' | 'orgWideSharingEnabled' | 'orgWideSharingTeamId'>
        >;
      return {
        id: org.id,
        name: org.name,
        ownerId: org.ownerId,
        roleId: org.roleId,
        roleName: org.roleName,
        apiKey: org.apiKey,
        image: org.image,
        timezone: org.timezone,
        freeTrial: org.freeTrial,
        dataSharingMode: sharing.dataSharingMode,
        orgWideSharingEnabled: sharing.orgWideSharingEnabled,
        orgWideSharingTeamId: sharing.orgWideSharingTeamId,
      };
    }) ?? []
  );
}

interface OrganizationBootstrap {
  orgSpendingLimit: number | null;
  initialMfaRequired: boolean | null;
}

export default function OrganizationsPanel() {
  const environment = useEnvironment();
  const { user, isUnifyMember } = useWorkspace();
  const { navigateToAssistants } = useAppShellNavigation();
  const organizations = React.useMemo(
    () => mapOrganizations(user?.organizations),
    [user?.organizations]
  );
  const organizationIds = React.useMemo(() => organizations.map((org) => org.id), [organizations]);

  React.useEffect(() => {
    if (environment.isSelfHost) {
      navigateToAssistants();
    }
  }, [environment.isSelfHost, navigateToAssistants]);

  const loadOrganizationBootstrap = React.useCallback(async (): Promise<OrganizationBootstrap> => {
    if (organizations.length === 0) {
      return { orgSpendingLimit: null, initialMfaRequired: null };
    }
    const [orgLimitResult, mfa] = await Promise.all([
      getOrgSpendingLimit(organizations[0].id),
      getMfaSettingsAction(organizations[0].id),
    ]);
    return {
      orgSpendingLimit: isOrgSpendingLimitData(orgLimitResult)
        ? orgLimitResult.monthlySpendingCap
        : null,
      initialMfaRequired: mfa && 'requireMfa' in mfa ? mfa.requireMfa : null,
    };
  }, [organizations]);

  const { data: organizationBootstrap } = useShellResource<OrganizationBootstrap>({
    queryKey: ['settings-organizations-bootstrap', organizationIds],
    queryFn: loadOrganizationBootstrap,
    enabled: !!user && !environment.isSelfHost,
  });

  if (!user || environment.isSelfHost) {
    return <SectionBodySkeleton />;
  }

  return (
    <OrganizationMain
      initialOrganizations={organizations}
      userId={user.id}
      actions={orgActions}
      teamActions={teamActions}
      roleActions={roleActions}
      orgSpendingLimit={organizationBootstrap?.orgSpendingLimit ?? null}
      mfaSettingsActions={mfaSettingsActions}
      initialMfaRequired={organizationBootstrap?.initialMfaRequired ?? null}
      isUnifyMember={isUnifyMember}
    />
  );
}
