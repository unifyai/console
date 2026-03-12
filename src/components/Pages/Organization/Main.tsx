'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import PersonalWorkspaceView from './PersonalWorkspaceView';
import OrganizationWorkspaceView, { MemberSpendingActions } from './OrganizationWorkspaceView';
import { Organization, OrganizationActions } from '@/types/organization';
import { TeamActions } from '@/types/team';
import { RoleActions } from '@/types/role';
import { MfaSettingsActions } from './SecuritySettingsPanel';
import { useOrganization } from '@/hooks/useOrganization';
import { useTeams } from '@/hooks/useTeams';
import { useRoles } from '@/hooks/useRoles';
import { snakeToCamelObject } from '@/utils/casing';
import { Toaster } from 'sonner';

export interface MemberAssistantInfo {
  agentId: string;
  firstName: string;
  surname: string;
  userId: string;
}

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
  isUnifyMember?: boolean;
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
  isUnifyMember = false,
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

  // 4. Org Assistants (grouped by supervisor userId)
  const [orgAssistants, setOrgAssistants] = useState<MemberAssistantInfo[]>([]);

  useEffect(() => {
    if (!currentOrg) {
      setOrgAssistants([]);
      return;
    }
    fetch('/api/assistant?list_all_org=true')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOrgAssistants(
            data.map((a: Record<string, unknown>) => {
              const camel = snakeToCamelObject<Record<string, string>>(a);
              return {
                agentId: camel.agentId,
                firstName: camel.firstName,
                surname: camel.surname,
                userId: camel.userId,
              };
            })
          );
        }
      })
      .catch(() => setOrgAssistants([]));
  }, [currentOrg]);

  const memberAssistantsMap = useMemo(() => {
    const map = new Map<string, MemberAssistantInfo[]>();
    for (const a of orgAssistants) {
      const list = map.get(a.userId) || [];
      list.push({
        agentId: a.agentId,
        firstName: a.firstName,
        surname: a.surname,
        userId: a.userId,
      });
      map.set(a.userId, list);
    }
    return map;
  }, [orgAssistants]);

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
            // Assistants per member
            memberAssistantsMap={memberAssistantsMap}
          />
        ) : (
          <PersonalWorkspaceView
            onCreateOrg={handleCreateOrg}
            checkNameAvailability={actions.getAllOrganizations}
            isAlreadyInOrganization={organizations.length > 0}
            isUnifyMember={isUnifyMember}
          />
        )}
      </div>
    </>
  );
};

export default Main;
