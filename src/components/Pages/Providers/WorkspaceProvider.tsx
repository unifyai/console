'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { User, UserOrganization, UserWorkspace } from '@/types/user';

interface WorkspaceContextType {
  workspaces: UserWorkspace[];
  activeWorkspace: UserWorkspace | null;
  activeOrganization: UserOrganization | null;
  currentUserId: string | null;
  /** Whether the user can switch between workspaces (false for non-Unify org members). */
  isWorkspaceSwitchable: boolean;
  isSwitchingWorkspace: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user: User | null;
}) {
  const router = useRouter();

  // 1. Derive Workspaces from User Object
  const workspaces = useMemo<UserWorkspace[]>(() => {
    if (!user) return [];

    const list: UserWorkspace[] = [
      { id: 'personal', name: user.name ?? 'Personal', type: 'personal' },
    ];

    if (user.organizations && user.organizations.length > 0) {
      user.organizations.forEach((org) => {
        list.push({
          id: org.id.toString(),
          name: org.name,
          type: 'organization',
        });
      });
    }
    return list;
  }, [user]);

  // 2. Determine Active Workspace
  // We can't rely solely on cookies client-side for initial render sync.
  // However, we can infer it: If the user.apiKey matches an org key, that org is active.
  // OR simpler: we rely on a client-side cookie/localstorage or just track state.
  // Since `user` prop comes from server where key-swapping happened,
  // checking keys is the most robust way to sync Server <-> Client state.

  // 2a. Determine Active Organization (full object with roleName)
  const activeOrganization = useMemo(() => {
    if (!user) return null;
    return user.organizations?.find((o) => o.apiKey === user.apiKey) || null;
  }, [user]);

  // 2b. Determine Active Workspace
  const activeWorkspace = useMemo(() => {
    if (!user) return null;

    if (activeOrganization) {
      return workspaces.find((w) => w.id === activeOrganization.id.toString()) || null;
    }

    return workspaces.find((w) => w.id === 'personal') || null;
  }, [user, workspaces, activeOrganization]);

  // 2c. Current User ID
  const currentUserId = user?.id || null;

  // 2d. Workspace switchability
  // Non-Unify org members are locked to their org workspace; the switcher
  // is rendered as a static label instead of a dropdown.
  const isWorkspaceSwitchable = useMemo(() => {
    if (!user) return false;
    // Only Unify org members can switch workspaces; everyone else sees a static label.
    return user.organizations?.some((org) => org.name === 'Unify') ?? false;
  }, [user]);

  // 3. Switcher Logic
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isPending) {
      setIsSwitchingWorkspace(false);
    }
  }, [isPending]);

  const switchWorkspace = async (workspaceId: string) => {
    if (activeWorkspace?.id === workspaceId) return;
    setIsSwitchingWorkspace(true);

    try {
      await fetch('/api/session/workspace', {
        method: 'POST',
        body: JSON.stringify({ workspaceId }),
      });

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setIsSwitchingWorkspace(false);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        activeOrganization,
        currentUserId,
        isWorkspaceSwitchable,
        isSwitchingWorkspace,
        switchWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
