import { Suspense } from 'react';
import Main from '@/components/Pages/Organization/Main';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { getCurrentUser } from '@/lib/user/user';
import * as OrganizationActions from '@/lib/user/organization';
import * as TeamActions from '@/lib/user/team';
import * as RoleActions from '@/lib/user/role';
import { Organization } from '@/types/organization';
import { redirect } from 'next/navigation';

const OrganizationPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const apiKey = user.apiKey;
  const organizations: Organization[] =
    user.organizations?.map((org: any) => ({
      id: org.id,
      name: org.name,
      roleId: org.roleId,
      roleName: org.roleName,
      apiKey: org.apiKey,
    })) || [];

  const orgActions = {
    createOrg: await OrganizationActions.createOrganizationAction(apiKey),
    deleteOrg: await OrganizationActions.deleteOrganizationAction(apiKey),
    updateOrg: await OrganizationActions.updateOrganizationAction(apiKey),
    inviteMember: await OrganizationActions.inviteMemberAction(apiKey),
    getInvites: await OrganizationActions.getInvitesAction(apiKey),
    cancelInvite: await OrganizationActions.cancelInviteAction(apiKey),
    removeMember: await OrganizationActions.removeMemberAction(apiKey),
    updateRole: await OrganizationActions.updateRoleAction(apiKey),
    transferOwnership: await OrganizationActions.transferOwnershipAction(apiKey),
    getMembers: await OrganizationActions.getMembersAction(apiKey),
    getRoles: await OrganizationActions.getOrganizationRolesAction(apiKey),
    getAllOrganizations: await OrganizationActions.getAllOrganizationsAction(),
    checkUserOrganization: await OrganizationActions.checkUserOrganizationAction(),
  };

  const teamActions = {
    createTeam: await TeamActions.createTeamAction(apiKey),
    updateTeam: await TeamActions.updateTeamAction(apiKey),
    deleteTeam: await TeamActions.deleteTeamAction(apiKey),
    addTeamMember: await TeamActions.addTeamMemberAction(apiKey),
    removeTeamMember: await TeamActions.removeTeamMemberAction(apiKey),
    getTeams: await TeamActions.getTeamsAction(apiKey),
    getTeamDetails: await TeamActions.getTeamDetailsAction(apiKey),
  };

  const roleActions = {
    getRoles: await RoleActions.getRolesAction(apiKey),
    createRole: await RoleActions.createRoleAction(apiKey),
    updateRole: await RoleActions.updateRoleAction(apiKey),
    deleteRole: await RoleActions.deleteRoleAction(apiKey),
    getAllPermissions: await RoleActions.getAllPermissionsAction(apiKey),
    addPermissionsToRole: await RoleActions.addPermissionsToRoleAction(apiKey),
    removePermissionFromRole: await RoleActions.removePermissionFromRoleAction(apiKey),
  };

  return (
    <div className="h-full w-full overflow-auto p-1">
      <Suspense fallback={<SkeletonLoader />}>
        <Main
          initialOrganizations={organizations}
          userId={user.id}
          actions={orgActions}
          teamActions={teamActions}
          roleActions={roleActions}
        />
      </Suspense>
    </div>
  );
};

export default OrganizationPage;
