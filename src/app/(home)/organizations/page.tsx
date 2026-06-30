import { Suspense } from 'react';
import Main from '@/components/Pages/Organization/Main';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';
import { getCurrentUser } from '@/lib/user/user';
import * as OrganizationActions from '@/lib/user/organization';
import * as TeamActions from '@/lib/user/team';
import * as RoleActions from '@/lib/user/role';
import * as MemberSpendingActions from '@/lib/organizations/member-spending';
import * as OrgSpendingActions from '@/lib/organizations/spending';
import * as MfaSettingsActions from '@/lib/orchestra/api/organization';
import { Organization, isOrgSpendingLimitData } from '@/types/organization';
import { redirect } from 'next/navigation';
import { isSelfHost } from '@/lib/environment/environment';
import { ShellSectionPage } from '@/components/Layout/Shell/ShellSectionPage';

const OrganizationPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Organizations are a multi-tenant/team construct that doesn't apply to a
  // single-owner self-host install — send these users back to their assistants.
  if (isSelfHost()) {
    redirect('/assistants');
  }

  const organizations: Organization[] =
    user.organizations?.map((org: any) => ({
      id: org.id,
      name: org.name,
      ownerId: org.ownerId,
      roleId: org.roleId,
      roleName: org.roleName,
      apiKey: org.apiKey,
      image: org.image,
      timezone: org.timezone,
      freeTrial: org.freeTrial,
      dataSharingMode: org.dataSharingMode,
      orgWideSharingEnabled: org.orgWideSharingEnabled,
      orgWideSharingTeamId: org.orgWideSharingTeamId,
    })) || [];

  const isUnifyMember = user.organizations?.some((o: any) => o.name === 'Unify') ?? false;

  return (
    <ShellSectionPage sectionId="organizations" fill>
      <Suspense fallback={<SectionBodySkeleton />}>
        <OrganizationsData
          userId={user.id}
          organizations={organizations}
          isUnifyMember={isUnifyMember}
        />
      </Suspense>
    </ShellSectionPage>
  );
};

/**
 * Streams the per-org spending limit + MFA settings so the section header
 * paints immediately while these reads resolve.
 */
async function OrganizationsData({
  userId,
  organizations,
  isUnifyMember,
}: {
  userId: string;
  organizations: Organization[];
  isUnifyMember: boolean;
}) {
  const orgActions = {
    createOrg: OrganizationActions.createOrgAction,
    deleteOrg: OrganizationActions.deleteOrganizationAction,
    updateOrg: OrganizationActions.updateOrganizationAction,
    inviteMember: OrganizationActions.inviteMemberAction,
    getInvites: OrganizationActions.getInvitesAction,
    cancelInvite: OrganizationActions.cancelInviteAction,
    removeMember: OrganizationActions.removeMemberAction,
    updateRole: OrganizationActions.updateRoleAction,
    transferOwnership: OrganizationActions.transferOwnershipAction,
    getMembers: OrganizationActions.getMembersAction,
    getRoles: OrganizationActions.getOrganizationRolesAction,
    getAllOrganizations: OrganizationActions.getAllOrganizationsAction,
    checkUserOrganization: OrganizationActions.checkUserOrganizationAction,
  };

  const teamActions = {
    createTeam: TeamActions.createTeamAction,
    updateTeam: TeamActions.updateTeamAction,
    deleteTeam: TeamActions.deleteTeamAction,
    addTeamMember: TeamActions.addTeamMemberAction,
    removeTeamMember: TeamActions.removeTeamMemberAction,
    getTeams: TeamActions.getTeamsAction,
    getTeamDetails: TeamActions.getTeamDetailsAction,
    updateOrgSharingMode: TeamActions.updateOrgSharingModeAction,
  };

  const roleActions = {
    getRoles: RoleActions.getRolesAction,
    createRole: RoleActions.createRoleAction,
    updateRole: RoleActions.updateRoleAction,
    deleteRole: RoleActions.deleteRoleAction,
    getAllPermissions: RoleActions.getAllPermissionsAction,
    addPermissionsToRole: RoleActions.addPermissionsToRoleAction,
    removePermissionFromRole: RoleActions.removePermissionFromRoleAction,
  };

  const memberSpendingActions = {
    getMemberSpend: MemberSpendingActions.getMemberSpend,
    getMemberSpendingLimit: MemberSpendingActions.getMemberSpendingLimit,
    setMemberSpendingLimit: MemberSpendingActions.setMemberSpendingLimit,
  };

  const mfaSettingsActionsObj = {
    getMfaSettings: MfaSettingsActions.getMfaSettingsAction,
    updateMfaSettings: MfaSettingsActions.updateMfaSettingsAction,
  };

  let orgSpendingLimit: number | null = null;
  let initialMfaRequired: boolean | null = null;
  if (organizations.length > 0) {
    const [orgLimitResult, mfa] = await Promise.all([
      OrgSpendingActions.getOrgSpendingLimit(organizations[0].id),
      mfaSettingsActionsObj.getMfaSettings(organizations[0].id),
    ]);
    if (isOrgSpendingLimitData(orgLimitResult)) {
      orgSpendingLimit = orgLimitResult.monthlySpendingCap;
    }
    if (mfa && 'requireMfa' in mfa) {
      initialMfaRequired = mfa.requireMfa;
    }
  }

  return (
    <Main
      initialOrganizations={organizations}
      userId={userId}
      actions={orgActions}
      teamActions={teamActions}
      roleActions={roleActions}
      memberSpendingActions={memberSpendingActions}
      orgSpendingLimit={orgSpendingLimit}
      mfaSettingsActions={mfaSettingsActionsObj}
      initialMfaRequired={initialMfaRequired}
      isUnifyMember={isUnifyMember}
    />
  );
}

export default OrganizationPage;
