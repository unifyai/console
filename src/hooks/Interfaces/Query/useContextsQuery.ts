"use client";

import { useQuery, useMutation } from '@tanstack/react-query';
import { ContextActions } from '@/types/interfaces/grid';
import { useQueryClient } from "@tanstack/react-query";
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';

/**
 * Hook to fetch all contexts for a project
 */
export function useListContextsQuery(
  projectId: string | null,
  actions: ContextActions
) {
  return useQuery({
    queryKey: ['contexts', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return actions.get(projectId);
    },
    enabled: !!projectId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook to create a new context
 */
export function useCreateContextQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      name, 
      actions 
    }: { 
      projectId: string; 
      name: string;
      actions: ContextActions;
    }) => {
      return actions.create(projectId, name);
    },
    onSuccess: (_, variables) => {
      // Invalidate contexts query to refetch the list
      queryClient.invalidateQueries({ 
        queryKey: ['contexts', variables.projectId] 
      });
    },
  });
}

/**
 * Hook to rename a context
 */
export function useRenameContextQuery() {
  const queryClient = useQueryClient();
  const storeApi = useStoreApiContext();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      currentName, 
      newName, 
      actions 
    }: { 
      projectId: string; 
      currentName: string;
      newName: string;
      actions: ContextActions;
    }) => {
      return actions.rename(projectId, currentName, newName);
    },
    onSuccess: (data, variables) => {
      // Optimistic local rename for instant UI consistency
      try { const s = storeApi.getState() as any; s.renameProjectContext?.(variables.projectId, variables.currentName, variables.newName); } catch {}
      // Invalidate contexts to reconcile
      queryClient.invalidateQueries({ 
        queryKey: ['contexts', variables.projectId] 
      });
    },
  });
}

/**
 * Hook to delete a context
 */
export function useDeleteContextQuery() {
  const queryClient = useQueryClient();
  const storeApi = useStoreApiContext();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      contextName, 
      actions 
    }: { 
      projectId: string; 
      contextName: string;
      actions: ContextActions;
    }) => {
      return actions.delete(projectId, contextName);
    },
    onSuccess: (_, variables) => {
      // Optimistic local delete for immediate UI
      try { const s = storeApi.getState() as any; s.deleteProjectContext?.(variables.projectId, variables.contextName); } catch {}
      // Invalidate contexts query to refetch the list
      queryClient.invalidateQueries({ 
        queryKey: ['contexts', variables.projectId] 
      });
    },
  });
}