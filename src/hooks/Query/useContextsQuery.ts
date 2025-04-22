"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ContextActions } from '@/types/evals/grid';

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
      actions: ContextActions;
    }) => {
      return actions.delete(projectId, contextName);
    },
    onSuccess: (_, variables) => {
      // Invalidate contexts query to refetch the list
      queryClient.invalidateQueries({ 
        queryKey: ['contexts', variables.projectId] 
      });
    },
  });
} 