'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Organization,
  isMemberSpendData,
  calculateMemberSpendingDisplay,
  getCurrentMonth,
} from '@/types/organization';
import { UnifiedMember } from '@/hooks/Organizations/useOrganization';
import { Team } from '@/types/team';
import type { DataSharingMode } from '@/types/organization';
import { Role, Permission } from '@/types/role';
import { Input } from '@/components/UI/input';
import { Search, Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TableCell } from '@/components/UI/table';
import dynamic from 'next/dynamic';
import MemberRow, { MemberSpendingInfo } from './MemberRow';
import { MemberAssistantInfo } from './Main';
import InviteMemberDialog from './InviteMemberDialog';
import TeamListPanel from './TeamListPanel';
import RoleListPanel from './RoleListPanel';
import { MfaSettingsActions } from './SecuritySettingsPanel';
import { fetchMemberSpend, updateMemberSpendingLimit } from '@/lib/client/spending';
import { organizationTabs } from '@/lib/navigation/organizationTabs';

// `MemberSpendingDialog` is only rendered when a row's three-dot menu
// triggers it, so there's no point shipping it (or its formatting/
// validation deps) in the initial Organizations bundle. Same logic
// applies to the role-management dialogs below — load on demand.
const MemberSpendingDialog = dynamic(
  () => import('./MemberSpending').then((m) => m.MemberSpendingDialog),
  { ssr: false }
);
import { Button } from '@/components/UI/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/UI/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tabs, TabsContent } from '@/components/UI/tabs';
import { toast } from 'sonner';
import OrganizationSettingsTab from './OrganizationSettingsTab';
import OrganizationSecurityTab from './OrganizationSecurityTab';

interface OrganizationWorkspaceViewProps {
  organization: Organization;
  currentUserId: string;
  unifiedMembers: UnifiedMember[];
  /**
   * Roles for permission derivation, member-role pickers, and the
   * invite dialog. Same dataset as `managedRoles` — kept as a
   * separate prop so the role-management surface (`RoleListPanel`) can
   * later receive a different/filtered subset without affecting
   * permission checks.
   */
  roles: Role[];
  teams: Team[];

  // Role Data
  managedRoles: Role[];
  allPermissions: Permission[];
  /**
   * Lazily mints the permissions catalog. `RoleListPanel` calls this
   * when its tab first opens so the (large, rarely-used) permissions
   * list isn't fetched on the default Organization tab.
   */
  onLoadPermissions: () => void;

  isLoadingMembers: boolean;
  isLoadingTeams: boolean;
  isLoadingRoles: boolean;
  onDeleteOrg: () => void;
  onUpdateOrg: (name: string, timezone?: string | null) => void;
  onInvite: (email: string, roleId?: number) => Promise<{ success: boolean; error?: string }>;
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
  onUpdateOrgSharingMode: (dataSharingMode: DataSharingMode) => Promise<unknown>;
  onRefreshTeams?: () => void;
  // Role Actions
  onCreateRole: (name: string, description: string, permissionIds: number[]) => void;
  onUpdateManagedRole: (roleId: number, name: string, description: string) => void;
  onDeleteRole: (roleId: number) => void;
  onAddRolePermission: (roleId: number, permissionIds: number[]) => void;
  onRemoveRolePermission: (roleId: number, permissionId: number) => void;
  // Organization spending limit (for validation context)
  orgSpendingLimit?: number | null;
  // MFA Settings Actions (optional - if not provided, security settings are hidden)
  mfaSettingsActions?: MfaSettingsActions;
  /** Server-prefetched initial MFA toggle for the active org. */
  initialMfaRequired?: boolean | null;
  // Assistants grouped by supervisor userId
  memberAssistantsMap?: Map<string, MemberAssistantInfo[]>;
  /**
   * Whether the current user is a member of the "Unify" organization.
   * Unify (internal) members keep visibility of member spend/limits even
   * while the org is in free trial, instead of seeing the locked badge.
   */
  isUnifyMember?: boolean;
}

