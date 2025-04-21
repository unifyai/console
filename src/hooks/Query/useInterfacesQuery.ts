"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GranularInterfaceActions, InterfaceData } from '@/types/evals/grid';

/**
 * Hook to fetch all interfaces for a project
 */
export function useListInterfacesQuery(
  projectId: string | null,
  actions: GranularInterfaceActions
) {
  return useQuery({
    queryKey: ['interfaces', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return actions.listInterfaces(projectId);
    },
    enabled: !!projectId,
  });
}

/**
 * Hook to fetch a specific interface by name
 */
export function useGetInterfaceQuery(
  projectId: string | null,
  interfaceName: string | null,
  actions: GranularInterfaceActions
) {
  return useQuery({
    queryKey: ['interface', projectId, interfaceName],
    queryFn: async () => {
      if (!projectId || !interfaceName) return null;
      return actions.getInterfaceByName(projectId, interfaceName);
    },
    enabled: !!projectId && !!interfaceName,
  });
}

/**
 * Hook to fetch a specific interface with all its tabs
 */
export function useGetInterfaceWithTabsQuery(
  projectId: string | null,
  interfaceName: string | null,
  actions: GranularInterfaceActions
) {
  return useQuery({
    queryKey: ['interface-with-tabs', projectId, interfaceName],
    queryFn: async () => {
      if (!projectId || !interfaceName) return null;
      return actions.getInterfaceWithTabs(projectId, interfaceName);
    },
    enabled: !!projectId && !!interfaceName,
  });
}

/**
 * Hook to create a new interface
 */
export function useCreateInterfaceQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      name,
      color,
      actions 
    }: { 
      projectId: string; 
      name: string;
      color?: string;
      actions: GranularInterfaceActions;
    }) => {
      return actions.createInterface(projectId, name, color);
    },
    onSuccess: (_, variables) => {
      // Invalidate interfaces query to refetch the list
      queryClient.invalidateQueries({ 
        queryKey: ['interfaces', variables.projectId] 
      });
    },
  });
}

/**
 * Hook to update an interface
 */
export function useUpdateInterfaceQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      data, 
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      data: { 
        name?: string;
        active_tab_id?: string;
        color?: string;
      }; 
      actions: GranularInterfaceActions;
    }) => {
      return actions.updateInterface(projectId, interfaceName, data);
    },
    onSuccess: (_, variables) => {
      // Invalidate specific interface and interfaces list
      queryClient.invalidateQueries({ 
        queryKey: ['interface', variables.projectId, variables.interfaceName] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['interfaces', variables.projectId] 
      });
      // Also invalidate interface with tabs
      queryClient.invalidateQueries({ 
        queryKey: ['interface-with-tabs', variables.projectId, variables.interfaceName] 
      });
    },
  });
}

/**
 * Hook to delete an interface
 */
export function useDeleteInterfaceQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      actions: GranularInterfaceActions;
    }) => {
      return actions.deleteInterface(projectId, interfaceName);
    },
    onSuccess: (_, variables) => {
      // Invalidate interfaces list
      queryClient.invalidateQueries({ 
        queryKey: ['interfaces', variables.projectId] 
      });
      // Remove the deleted interface from cache
      queryClient.removeQueries({ 
        queryKey: ['interface', variables.projectId, variables.interfaceName] 
      });
      queryClient.removeQueries({ 
        queryKey: ['interface-with-tabs', variables.projectId, variables.interfaceName] 
      });
    },
  });
}

/**
 * Hook to create a checkpoint for an interface
 */
export function useCreateInterfaceCheckpointQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName,
      description,
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      description: string;
      actions: GranularInterfaceActions;
    }) => {
      return actions.createInterfaceCheckpoint(projectId, interfaceName, description);
    },
    onSuccess: (_, variables) => {
      // Invalidate checkpoints query to refetch data
      queryClient.invalidateQueries({ 
        queryKey: ['interfaces', variables.projectId, true] 
      });
    },
  });
} 