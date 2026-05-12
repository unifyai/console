import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Organization,
  OrganizationMember,
  OrganizationActions,
  OrganizationInvite,
} from '@/types/organization';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { generateCoordinatorOpener } from '@/lib/assistants/preHireChat';
import { seedCoordinatorOpener } from '@/lib/client/coordinator';

export interface UnifiedMember {
  id: string; // userId or invite_id
  userId?: string; // only for active members
  name: string; // name or email
  email: string;
  image?: string | null;
  role: string;
  roleId: number | null;
  status: 'active' | 'pending';
  jobTitle?: string;
  bio?: string;
  isInvite?: boolean;
}

async function seedNewOrganizationCoordinator(org: Organization): Promise<void> {
  if (!org.coordinatorId) {
    console.warn('[organizations] Organization was created without a Coordinator id');
    return;
  }

  try {
    const opener = await generateCoordinatorOpener({
      workspaceType: 'organization',
      workspaceName: org.name,
    });
    const seedResult = await seedCoordinatorOpener(org.coordinatorId, opener.content);
    if ('detail' in seedResult) {
      console.warn('[organizations] Failed to seed Coordinator opener:', seedResult.detail);
    }
  } catch (error) {
    console.warn('[organizations] Failed to prepare Coordinator opener:', error);
  }
}

