"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GranularTabActions, TabData } from '@/types/evals/grid';

/**
 * Hook to fetch all tabs for an interface
 */
export function useListTabsQuery(
  projectId: string | null,
  interfaceName: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tabs', projectId, interfaceName],
    queryFn: async () => {
      if (!projectId || !interfaceName) return [];
      return actions.listTabs(projectId, interfaceName);
    },
    enabled: !!projectId && !!interfaceName,
  });
}

/**
 * Hook to fetch a specific tab by name
 */
export function useGetTabQuery(
  projectId: string | null,
  interfaceName: string | null,
  tabName: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab', projectId, interfaceName, tabName],
    queryFn: async () => {
      if (!projectId || !interfaceName || !tabName) return null;
      return actions.getTabByName(projectId, interfaceName, tabName);
    },
    enabled: !!projectId && !!interfaceName && !!tabName,
  });
}

/**
 * Hook to fetch a specific tab with all its tiles
 */
export function useGetTabWithTilesQuery(
  projectId: string | null,
  interfaceName: string | null,
  tabName: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab-with-tiles', projectId, interfaceName, tabName],
    queryFn: async () => {
      if (!projectId || !interfaceName || !tabName) return null;
      return actions.getTabWithTiles(projectId, interfaceName, tabName);
    },
    enabled: !!projectId && !!interfaceName && !!tabName,
  });
}

/**
 * Hook to create a new tab
 */
export function useCreateTabQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      tabName,
      data, 
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabName: string;
      data: { 
        visible?: boolean;
        active?: boolean;
        order?: number;
        global_context?: string;
        color?: string;
      }; 
      actions: GranularTabActions;
    }) => {
      return actions.createTab(projectId, interfaceName, tabName, data);
    },
    onSuccess: (_, variables) => {
      // Invalidate tabs query to refetch the list
      queryClient.invalidateQueries({ 
        queryKey: ['tabs', variables.projectId, variables.interfaceName] 
      });
      // Also invalidate interface with tabs
      queryClient.invalidateQueries({ 
        queryKey: ['interface-with-tabs', variables.projectId, variables.interfaceName] 
      });
    },
  });
}

/**
 * Hook to update a tab
 */
export function useUpdateTabQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      tabName, 
      data, 
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabName: string;
      data: { 
        name?: string;
        visible?: boolean;
        active?: boolean;
        order?: number;
        global_context?: string;
        color?: string;
      }; 
      actions: GranularTabActions;
    }) => {
      return actions.updateTab(projectId, interfaceName, tabName, data);
    },
    onSuccess: (_, variables) => {
      // Invalidate specific tab and tabs list
      queryClient.invalidateQueries({ 
        queryKey: ['tab', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tabs', variables.projectId, variables.interfaceName] 
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({ 
        queryKey: ['tab-with-tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      // Also invalidate interface with tabs
      queryClient.invalidateQueries({ 
        queryKey: ['interface-with-tabs', variables.projectId, variables.interfaceName] 
      });
    },
  });
}

/**
 * Hook to update tab positions (reordering)
 */
export function useUpdateTabsPositionsQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      tabs, 
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabs: Array<{
        id: string;
        position: number;
      }>;
      actions: GranularTabActions;
    }) => {
      return actions.updateTabsPositions(projectId, interfaceName, tabs);
    },
    onSuccess: (_, variables) => {
      // Invalidate tabs list
      queryClient.invalidateQueries({ 
        queryKey: ['tabs', variables.projectId, variables.interfaceName] 
      });
      // Invalidate each updated tab
      variables.tabs.forEach(tab => {
        queryClient.invalidateQueries({ 
          queryKey: ['tab', variables.projectId, variables.interfaceName, tab.id] 
        });
      });
      // Also invalidate interface with tabs
      queryClient.invalidateQueries({ 
        queryKey: ['interface-with-tabs', variables.projectId, variables.interfaceName] 
      });
    },
  });
}

/**
 * Hook to delete a tab
 */
export function useDeleteTabQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      tabName, 
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabName: string;
      actions: GranularTabActions;
    }) => {
      return actions.deleteTab(projectId, interfaceName, tabName);
    },
    onSuccess: (_, variables) => {
      // Invalidate tabs list
      queryClient.invalidateQueries({ 
        queryKey: ['tabs', variables.projectId, variables.interfaceName] 
      });
      // Remove deleted tab from cache
      queryClient.removeQueries({ 
        queryKey: ['tab', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      queryClient.removeQueries({ 
        queryKey: ['tab-with-tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      // Also invalidate interface with tabs
      queryClient.invalidateQueries({ 
        queryKey: ['interface-with-tabs', variables.projectId, variables.interfaceName] 
      });
    },
  });
}

/**
 * Hook to create a checkpoint for a tab
 */
export function useCreateTabCheckpointQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName,
      tabName,
      description,
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabName: string;
      description: string;
      actions: GranularTabActions;
    }) => {
      return actions.createTabCheckpoint(projectId, interfaceName, tabName, description);
    },
    onSuccess: (_, variables) => {
      // Invalidate checkpoints query to refetch data
      queryClient.invalidateQueries({ 
        queryKey: ['tabs', variables.projectId, variables.interfaceName, true] 
      });
    },
  });
} 