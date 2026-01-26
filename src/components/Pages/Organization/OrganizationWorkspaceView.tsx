'use client';

import { useState, useMemo } from 'react';
import { Organization, OrganizationRole } from '@/types/organization';
import { UnifiedMember } from '@/hooks/useOrganization';
import { Team } from '@/types/team';
import { Role, Permission } from '@/types/role';
import { Input } from '@/components/UI/input';
import { Search, Loader2, Users, Shield } from 'lucide-react';
import MemberRow from './MemberRow';
import InviteMemberDialog from './InviteMemberDialog';
import UpdateOrgDialog from './UpdateOrganizationDialog';
import DeleteOrganizationDialog from './DeleteOrganizationDialog';
import TeamListPanel from './TeamListPanel';
import RoleListPanel from './RoleListPanel';
import { Button } from '@/components/UI/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/UI/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';

interface OrganizationWorkspaceViewProps {
  organization: Organization;
  currentUserId: string;
  unifiedMembers: UnifiedMember[];
  roles: OrganizationRole[];
  teams: Team[];

  // Role Data
  managedRoles: Role[];
  allPermissions: Permission[];

  isLoadingMembers: boolean;
  onDeleteOrg: () => void;
  onUpdateOrg: (name: string) => void;
  onInvite: (email: string) => Promise<{ success: boolean; error?: string }>;
  onCancelInvite: (inviteId: string) => void;
  onResendInvite: (email: string) => void;
  onRemoveMember: (userId: string) => void;
  onUpdateRole: (userId: string, roleId: number, roleName: string) => void;
  onTransferOwnership: (userId: string) => void;
  // Team Actions
  onCreateTeam: (name: string, desc: string) => void;
  onUpdateTeam: (teamId: number, name: string, desc: string) => void;
  onDeleteTeam: (id: number) => void;
  onAddTeamMember: (teamId: number, userId: string) => void;
  onRemoveTeamMember: (teamId: number, userId: string) => void;
  // Role Actions
  onCreateRole: (name: string, description: string, permissionIds: number[]) => void;
  onUpdateManagedRole: (roleId: number, name: string, description: string) => void;
  onDeleteRole: (roleId: number) => void;
  onAddRolePermission: (roleId: number, permissionIds: number[]) => void;
  onRemoveRolePermission: (roleId: number, permissionId: number) => void;
}

