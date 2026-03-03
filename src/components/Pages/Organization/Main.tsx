'use client';

import PersonalWorkspaceView from './PersonalWorkspaceView';
import OrganizationWorkspaceView, { MemberSpendingActions } from './OrganizationWorkspaceView';
import { Organization, OrganizationActions } from '@/types/organization';
import { TeamActions } from '@/types/team';
import { RoleActions } from '@/types/role';
import { MfaSettingsActions } from './SecuritySettingsPanel';
import { useOrganization } from '@/hooks/useOrganization';
import { useTeams } from '@/hooks/useTeams';
import { useRoles } from '@/hooks/useRoles';
import { Toaster } from 'sonner';

interface MainProps {
  initialOrganizations: Organization[];
  userId: string;
  actions: OrganizationActions;
  teamActions: TeamActions;
  roleActions: RoleActions;
  /** Member spending actions (optional - enables spending management) */
  memberSpendingActions?: MemberSpendingActions;
  /** Organization spending limit for validation context */
  orgSpendingLimit?: number | null;
  /** MFA settings actions (optional - enables security settings panel) */
  mfaSettingsActions?: MfaSettingsActions;
}

const Main = ({
  initialOrganizations,
  userId,
  actions,
  teamActions,
  roleActions,
  memberSpendingActions,
  orgSpendingLimit,
  mfaSettingsActions,
}: MainProps) => {
  // 1. Organization Logic
  const {
    organizations,
    currentOrg,
    members,
    unifiedMembers,
    roles,
    loadingMembers,
    handleCreateOrg,
    handleDeleteOrg,
    handleUpdateOrg,
    handleInvite,
    handleCancelInvite,
    handleResendInvite,
    handleRemoveMember,
    handleUpdateRole,
    handleTransferOwnership,
  } = useOrganization(initialOrganizations, actions);

  // 2. Team Logic (Dependent on currentOrg)
  const {
    teams,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
    handleAddTeamMember,
    handleRemoveTeamMember,
  } = useTeams(currentOrg?.id, teamActions);

  // 3. Role Logic (Dependent on currentOrg)
  const {
    roles: managedRoles,
    allPermissions,
    handleCreateRole,
    handleUpdateRole: handleUpdateManagedRole,
    handleDeleteRole,
    handleAddPermission,
    handleRemovePermission,
  } = useRoles(currentOrg?.id, roleActions);

  return (
    <>
      <Toaster richColors position="bottom-right" closeButton />
      <div className="relative flex h-full overflow-auto bg-background">
        {currentOrg ? (
          <OrganizationWorkspaceView
            organization={currentOrg}
            currentUserId={userId}
            unifiedMembers={unifiedMembers}
            roles={roles}
            teams={teams}
            // Role Data
            managedRoles={managedRoles}
            allPermissions={allPermissions}
            isLoadingMembers={loadingMembers}
            onDeleteOrg={handleDeleteOrg}
            onUpdateOrg={handleUpdateOrg}
            onInvite={handleInvite}
            onCancelInvite={handleCancelInvite}
            onResendInvite={handleResendInvite}
            onRemoveMember={handleRemoveMember}
            onUpdateRole={handleUpdateRole}
            onTransferOwnership={handleTransferOwnership}
            // Team Handlers
            onCreateTeam={handleCreateTeam}
            onUpdateTeam={handleUpdateTeam}
            onDeleteTeam={handleDeleteTeam}
            onAddTeamMember={handleAddTeamMember}
            onRemoveTeamMember={handleRemoveTeamMember}
            // Role Handlers
            onCreateRole={handleCreateRole}
            onUpdateManagedRole={handleUpdateManagedRole}
            onDeleteRole={handleDeleteRole}
            onAddRolePermission={handleAddPermission}
            onRemoveRolePermission={handleRemovePermission}
            // Member Spending
            memberSpendingActions={memberSpendingActions}
            orgSpendingLimit={orgSpendingLimit}
            // MFA Settings
            mfaSettingsActions={mfaSettingsActions}
          />
        ) : (
          <PersonalWorkspaceView
            onCreateOrg={handleCreateOrg}
            checkNameAvailability={actions.getAllOrganizations}
            isAlreadyInOrganization={organizations.length > 0}
          />
        )}
      </div>
    </>
  );
};

export default Main;
