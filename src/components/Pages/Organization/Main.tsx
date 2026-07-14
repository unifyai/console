'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import PersonalWorkspaceView from './PersonalWorkspaceView';
import OrganizationWorkspaceView from './OrganizationWorkspaceView';
import { Organization, OrganizationActions } from '@/types/organization';
import { TeamActions } from '@/types/team';
import { RoleActions } from '@/types/role';
import { MfaSettingsActions } from './SecuritySettingsPanel';
import { useOrganization } from '@/hooks/Organizations/useOrganization';
import { useTeams } from '@/hooks/Organizations/useTeams';
import { useRoles } from '@/hooks/Organizations/useRoles';
import { snakeToCamelObject } from '@/utils/casing';

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
  /** Organization spending limit for validation context */
  orgSpendingLimit?: number | null;
  /** MFA settings actions (optional - enables security settings panel) */
  mfaSettingsActions?: MfaSettingsActions;
  /**
   * Server-prefetched MFA toggle for the active organization, so the
   * Security tab can render the toggle immediately instead of waiting
   * for a fresh server-action roundtrip on first open.
   */
  initialMfaRequired?: boolean | null;
  isUnifyMember?: boolean;
}

const Main = ({
  initialOrganizations,
  userId,
  actions,
  teamActions,
  roleActions,
  orgSpendingLimit,
  mfaSettingsActions,
  initialMfaRequired = null,
  isUnifyMember = false,
}: MainProps) => {
  // 1. Organization Logic
  const {
    organizations,
    currentOrg,
    members,
    unifiedMembers,
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
    isLoading: isLoadingTeams,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
    handleAddTeamMember,
    handleRemoveTeamMember,
    handleUpdateOrgSharingMode,
  } = useTeams(currentOrg?.id, teamActions);

  // 3. Role Logic (Dependent on currentOrg).
  //
  // `useRoles` is the single source of truth for the org's roles —
  // both the role-management table in the Roles tab and the
  // permission-derivation logic (workspace view, member role picker,
  // invite dialog) consume the same `roles` array. The permissions
  // catalog is loaded lazily via `loadPermissions()` from
  // `RoleListPanel` when its tab first mounts; we don't need it on
  // initial page load.
  const {
    roles: managedRoles,
    allPermissions,
    isLoading: isLoadingRoles,
    loadPermissions,
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
            data
              .map((a: Record<string, unknown>) => {
                const camel = snakeToCamelObject<Record<string, unknown>>(a);
                return {
                  agentId: String(camel.agentId ?? ''),
                  firstName: String(camel.firstName ?? ''),
                  surname: String(camel.surname ?? ''),
                  userId: String(camel.userId ?? ''),
                  isCoordinator: camel.isCoordinator === true,
                };
              })
              // Every org member has a Coordinator (T-W1N); showing it only for
              // the viewer (visibility rules) is misleading, so omit them here.
              .filter((a) => a.agentId && a.userId && !a.isCoordinator)
              .map(({ agentId, firstName, surname, userId }) => ({
                agentId,
                firstName,
                surname,
                userId,
              }))
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
      <div className="relative flex h-full overflow-auto bg-transparent">
        {currentOrg ? (
          <OrganizationWorkspaceView
            organization={currentOrg}
            currentUserId={userId}
            unifiedMembers={unifiedMembers}
            roles={managedRoles}
            teams={teams}
            // Role Data
            managedRoles={managedRoles}
            allPermissions={allPermissions}
            onLoadPermissions={loadPermissions}
            isLoadingMembers={loadingMembers}
            isLoadingTeams={isLoadingTeams}
            isLoadingRoles={isLoadingRoles}
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
            onUpdateOrgSharingMode={handleUpdateOrgSharingMode}
            // Role Handlers
            onCreateRole={handleCreateRole}
            onUpdateManagedRole={handleUpdateManagedRole}
            onDeleteRole={handleDeleteRole}
            onAddRolePermission={handleAddPermission}
            onRemoveRolePermission={handleRemovePermission}
            orgSpendingLimit={orgSpendingLimit}
            // MFA Settings
            mfaSettingsActions={mfaSettingsActions}
            initialMfaRequired={initialMfaRequired}
            // Assistants per member
            memberAssistantsMap={memberAssistantsMap}
            isUnifyMember={isUnifyMember}
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
