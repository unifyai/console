"use client";

import { useQuery, useMutation } from '@tanstack/react-query';
import { ProjectsActions } from '@/types/evals/grid';
import { getQueryClient } from '@/lib/react-query/getQueryClient';

/**
 * Hook to fetch all projects
 */
export function useListProjectsQuery(actions: ProjectsActions) {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      return actions.get();
    },
  });
}

/**
 * Hook to fetch a project by id
 */
export function useGetProjectByIdQuery(projectId: string | null, actions: ProjectsActions) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      // Note: The ProjectsActions doesn't have a getProjectById method
      // If needed, consider implementing a workaround or extending the type
      return null;
    },
    enabled: !!projectId,
  });
}

/**
 * Hook to create a new project
 */
export function useCreateProjectQuery() {
  const queryClient = getQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      name, 
      actions 
    }: { 
      name: string; 
      actions: ProjectsActions;
    }) => {
      return actions.create(name);
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
  const queryClient = getQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      oldName,
      newName,
      actions 
    }: { 
      oldName: string;
      newName: string;
      actions: ProjectsActions;
    }) => {
      return actions.rename(oldName, newName);
    },
    onSuccess: () => {
      // Invalidate projects list
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Hook to delete a project
 */
export function useDeleteProjectQuery() {
  const queryClient = getQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      name, 
      actions 
    }: { 
      name: string; 
      actions: ProjectsActions;
    }) => {
      return actions.delete(name);
    },
    onSuccess: () => {
      // Invalidate projects query to refetch data
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}