"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GranularContextActions } from '@/types/evals/grid';

/**
 * Hook to fetch all contexts for a project
 */
export function useListContextsQuery(
  projectId: string | null,
  actions: GranularContextActions
) {
  return useQuery({
    queryKey: ['contexts', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return actions.getContexts(projectId);
    },
    enabled: !!projectId,
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
      actions: GranularContextActions;
    }) => {
      return actions.createContext(projectId, name);
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
 * Hook to delete a context
 */
export function useDeleteContextQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      contextName, 
      actions 
    }: { 
      projectId: string; 
      contextName: string;
      actions: GranularContextActions;
    }) => {
      return actions.deleteContext(projectId, contextName);
    },
    onSuccess: (_, variables) => {
      // Invalidate contexts query to refetch the list
      queryClient.invalidateQueries({ 
        queryKey: ['contexts', variables.projectId] 
      });
    },
  });
} 