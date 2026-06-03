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
import { resolveWorkspaceContext } from '@/lib/user/workspace';

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

  // 2. Determine Active Workspace from the server-resolved user state.
  // `getCurrentUser()` may override the raw workspace cookie (for example, to
  // lock non-Unify members into their org workspace). Use that resolved state
  // everywhere rather than re-deriving active workspace from the cookie.
  const { activeOrganization, activeWorkspace, isWorkspaceSwitchable } = useMemo(
    () => resolveWorkspaceContext(user),
    [user]
  );

  // 2c. Current User ID
  const currentUserId = user?.id || null;

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
      const response = await fetch('/api/session/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok) {
        throw new Error('Failed to switch workspace');
      }

      startTransition(() => {
        // Refresh keeps the current pathname/query so assistant profile deep-links
        // (for example ?profile=<coordinatorId>) survive workspace switches.
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
