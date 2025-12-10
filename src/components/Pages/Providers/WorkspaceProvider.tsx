"use client";

import React, { createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { User, UserWorkspace } from '@/types/user';

interface WorkspaceContextType {
  workspaces: UserWorkspace[];
  activeWorkspace: UserWorkspace | null;
  switchWorkspace: (workspaceId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ 
  children, 
  user 
}: { 
  children: React.ReactNode;
  user: User | null; 
}) {
  const router = useRouter();

  // 1. Derive Workspaces from User Object
  const workspaces = useMemo<UserWorkspace[]>(() => {
    if (!user) return [];

    const list: UserWorkspace[] = [
      { id: 'personal', name: user.name ?? "Personal", type: 'personal' }
    ];

    if (user.organizations && user.organizations.length > 0) {
      user.organizations.forEach(org => {
        list.push({
          id: org.id.toString(),
          name: org.name,
          type: 'organization'
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
  
  const activeWorkspace = useMemo(() => {
    if (!user) return null;
    
    // Check if current key belongs to an org
    const activeOrg = user.organizations?.find(o => o.apiKey === user.apiKey);
    
    if (activeOrg) {
      return workspaces.find(w => w.id === activeOrg.id.toString()) || null;
    }
    
    return workspaces.find(w => w.id === 'personal') || null;
  }, [user, workspaces]);


  // 3. Switcher Logic
  const switchWorkspace = async (workspaceId: string) => {
    // Optimistic UI update could happen here if we used local state, 
    // but since we rely on the Server `user` object, we trigger a refresh.
    
    // Set Cookie
    await fetch('/api/session/workspace', {
        method: 'POST',
        body: JSON.stringify({ workspaceId })
    });

    // Refresh Server Components to re-run getCurrentUser()
    router.refresh();
  };

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, switchWorkspace }}>
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