export const useOrganization = (
  initialOrganizations: Organization[],
  actions: OrganizationActions
) => {
  const router = useRouter();
  const { activeWorkspace, switchWorkspace } = useWorkspace();
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);

  // The Organizations page is a fully server-rendered RSC. Every
  // server-action roundtrip (each spending fetch, every Members tab
  // reload, etc.) re-runs the page on the server and hands `Main` a
  // brand-new `actions` object reference. If any callback below
  // depends on `actions` directly its identity churns on every server
  // call, restarting all dependent effects → a refetch storm.
  // We mirror the latest actions through a ref so callbacks can stay
  // structurally stable across these re-renders.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Sync with server updates — but ONLY when the data actually
  // changed. The page is server-rendered, so every server-action
  // roundtrip (e.g. each spending-data fetch) hands `Main` a fresh
  // `initialOrganizations` array reference. Blindly setting state
  // would churn this hook's `organizations` ref, which in turn
  // churns `currentOrg`, `fetchData`, `unifiedMembers`,
  // `fetchMemberSpending`, ... — restarting every dependent effect
  // and producing an infinite refetch loop. Bailing out when the
  // contents are equivalent keeps the reference stable.
  useEffect(() => {
    if (!initialOrganizations || initialOrganizations.length === 0) return;
    setOrganizations((prev) => {
      if (
        prev.length === initialOrganizations.length &&
        prev.every((o, i) => {
          const next = initialOrganizations[i];
          return (
            !!next &&
            o.id === next.id &&
            o.name === next.name &&
            o.image === next.image &&
            o.timezone === next.timezone &&
            o.roleId === next.roleId &&
            o.roleName === next.roleName &&
            o.ownerId === next.ownerId &&
            o.freeTrial === next.freeTrial
          );
        })
      ) {
        return prev;
      }
      return initialOrganizations;
    });
  }, [initialOrganizations]);

  // Derive currentOrg based on the Global Workspace Context
  const currentOrg = useMemo(() => {
    if (!activeWorkspace) return null;
    if (activeWorkspace.type === 'organization') {
      const found = organizations.find((o) => String(o.id) === String(activeWorkspace.id));
      return found || null;
    }
    return null;
  }, [activeWorkspace, organizations]);

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  // Initialize to `true` (proven pattern, see `useMemoryData`) so the
  // Members table paints skeleton rows immediately on first render
  // instead of briefly flashing an empty body while the fetch effect
  // runs.
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch members when the current organization changes.
  // Roles used to be fetched here too, but that was a duplicate of
  // the `useRoles` fetch one level up (same Orchestra endpoint,
  // `GET /v0/organizations/{id}/roles`). They now share a single
  // source of truth; this hook focuses purely on member data.
  const fetchData = useCallback(async () => {
    if (!currentOrg) {
      setMembers([]);
      setInvites([]);
      setLoadingMembers(false);
      return;
    }
    setLoadingMembers(true);
    try {
      const [membersResult, invitesResult] = await Promise.all([
        actionsRef.current.getMembers(currentOrg.id),
        actionsRef.current.getInvites(currentOrg.id),
      ]);

      if ('detail' in membersResult) {
        toast.error(membersResult.detail);
      } else {
        setMembers(membersResult as OrganizationMember[]);
      }

      if ('detail' in invitesResult) {
        toast.error(invitesResult.detail);
        setInvites([]);
      } else {
        setInvites((invitesResult as any).invites || []);
      }
    } catch (error) {
      toast.error('Failed to load organization data');
    } finally {
      setLoadingMembers(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Merge Members and Invites for the UI
  const unifiedMembers: UnifiedMember[] = useMemo(() => {
    const activeMembers: UnifiedMember[] = members.map((m) => ({
      id: m.userId,
      userId: m.userId,
      name: m.name || m.email || 'Unknown',
      email: m.email || '',
      image: m.image,
      role: m.roleName || 'Member',
      roleId: m.roleId,
      jobTitle: m.jobTitle,
      bio: m.bio,
      status: 'active',
      isInvite: false,
    }));

    const pendingInvites: UnifiedMember[] = invites.map((i) => ({
      id: i.id,
      name: i.inviteeEmail,
      email: i.inviteeEmail,
      role: i.roleName || 'Member',
      roleId: i.roleId,
      status: 'pending',
      isInvite: true,
    }));

    return [...activeMembers, ...pendingInvites];
  }, [members, invites]);

  const handleCreateOrg = async (name: string) => {
    setIsLoading(true);
    try {
      const result = await actions.createOrg(name);
      if ('detail' in result) {
        toast.error(result.detail);
      } else {
        const newOrg = result as Organization;
        setOrganizations((prev) => [...prev, newOrg]);
        toast.success('Organization created successfully');
        await seedNewOrganizationCoordinator(newOrg);
        await switchWorkspace(newOrg.id.toString());
        router.refresh();
      }
    } catch (error) {
      toast.error('Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateOrg = async (name: string, timezone?: string | null) => {
    if (!currentOrg) return;
    setIsLoading(true);
    try {
      const result = await actions.updateOrg(currentOrg.id, name, timezone);
      if ('detail' in result) {
        toast.error(result.detail);
      } else {
        const apiOrg = result as Organization;
        // Merge current org with API response and explicitly set the timezone we sent
        // This ensures timezone is preserved even if the API doesn't return it
        const updatedOrg: Organization = {
          ...currentOrg,
          ...apiOrg,
          timezone: timezone !== undefined ? timezone : currentOrg.timezone,
        };
        setOrganizations((prev) => prev.map((o) => (o.id === updatedOrg.id ? updatedOrg : o)));
        toast.success('Organization updated successfully');
      }
    } catch (error) {
      toast.error('Failed to update organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!currentOrg) return;
    setIsLoading(true);
    try {
      const result = await actions.deleteOrg(currentOrg.id);
      if (result && 'detail' in result) {
        toast.error(result.detail);
      } else {
        const deletedId = currentOrg.id;
        setOrganizations((prev) => prev.filter((o) => o.id !== deletedId));
        toast.success('Organization deleted');
        await switchWorkspace('personal');
        router.refresh();
      }
    } catch (error) {
      toast.error('Failed to delete organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (
    email: string,
    roleId?: number
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentOrg) return { success: false, error: 'No organization selected' };

    try {
      // Check if user is already in an organization
      if (actions.checkUserOrganization) {
        const checkResult = await actions.checkUserOrganization(email);
        if (checkResult && !('detail' in checkResult) && checkResult.isInOrganization) {
          const errorMessage = 'This user is already a member of another organization.';
          toast.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      }

      const result = await actions.inviteMember(currentOrg.id, email, roleId);
      if (result && 'detail' in result) {
        toast.error(result.detail);
        return { success: false, error: result.detail };
      } else {
        toast.success(`Invite sent to ${email}`);
        fetchData();
        return { success: true };
      }
    } catch (error) {
      toast.error('Failed to invite member');
      return { success: false, error: 'Failed to invite member' };
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!currentOrg) return;
    try {
      const result = await actions.cancelInvite(currentOrg.id, inviteId);
      if (result && 'detail' in result) {
        toast.error(result.detail);
      } else {
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
        toast.success('Invite cancelled');
      }
    } catch (error) {
      toast.error('Failed to cancel invite');
    }
  };

  const handleResendInvite = async (email: string) => {
    await handleInvite(email);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentOrg) return;
    try {
      const result = await actions.removeMember(currentOrg.id, userId);
      if (result && 'detail' in result) {
        toast.error(result.detail);
      } else {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        toast.success('Member removed');
      }
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleUpdateRole = async (userId: string, roleId: number, roleName: string) => {
    if (!currentOrg) return;
    try {
      const result = await actions.updateRole(currentOrg.id, userId, roleId);
      if (result && 'detail' in result) {
        toast.error(result.detail);
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.userId === userId ? { ...m, roleName: roleName, roleId: roleId } : m))
        );
        toast.success(`Role updated to ${roleName}`);
      }
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleTransferOwnership = async (userId: string) => {
    if (!currentOrg) return;
    try {
      const result = await actions.transferOwnership(currentOrg.id, userId);
      if (result && 'detail' in result) {
        toast.error(result.detail);
      } else {
        setOrganizations((prev) =>
          prev.map((o) => (o.id === currentOrg.id ? { ...o, ownerId: userId } : o))
        );
        toast.success('Ownership transferred');
        fetchData();
        router.refresh();
      }
    } catch (error) {
      toast.error('Failed to transfer ownership');
    }
  };

  return {
    organizations,
    currentOrg,
    unifiedMembers,
    members,
    loadingMembers,
    isLoading,
    handleCreateOrg,
    handleUpdateOrg,
    handleDeleteOrg,
    handleInvite,
    handleCancelInvite,
    handleResendInvite,
    handleRemoveMember,
    handleUpdateRole,
    handleTransferOwnership,
  };
};
