"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GranularProjectActions } from '@/types/evals/grid';

/**
 * Hook to fetch all projects
 */
export function useListProjectsQuery(actions: GranularProjectActions) {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      return actions.listProjects();
    },
  });
}

/**
 * Hook to fetch a project by id
 */
export function useGetProjectByIdQuery(projectId: string | null, actions: GranularProjectActions) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return actions.getProjectById(projectId);
    },
    enabled: !!projectId,
  });
}

/**
 * Hook to create a new project
 */
export function useCreateProjectQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      name, 
      description, 
      actions 
    }: { 
      name: string; 
      description?: string; 
      actions: GranularProjectActions;
    }) => {
      return actions.createProject({ name, description });
    },
    onSuccess: () => {
      // Invalidate projects query to refetch data
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Hook to update a project
 */
export function useUpdateProjectQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      data, 
      actions 
    }: { 
      projectId: string; 
      data: { 
        name?: string; 
        description?: string;
      }; 
      actions: GranularProjectActions;
    }) => {
      return actions.updateProject(projectId, data);
    },
    onSuccess: (_, variables) => {
      // Invalidate projects list and the specific project
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
    },
  });
}

/**
 * Hook to delete a project
 */
export function useDeleteProjectQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      actions 
    }: { 
      projectId: string; 
      actions: GranularProjectActions;
    }) => {
      return actions.deleteProject(projectId);
    },
    onSuccess: () => {
      // Invalidate projects query to refetch data
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}