const OrganizationWorkspaceView = ({
  organization,
  currentUserId,
  unifiedMembers,
  roles,
  teams,
  managedRoles,
  allPermissions,
  isLoadingMembers,
  onDeleteOrg,
  onUpdateOrg,
  onInvite,
  onCancelInvite,
  onResendInvite,
  onRemoveMember,
  onUpdateRole,
  onTransferOwnership,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onAddTeamMember,
  onRemoveTeamMember,
  onCreateRole,
  onUpdateManagedRole,
  onDeleteRole,
  onAddRolePermission,
  onRemoveRolePermission,
}: OrganizationWorkspaceViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [teamFilter, setTeamFilter] = useState<string>('All');
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [showRolePanel, setShowRolePanel] = useState(false);

  // Toggle handlers that ensure exclusivity
  const toggleTeamPanel = () => {
    if (showRolePanel) setShowRolePanel(false);
    setShowTeamPanel(!showTeamPanel);
  };

  const toggleRolePanel = () => {
    if (showTeamPanel) setShowTeamPanel(false);
    setShowRolePanel(!showRolePanel);
  };

  // Permission Logic
  const currentUserPermissions = useMemo(() => {
    const currentUserMember = unifiedMembers.find((m) => m.userId === currentUserId);
    if (!currentUserMember || !currentUserMember.roleId) return [];
    const userRole = roles.find((r) => r.id === currentUserMember.roleId);
    return userRole?.permissions || [];
  }, [unifiedMembers, roles, currentUserId]);

  const hasPermission = (resource: string, action: string) => {
    return currentUserPermissions.some((p) => p.resourceType === resource && p.action === action);
  };

  const canUpdateOrg = hasPermission('organization', 'write');
  const canDeleteOrg = hasPermission('organization', 'delete');
  const canManageMembers = hasPermission('organization', 'write');

  // Filtering Logic
  const filteredMembers = unifiedMembers.filter((member) => {
    // 1. Search Query
    const name = member.name || '';
    const email = member.email || '';
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Role Filter
    const matchesRole = roleFilter === 'All' ? true : (member.role || 'Member') === roleFilter;

    // 3. Team Filter
    let matchesTeam = true;
    if (teamFilter !== 'All') {
      if (member.status === 'pending') {
        matchesTeam = false;
      } else {
        const team = teams.find((t) => t.name === teamFilter);
        matchesTeam = !!(
          team &&
          team.members &&
          member.userId &&
          team.members.includes(member.userId)
        );
      }
    }

    return matchesSearch && matchesRole && matchesTeam;
  });

  const getUserTeams = (userId?: string) => {
    if (!userId) return [];
    return teams.filter((t) => t.members?.includes(userId));
  };

  // Convert unifiedMembers to OrganizationMember[] for legacy props compatibility where needed
  const activeMembersForProps = unifiedMembers
    .filter((m) => m.status === 'active' && m.userId)
    .map((m) => ({
      id: -1, // Mock ID, not used in InviteMemberDialog
      userId: m.userId!,
      organizationId: organization.id,
      roleId: m.roleId,
      roleName: m.role,
      createdAt: '',
      email: m.email,
      name: m.name,
    }));

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      {/* Main Card Container */}
      <section className="flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
        {/* Header Section: Title & Actions */}
        <div className="bg-background/50 flex flex-shrink-0 items-center justify-between border-b p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-h1 text-semibold flex items-center gap-2">
              {organization.name}
              <span className="rounded-full border px-2 py-0.5 text-xs font-normal capitalize text-muted-foreground">
                {organization.roleName || 'Member'}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {canUpdateOrg && (
              <UpdateOrgDialog currentName={organization.name} onUpdate={onUpdateOrg} />
            )}
            {canDeleteOrg && (
              <DeleteOrganizationDialog
                organizationName={organization.name}
                onDelete={onDeleteOrg}
              />
            )}
          </div>
        </div>

        {/* Split View Container */}
        <div className="relative flex flex-1 overflow-hidden">
          {/* LEFT SIDE: Member Table */}
          <div
            className={cn(
              'flex h-full flex-col overflow-hidden transition-all duration-300 ease-in-out',
              showTeamPanel || showRolePanel ? 'w-1/2 border-r' : 'w-full'
            )}
          >
            {/* Toolbar */}
            <div className="bg-muted/20 flex flex-col items-center justify-between gap-4 border-b p-4 xl:flex-row">
              <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto xl:w-auto">
                {/* Invite Button */}
                {canManageMembers && (
                  <InviteMemberDialog onInvite={onInvite} existingMembers={activeMembersForProps} />
                )}

                {/* Search */}
                <div className="relative w-full xl:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    className="bg-background pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Role Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="default" className="items-center">
                      <Shield className="h-4 w-4" />
                      {roleFilter === 'All' ? 'All Roles' : roleFilter}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setRoleFilter('All')}>
                      All Roles
                    </DropdownMenuItem>
                    {roles.map((role) => (
                      <DropdownMenuItem key={role.id} onClick={() => setRoleFilter(role.name)}>
                        {role.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Team Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="default" className="items-center">
                      <Users className="h-4 w-4" />
                      {teamFilter === 'All' ? 'All Teams' : teamFilter}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setTeamFilter('All')}>
                      All Teams
                    </DropdownMenuItem>
                    {teams.map((t) => (
                      <DropdownMenuItem key={t.id} onClick={() => setTeamFilter(t.name)}>
                        {t.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex w-full justify-end gap-2 xl:w-auto">
                {/* Role Toggle Button */}
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={showRolePanel ? 'primary' : 'outline'}
                        size="icon"
                        onClick={toggleRolePanel}
                        aria-label={showRolePanel ? 'Close Roles' : 'Manage Roles'}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{showRolePanel ? 'Close Roles' : 'Manage Roles'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Teams Toggle Button */}
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={showTeamPanel ? 'primary' : 'outline'}
                        size="icon"
                        onClick={toggleTeamPanel}
                        aria-label={showTeamPanel ? 'Close Teams' : 'View Teams'}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{showTeamPanel ? 'Close Teams' : 'View Teams'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Member Table */}
            <div className="min-h-0 flex-1 overflow-auto bg-background px-3">
              {isLoadingMembers && filteredMembers.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="mb-2 h-8 w-8 animate-spin" />
                  <p>Loading members...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
                    <TableRow>
                      <TableHead className="w-[30%] min-w-[200px]">User</TableHead>
                      <TableHead className="hidden w-[25%] min-w-[200px] lg:table-cell">
                        Email
                      </TableHead>
                      <TableHead className="w-[20%] min-w-[120px] text-center">Teams</TableHead>
                      <TableHead className="w-[15%] min-w-[100px] text-center">Role</TableHead>
                      <TableHead className="w-[10%] min-w-[50px] text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => {
                      const userTeams = getUserTeams(member.userId).map((t) => t.name);
                      return (
                        <MemberRow
                          key={member.id}
                          member={member}
                          userTeams={userTeams}
                          roles={roles}
                          currentUserId={currentUserId}
                          canManageMembers={canManageMembers}
                          isOrgOwner={organization.ownerId === member.userId}
                          onRemove={onRemoveMember}
                          onUpdateRole={onUpdateRole}
                          onTransferOwnership={onTransferOwnership}
                          onCancelInvite={onCancelInvite}
                          onResendInvite={onResendInvite}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Panels */}

          {/* Team Panel */}
          <div
            className={cn(
              'absolute bottom-0 right-0 top-0 flex h-full flex-col overflow-hidden border-l bg-background transition-all duration-300 ease-in-out',
              showTeamPanel
                ? 'w-1/2 translate-x-0 opacity-100'
                : 'pointer-events-none w-1/2 translate-x-full opacity-0'
            )}
          >
            <TeamListPanel
              teams={teams}
              members={activeMembersForProps}
              onCreateTeam={onCreateTeam}
              onUpdateTeam={onUpdateTeam}
              onDeleteTeam={onDeleteTeam}
              onAddMember={onAddTeamMember}
              onRemoveMember={onRemoveTeamMember}
            />
          </div>

          {/* Role Panel */}
          <div
            className={cn(
              'absolute bottom-0 right-0 top-0 flex h-full flex-col overflow-hidden border-l bg-background transition-all duration-300 ease-in-out',
              showRolePanel
                ? 'w-1/2 translate-x-0 opacity-100'
                : 'pointer-events-none w-1/2 translate-x-full opacity-0'
            )}
          >
            <RoleListPanel
              roles={managedRoles}
              allPermissions={allPermissions}
              onCreateRole={onCreateRole}
              onUpdateRole={onUpdateManagedRole}
              onDeleteRole={onDeleteRole}
              onAddPermission={onAddRolePermission}
              onRemovePermission={onRemoveRolePermission}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default OrganizationWorkspaceView;