const OrganizationWorkspaceView = ({
  organization,
  currentUserId,
  unifiedMembers,
  roles,
  teams,
  managedRoles,
  allPermissions,
  onLoadPermissions,
  isLoadingMembers,
  isLoadingTeams,
  isLoadingRoles,
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
  onUpdateOrgSharingMode,
  onRefreshTeams,
  onCreateRole,
  onUpdateManagedRole,
  onDeleteRole,
  onAddRolePermission,
  onRemoveRolePermission,
  orgSpendingLimit,
  mfaSettingsActions,
  initialMfaRequired = null,
  memberAssistantsMap,
  isUnifyMember = false,
}: OrganizationWorkspaceViewProps) => {
  const searchParams = useSearchParams();
  const validTabs = useMemo(() => ['organization', 'members', 'teams', 'roles', 'security'], []);

  // The Organizations page is a fully server-rendered RSC that re-binds
  // a couple dozen server actions on every render. Going through
  // `router.replace` for tab switches triggers a full RSC roundtrip
  // (even though only the `?tab=` query changes), making each click
  // wait several seconds for the server. We avoid that by holding the
  // active tab in local state seeded from the URL, and syncing the URL
  // via `window.history.replaceState` (no Next.js navigation, no RSC
  // refetch).
  const initialTab = (() => {
    const t = searchParams.get('tab');
    return t && validTabs.includes(t) ? t : 'organization';
  })();
  const [activeTab, setActiveTabState] = useState<string>(initialTab);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (tab === 'organization') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', newUrl);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [teamFilter, setTeamFilter] = useState<string>('All');

  // Member spending state — loaded via parallel client `/api` GETs (not
  // server actions). Server actions on this page serialize through one
  // Next.js channel and also trigger RSC refreshes that remount this
  // tree, which is what made spend/limit columns flash in and out.
  const [memberSpendingMap, setMemberSpendingMap] = useState<Map<string, MemberSpendingInfo>>(
    new Map()
  );
  const [selectedMemberForSpending, setSelectedMemberForSpending] = useState<UnifiedMember | null>(
    null
  );
  const spendingFetchGenerationRef = useRef(0);
  const memberSpendingMapRef = useRef(memberSpendingMap);
  memberSpendingMapRef.current = memberSpendingMap;

  // Pre-resolved signed URLs for member avatars: gs://… → https://…
  // Populated in one batched call instead of one per `MemberRow`.
  const [signedAvatarUrls, setSignedAvatarUrls] = useState<Record<string, string>>({});

  // Stable key over the active member ids — used as the dep for the
  // spending fetch so the callback only re-creates when the actual
  // roster changes, not on every reference churn of `unifiedMembers`.
  const activeMemberIdsKey = useMemo(
    () =>
      unifiedMembers
        .filter((m) => m.status === 'active' && m.userId)
        .map((m) => m.userId!)
        .sort()
        .join(','),
    [unifiedMembers]
  );

  // Read-through ref so the spending fetch can reach the latest roster
  // without taking a dependency on an unstable array reference.
  const unifiedMembersRef = useRef(unifiedMembers);
  useEffect(() => {
    unifiedMembersRef.current = unifiedMembers;
  });

  // Fetch spending for active members. Preserves already-loaded values
  // while in flight so columns don't flicker back to "...". Only hits
  // the network for members that do not already have settled data.
  const fetchMemberSpending = useCallback(async () => {
    const currentMonth = getCurrentMonth();
    const activeMembers = unifiedMembersRef.current.filter(
      (m) => m.status === 'active' && m.userId
    );
    const activeIds = new Set(activeMembers.map((m) => m.userId!));
    const generation = ++spendingFetchGenerationRef.current;
    const prev = memberSpendingMapRef.current;

    const membersToFetch = activeMembers.filter((member) => {
      const existing = prev.get(member.userId!);
      return !existing || existing.isLoading;
    });

    setMemberSpendingMap(() => {
      const next = new Map<string, MemberSpendingInfo>();
      for (const member of activeMembers) {
        const userId = member.userId!;
        const existing = prev.get(userId);
        if (existing && !existing.isLoading) {
          next.set(userId, existing);
        } else {
          next.set(userId, {
            currentSpend: existing?.currentSpend ?? 0,
            limit: existing?.limit ?? null,
            display: existing?.display ?? null,
            isLoading: true,
          });
        }
      }
      return next;
    });

    if (membersToFetch.length === 0) return;

    await Promise.all(
      membersToFetch.map(async (member) => {
        const userId = member.userId!;
        try {
          // Spend payload already includes the member's monthly limit.
          const spendResult = await fetchMemberSpend(organization.id, userId, currentMonth);
          if (generation !== spendingFetchGenerationRef.current) return;

          let spendData: MemberSpendingInfo = {
            currentSpend: 0,
            limit: null,
            display: null,
            isLoading: false,
          };

          if (isMemberSpendData(spendResult)) {
            spendData = {
              currentSpend: spendResult.cumulativeSpend,
              limit: spendResult.limit,
              display: calculateMemberSpendingDisplay(spendResult),
              isLoading: false,
            };
          }

          setMemberSpendingMap((current) => {
            if (!activeIds.has(userId)) return current;
            const next = new Map(current);
            next.set(userId, spendData);
            return next;
          });
        } catch (err) {
          if (generation !== spendingFetchGenerationRef.current) return;
          console.error(`Failed to fetch spending for member ${userId}:`, err);
          setMemberSpendingMap((current) => {
            const existing = current.get(userId);
            // Keep prior values on failure rather than wiping to blank.
            if (existing && !existing.isLoading) return current;
            const next = new Map(current);
            next.set(userId, {
              currentSpend: 0,
              limit: null,
              display: null,
              isLoading: false,
            });
            return next;
          });
        }
      })
    );
  }, [organization.id]);

  // Pull the permissions catalog the first time the Roles tab is
  // opened. The `onLoadPermissions` callback is idempotent in
  // `useRoles`, so repeated tab visits are no-ops.
  useEffect(() => {
    if (activeTab === 'roles') {
      onLoadPermissions();
    }
  }, [activeTab, onLoadPermissions]);

  // Resolve every member's `gs://` avatar URL in a single batched
  // request whenever the member list changes. Was: one
  // `POST /api/storage/signed-url` per `MemberRow` (N+1 round-trips,
  // bottlenecked by the browser's connection pool, causing visible
  // avatar pop-in). Now: one round-trip → one map handed down to
  // every row at the same time.
  // Stable key over the gs:// avatar paths, so the effect only fires
  // when the actual set of images changes — not on every reference
  // churn of `unifiedMembers` (each server-action roundtrip would
  // otherwise reissue the batched signed-URL fetch).
  const gsAvatarKey = useMemo(
    () =>
      Array.from(
        new Set(
          unifiedMembers
            .map((m) => m.image)
            .filter((image): image is string => !!image && image.startsWith('gs://'))
        )
      )
        .sort()
        .join('|'),
    [unifiedMembers]
  );

  useEffect(() => {
    const gsUrls = gsAvatarKey ? gsAvatarKey.split('|') : [];

    if (gsUrls.length === 0) {
      setSignedAvatarUrls({});
      return;
    }

    let cancelled = false;
    fetch('/api/storage/signed-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      body: JSON.stringify({ gs_urls: gsUrls }),
    })
      .then((r) => (r.ok ? r.json() : { urls: {} }))
      .then((data: { urls?: Record<string, string> }) => {
        if (!cancelled) setSignedAvatarUrls(data.urls ?? {});
      })
      .catch(() => {
        // Falls through to per-row lazy resolution in MemberRow.
      });

    return () => {
      cancelled = true;
    };
  }, [gsAvatarKey]);

  // Spending fires only when the user is actually on the Members tab.
  // Previously this ran on every load regardless of tab, costing 2×N
  // requests (spend + limit per active member) that the user never
  // saw on the default Organization tab and that competed with
  // members/avatar fetches over the browser's connection pool.
  useEffect(() => {
    if (activeTab === 'members') {
      fetchMemberSpending();
    }
  }, [activeTab, activeMemberIdsKey, fetchMemberSpending]);

  // Handle opening the spending dialog for a member
  const handleEditSpendingLimit = useCallback(
    (userId: string) => {
      const member = unifiedMembers.find((m) => m.userId === userId);
      if (member) {
        setSelectedMemberForSpending(member);
      }
    },
    [unifiedMembers]
  );

  // Handle saving a member's spending limit
  const handleSaveSpendingLimit = useCallback(
    async (newLimit: number | null): Promise<{ success: boolean; error?: string }> => {
      const userId = selectedMemberForSpending?.userId;
      if (!userId) {
        return { success: false, error: 'Spending actions not available' };
      }

      try {
        const result = await updateMemberSpendingLimit(organization.id, userId, {
          monthlySpendingCap: newLimit,
        });

        if ('detail' in result && !('info' in result) && !('monthlySpendingCap' in result)) {
          return { success: false, error: result.detail as string };
        }

        toast.success('Spending limit updated successfully');

        const currentMonth = getCurrentMonth();
        const spendResult = await fetchMemberSpend(organization.id, userId, currentMonth);
        if (isMemberSpendData(spendResult)) {
          const limit =
            'monthlySpendingCap' in result ? (result.monthlySpendingCap ?? newLimit) : newLimit;
          setMemberSpendingMap((prev) => {
            const next = new Map(prev);
            next.set(userId, {
              currentSpend: spendResult.cumulativeSpend,
              limit,
              display: calculateMemberSpendingDisplay({
                ...spendResult,
                limit,
              }),
              isLoading: false,
            });
            return next;
          });
        }

        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update spending limit';
        return { success: false, error: errorMsg };
      }
    },
    [selectedMemberForSpending, organization.id]
  );

  // Permission Logic
  const isOrgOwner = organization.ownerId === currentUserId;
  const spendingEnabled = true;

  const currentUserPermissions = useMemo(() => {
    const currentUserMember = unifiedMembers.find((m) => m.userId === currentUserId);
    if (!currentUserMember || !currentUserMember.roleId) return [];
    const userRole = roles.find((r) => r.id === currentUserMember.roleId);
    return userRole?.permissions || [];
  }, [unifiedMembers, roles, currentUserId]);

  const hasPermission = (resource: string, action: string) => {
    // Org owner always has full permissions (mirrors backend behaviour in
    // ResourceAccessDAO.check_org_member_permission).
    if (isOrgOwner) return true;
    return currentUserPermissions.some((p) => p.resourceType === resource && p.action === action);
  };

  const canUpdateOrg = hasPermission('organization', 'write');
  const canDeleteOrg = hasPermission('organization', 'delete');
  const canManageMembers = hasPermission('organization', 'write');

  // Precompute a userId → team-name list once per teams change.
  // Was: O(members × teams) on every render via per-row `teams.filter`.
  // Now: O(teams + members) per teams change, O(1) per row.
  const teamNamesByUserId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const team of teams) {
      if (!team.members) continue;
      for (const userId of team.members) {
        const list = map.get(userId);
        if (list) list.push(team.name);
        else map.set(userId, [team.name]);
      }
    }
    return map;
  }, [teams]);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const teamFilterUserIds =
      teamFilter !== 'All'
        ? new Set(teams.find((t) => t.name === teamFilter)?.members ?? [])
        : null;

    return unifiedMembers.filter((member) => {
      const name = (member.name || '').toLowerCase();
      const email = (member.email || '').toLowerCase();
      const matchesSearch = name.includes(query) || email.includes(query);

      const matchesRole = roleFilter === 'All' ? true : (member.role || 'Member') === roleFilter;

      let matchesTeam = true;
      if (teamFilterUserIds) {
        matchesTeam =
          member.status === 'active' && !!member.userId && teamFilterUserIds.has(member.userId);
      }

      return matchesSearch && matchesRole && matchesTeam;
    });
  }, [unifiedMembers, searchQuery, roleFilter, teamFilter, teams]);

  // Convert unifiedMembers to OrganizationMember[] for legacy props compatibility where needed
  const activeMembersForProps = useMemo(
    () =>
      unifiedMembers
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
        })),
    [unifiedMembers, organization.id]
  );

  return (
    <div className="h-full w-full overflow-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <div className="flex h-full min-h-full">
          <aside
            className="h-full w-[200px] shrink-0 border-r border-border px-2.5 py-4"
            data-testid="organization-subrail"
          >
            <div className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Organization
            </div>
            <div className="flex flex-col gap-0.5">
              {organizationTabs(canUpdateOrg).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
                    activeTab === id
                      ? 'bg-accent-soft text-accent-soft-foreground'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </aside>

          <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <TabsContent value="members" className="mt-4">
              <section className="flex min-h-[calc(100vh-160px)] flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
                {/* Toolbar */}
                <div className="bg-muted/20 flex flex-shrink-0 flex-col items-center justify-between gap-4 border-b p-4 xl:flex-row">
                  <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto xl:w-auto">
                    {/* Invite Button */}
                    {canManageMembers && (
                      <InviteMemberDialog
                        onInvite={onInvite}
                        existingMembers={activeMembersForProps}
                        roles={roles}
                      />
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
                </div>

                {/* Member Table */}
                <div className="flex-1 overflow-auto bg-background px-3">
                  <Table className="table-fixed">
                    <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
                      <TableRow>
                        <TableHead
                          className={`${spendingEnabled ? 'w-[20%]' : 'w-[30%]'} min-w-[180px]`}
                        >
                          User
                        </TableHead>
                        <TableHead className="hidden w-[15%] min-w-[180px] lg:table-cell">
                          Email
                        </TableHead>
                        <TableHead className="w-[15%] min-w-[100px] text-center">
                          Assistants
                        </TableHead>
                        <TableHead className="w-[12%] min-w-[100px] text-center">Teams</TableHead>
                        <TableHead className="w-[12%] min-w-[80px] text-center">Role</TableHead>
                        {spendingEnabled && (
                          <TableHead className="w-[12%] min-w-[100px] text-center">
                            Monthly Limit
                          </TableHead>
                        )}
                        {spendingEnabled && (
                          <TableHead className="w-[12%] min-w-[100px] text-center">Spent</TableHead>
                        )}
                        <TableHead className="w-[8%] min-w-[50px] text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="h-full">
                      {isLoadingMembers && filteredMembers.length === 0 ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <MemberRowSkeleton
                            key={`member-skel-${i}`}
                            spendingEnabled={spendingEnabled}
                          />
                        ))
                      ) : filteredMembers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={spendingEnabled ? 8 : 6}
                            className="text-body-muted py-12 text-center"
                          >
                            No members found.
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {filteredMembers.map((member) => {
                        const userTeams = member.userId
                          ? (teamNamesByUserId.get(member.userId) ?? [])
                          : [];
                        const memberSpending = member.userId
                          ? memberSpendingMap.get(member.userId)
                          : undefined;
                        return (
                          <MemberRow
                            key={member.id}
                            member={member}
                            userTeams={userTeams}
                            memberAssistants={
                              member.userId ? memberAssistantsMap?.get(member.userId) : undefined
                            }
                            prefetchedImageUrl={
                              member.image ? signedAvatarUrls[member.image] : undefined
                            }
                            roles={roles}
                            currentUserId={currentUserId}
                            canManageMembers={canManageMembers}
                            isOrgOwner={isOrgOwner}
                            onRemove={onRemoveMember}
                            onUpdateRole={onUpdateRole}
                            onTransferOwnership={onTransferOwnership}
                            onCancelInvite={onCancelInvite}
                            onResendInvite={onResendInvite}
                            showSpending={spendingEnabled}
                            spendingInfo={memberSpending}
                            onEditSpendingLimit={handleEditSpendingLimit}
                            freeTrial={organization.freeTrial && !isUnifyMember}
                          />
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </TabsContent>

            {/* Teams Tab */}
            <TabsContent value="teams" className="mt-4">
              <section className="flex min-h-[calc(100vh-160px)] flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
                <TeamListPanel
                  teams={teams}
                  members={activeMembersForProps}
                  isLoading={isLoadingTeams}
                  onCreateTeam={onCreateTeam}
                  onUpdateTeam={onUpdateTeam}
                  onDeleteTeam={onDeleteTeam}
                  onAddMember={onAddTeamMember}
                  onRemoveMember={onRemoveTeamMember}
                  organizationImage={organization.image}
                  organizationName={organization.name}
                  orgSharingMode={
                    teams.some((team) => team.isOrgWideSharing)
                      ? 'shared'
                      : (organization.dataSharingMode ?? 'private')
                  }
                  canManageOrgSharing={canUpdateOrg}
                  canManageTeams={canManageMembers}
                  onUpdateOrgSharingMode={onUpdateOrgSharingMode}
                  onTeamPhotoUpdated={onRefreshTeams}
                />
              </section>
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles" className="mt-4">
              <section className="flex min-h-[calc(100vh-160px)] flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
                <RoleListPanel
                  roles={managedRoles}
                  allPermissions={allPermissions}
                  isLoading={isLoadingRoles}
                  onCreateRole={onCreateRole}
                  onUpdateRole={onUpdateManagedRole}
                  onDeleteRole={onDeleteRole}
                  onAddPermission={onAddRolePermission}
                  onRemovePermission={onRemoveRolePermission}
                />
              </section>
            </TabsContent>

            {/* Organization Tab (admin-gated) */}
            {canUpdateOrg && (
              <TabsContent value="organization" className="mt-4">
                <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
                  <OrganizationSettingsTab
                    orgId={organization.id}
                    currentName={organization.name}
                    currentImage={organization.image}
                    currentTimezone={organization.timezone}
                    onUpdate={onUpdateOrg}
                  />
                </section>
              </TabsContent>
            )}

            {/* Security Tab (admin-gated) */}
            {canUpdateOrg && (
              <TabsContent value="security" className="mt-4">
                <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
                  <OrganizationSecurityTab
                    organizationId={organization.id}
                    organizationName={organization.name}
                    canEdit={canUpdateOrg}
                    canDelete={canDeleteOrg}
                    onDeleteOrg={onDeleteOrg}
                    mfaSettingsActions={mfaSettingsActions}
                    initialMfaRequired={initialMfaRequired}
                  />
                </section>
              </TabsContent>
            )}
          </div>
        </div>
      </Tabs>

      {/* Member Spending Dialog */}
      {selectedMemberForSpending && (
        <MemberSpendingDialog
          open={!!selectedMemberForSpending}
          onOpenChange={(open) => {
            if (!open) setSelectedMemberForSpending(null);
          }}
          memberName={selectedMemberForSpending.name || 'Unknown'}
          memberEmail={selectedMemberForSpending.email}
          currentLimit={
            selectedMemberForSpending.userId
              ? (memberSpendingMap.get(selectedMemberForSpending.userId)?.limit ?? null)
              : null
          }
          currentSpend={
            selectedMemberForSpending.userId
              ? (memberSpendingMap.get(selectedMemberForSpending.userId)?.currentSpend ?? 0)
              : 0
          }
          display={
            selectedMemberForSpending.userId
              ? (memberSpendingMap.get(selectedMemberForSpending.userId)?.display ?? null)
              : null
          }
          orgLimit={orgSpendingLimit}
          onSave={handleSaveSpendingLimit}
          canEdit={canManageMembers}
        />
      )}
    </div>
  );
};

export default OrganizationWorkspaceView;

/**
 * Skeleton row that mirrors the column layout of `MemberRow`. Uses
 * raw `<div>`s with `bg-muted` (matching the proven pattern used by
 * `BrainTable`) instead of the global `<Skeleton>` shimmer.
 */
function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} />;
}

function MemberRowSkeleton({ spendingEnabled }: { spendingEnabled: boolean }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <SkeletonBar className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <SkeletonBar className="h-3.5 w-32" />
            <SkeletonBar className="h-3 w-44 lg:hidden" />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <SkeletonBar className="h-3.5 w-48" />
      </TableCell>
      <TableCell>
        <div className="flex justify-center">
          <SkeletonBar className="h-5 w-10 rounded-full" />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-center">
          <SkeletonBar className="h-5 w-12 rounded-full" />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-center">
          <SkeletonBar className="h-5 w-16 rounded-full" />
        </div>
      </TableCell>
      {spendingEnabled && (
        <TableCell>
          <div className="flex justify-center">
            <SkeletonBar className="h-3.5 w-14" />
          </div>
        </TableCell>
      )}
      {spendingEnabled && (
        <TableCell>
          <div className="flex justify-center">
            <SkeletonBar className="h-3.5 w-14" />
          </div>
        </TableCell>
      )}
      <TableCell className="text-right">
        <div className="flex justify-end">
          <SkeletonBar className="h-7 w-7 rounded-md" />
        </div>
      </TableCell>
    </TableRow>
  );
}
