'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, UserOrganization, UserWorkspace } from '@/types/user';
import { resolveWorkspaceContext } from '@/lib/user/workspace';
import { userFullName } from '@/utils/user/profileDisplay';

interface WorkspaceContextType {
  user: User | null;
  workspaces: UserWorkspace[];
  activeWorkspace: UserWorkspace | null;
  activeOrganization: UserOrganization | null;
  currentUserId: string | null;
  /** Whether the signed-in user is Owner/Admin of the Unify org. */
  isUnifyAdmin: boolean;
  /** Whether the user belongs to the Unify organization. */
  isUnifyMember: boolean;
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
  const queryClient = useQueryClient();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  // 1. Derive Workspaces from User Object
  const workspaces = useMemo<UserWorkspace[]>(() => {
    if (!user) return [];

    const list: UserWorkspace[] = user.personalWorkspaceDisabled
      ? []
      : [
          {
            id: 'personal',
            name: userFullName(user) || 'Personal',
            type: 'personal',
            image: user.image,
          },
        ];

    if (user.organizations && user.organizations.length > 0) {
      user.organizations.forEach((org) => {
        list.push({
          id: org.id.toString(),
          name: org.name,
          type: 'organization',
          image: org.image ?? null,
        });
      });
    }
    return list;
  }, [user]);

  // 2. Determine Active Workspace from the server-resolved user state.
  // `getCurrentUser()` may override the raw workspace cookie (for example, to
  // lock non-Unify members into their org workspace). Use that resolved state
  // everywhere rather than re-deriving active workspace from the cookie.
  const serverWorkspaceContext = useMemo(() => resolveWorkspaceContext(user), [user]);

  useEffect(() => {
    setSelectedWorkspaceId(null);
  }, [user]);

  const effectiveWorkspaceId =
    selectedWorkspaceId ?? serverWorkspaceContext.activeWorkspace?.id ?? null;
  const activeOrganization = useMemo(() => {
    if (!effectiveWorkspaceId || effectiveWorkspaceId === 'personal') return null;
    return (
      user?.organizations?.find(
        (organization) => organization.id.toString() === effectiveWorkspaceId
      ) ?? null
    );
  }, [effectiveWorkspaceId, user?.organizations]);
  const activeWorkspace = useMemo<UserWorkspace | null>(() => {
    if (activeOrganization) {
      return {
        id: activeOrganization.id.toString(),
        name: activeOrganization.name,
        type: 'organization',
        image: activeOrganization.image ?? null,
      };
    }
    if (effectiveWorkspaceId === 'personal') {
      return workspaces.find((workspace) => workspace.id === 'personal') ?? null;
    }
    return serverWorkspaceContext.activeWorkspace;
  }, [
    activeOrganization,
    effectiveWorkspaceId,
    serverWorkspaceContext.activeWorkspace,
    workspaces,
  ]);
  const isWorkspaceSwitchable = serverWorkspaceContext.isWorkspaceSwitchable;

  // 2c. Current User ID
  const currentUserId = user?.id || null;

  const isUnifyMember = useMemo(
    () => user?.organizations?.some((o) => o.name === 'Unify') ?? false,
    [user]
  );

  const isUnifyAdmin = useMemo(
    () =>
      user?.organizations?.some(
        (o) => o.name === 'Unify' && ['owner', 'admin'].includes(o.roleName?.toLowerCase() ?? '')
      ) ?? false,
    [user]
  );

  // 3. Switcher Logic
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);

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

      setSelectedWorkspaceId(workspaceId);
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0] ?? '');
          return [
            'assistants',
            'assistant',
            'billing',
            'usage',
            'organizations',
            'organization',
            'teams',
            'roles',
            'dashboard',
            'spending',
          ].some((prefix) => key.includes(prefix));
        },
      });
      setIsSwitchingWorkspace(false);
    } catch (error) {
      console.error('Could not switch workspace', error);
      setIsSwitchingWorkspace(false);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        workspaces,
        activeWorkspace,
        activeOrganization,
        currentUserId,
        isUnifyAdmin,
        isUnifyMember,
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
