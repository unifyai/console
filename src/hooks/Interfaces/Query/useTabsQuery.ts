"use client";

import { useQuery, useMutation } from '@tanstack/react-query';
import { GranularTabActions, TabData } from '@/types/interfaces/grid';
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook to fetch all tabs for an interface
 */
export function useListTabsQuery(
  interfaceId: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tabs', interfaceId],
    queryFn: async () => {
      if (!interfaceId) return [];
      return actions.list(interfaceId);
    },
    enabled: !!interfaceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false, // Don't refetch on network reconnect
  });
}

/**
 * Hook to fetch a specific tab by name
 */
export function useGetTabQuery(
  interfaceId: string | null,
  name: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab', interfaceId, name],
    queryFn: async () => {
      if (!interfaceId || !name) return null;
      return actions.getByName(interfaceId, name);
    },
    enabled: !!interfaceId && !!name,
  });
}

/**
 * Hook to fetch a specific tab by ID
 */
export function useGetTabByIdQuery(
  id: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab-by-id', id],
    queryFn: async () => {
      if (!id) return null;
      return actions.getById(id);
    },
    enabled: !!id,
  });
}

/**
 * Unified hook to fetch a specific tab by either ID or name
 */
export function useGetTabUnifiedQuery(
  params: {
    id?: string | null;
    interfaceId?: string | null;
    name?: string | null;
    checkpoint?: boolean;
  },
  actions: GranularTabActions
) {
  const { id, interfaceId, name, checkpoint } = params;
  const usingId = !!id;
  const usingPath = !!interfaceId && !!name;
  
  return useQuery({
    queryKey: usingId 
      ? ['tab-by-id', id, checkpoint] 
      : ['tab', interfaceId, name, checkpoint],
    queryFn: async () => {
      if (usingId) {
        return actions.getById(id as string, checkpoint);
      } else if (usingPath) {
        return actions.getByName(
          interfaceId as string, 
          name as string, 
          checkpoint
        );
      }
      return null;
    },
    enabled: usingId || usingPath,
  });
}

/**
 * Hook to fetch a specific tab with all its tiles
 */
export function useGetTabWithTilesQuery(
  interfaceId: string | null,
  name: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab-with-tiles', interfaceId, name],
    queryFn: async () => {
      if (!interfaceId || !name) return null;
      return actions.getTabWithTilesByName(interfaceId, name);
    },
    enabled: !!interfaceId && !!name,
  });
}

/**
 * Hook to fetch a specific tab with all its tiles by ID
 */
export function useGetTabWithTilesByIdQuery(
  id: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab-with-tiles-by-id', id],
    queryFn: async () => {
      if (!id) return null;
      return actions.getTabWithTilesById(id);
    },
    enabled: !!id,
  });
}

/**
 * Unified hook to fetch a specific tab with all its tiles by either ID or name
 */
export function useGetTabWithTilesUnifiedQuery(
  params: {
    id?: string | null;
    interfaceId?: string | null;
    name?: string | null;
    checkpoint?: boolean;
  },
  actions: GranularTabActions
) {
  const { id, interfaceId, name, checkpoint } = params;
  const usingId = !!id;
  const usingPath = !!interfaceId && !!name;
  
  return useQuery({
    queryKey: usingId 
      ? ['tab-with-tiles-by-id', id, checkpoint] 
      : ['tab-with-tiles', interfaceId, name, checkpoint],
    queryFn: async () => {
      if (usingId) {
        return actions.getTabWithTilesById(id as string, checkpoint);
      } else if (usingPath) {
        return actions.getTabWithTilesByName(
          interfaceId as string, 
          name as string, 
          checkpoint
        );
      }
      return null;
    },
    enabled: usingId || usingPath,
  });
}

/**
 * Hook to create a new tab
 */
export function useCreateTabQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      interfaceId, 
      name,
      data, 
      tabId,
      actions 
    }: { 
      interfaceId: string; 
      name: string;
      data: Partial<Omit<TabData, 'id' | 'interfaceId' | 'name' | 'createdAt' | 'updatedAt'>>; 
      tabId?: string;
      actions: GranularTabActions;
    }) => {
      try {
        if (typeof actions.create !== 'function') {
          // Try to dynamically access the create method to work around potential serialization issues
          const createMethod = actions["create"];
          
          if (typeof createMethod === 'function') {
            const result = await (createMethod as Function)(interfaceId, name, data, tabId);
            return result;
          }
          
          throw new Error("actions.create is not a function");
        }
        
        const result = await actions.create(interfaceId, name, data, tabId);
        return result;
      } catch (error) {
        console.error("[useTabsQuery] Error creating tab:", error);
        throw error;
      }
    },
    onSuccess: (result) => {
      // Invalidate tabs query to refetch the list
      if (result && 'interfaceId' in result) {
        queryClient.invalidateQueries({ 
          queryKey: ['tabs', result.interfaceId] 
        });
        // Also invalidate interface with tabs
        queryClient.invalidateQueries({ 
          queryKey: ['interface-with-tabs', result.interfaceId] 
        });
      }
    },
    onError: (error) => {
      console.error("[useTabsQuery] Tab creation mutation error:", error);
    }
  });
}

/**
 * Hook to update a tab by name
 */
export function useUpdateTabQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      interfaceId, 
      name, 
      data, 
      actions 
    }: { 
      interfaceId: string; 
      name: string;
      data: Partial<Omit<TabData, 'id' | 'interfaceId' | 'createdAt' | 'updatedAt'>>; 
      actions: GranularTabActions;
    }) => {
      return actions.updateByName(interfaceId, name, data);
    },
    onSuccess: (result, variables) => {
      // Invalidate specific tab and tabs list
      const { interfaceId, name } = variables;
      queryClient.invalidateQueries({ 
        queryKey: ['tab', interfaceId, name] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tabs', interfaceId] 
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({ 
        queryKey: ['tab-with-tiles', interfaceId, name] 
      });
      // Also invalidate interface with tabs
      queryClient.invalidateQueries({ 
        queryKey: ['interface-with-tabs', interfaceId] 
      });
    },
  });
}

/**
 * Hook to update a tab by ID
 */
export function useUpdateTabByIdQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      data, 
      actions 
    }: { 
      id: string;
      data: Partial<Omit<TabData, 'id' | 'interfaceId' | 'createdAt' | 'updatedAt'>>; 
      actions: GranularTabActions;
    }) => {
      return actions.updateById(id, data);
    },
    onSuccess: (result) => {
      if (result && 'id' in result) {
        // Invalidate the tab by ID
        queryClient.invalidateQueries({ 
          queryKey: ['tab-by-id', result.id] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', result.id] 
        });
        
        // If we know the interfaceId, we can invalidate related queries
        if ('interfaceId' in result && result.interfaceId) {
          queryClient.invalidateQueries({ 
            queryKey: ['tabs', result.interfaceId] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['interface-with-tabs', result.interfaceId] 
          });
        }
      }
    },
  });
}

/**
 * Unified hook to update a tab by either ID or name
 */
export function useUpdateTabUnifiedQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      params,
      actions 
    }: { 
      params: {
        id?: string;
        interfaceId?: string;
        name?: string;
        data: Partial<Omit<TabData, 'id' | 'interfaceId' | 'createdAt' | 'updatedAt'>>;
        checkpoint?: boolean;
      };
      actions: GranularTabActions;
    }) => {
      const { id, interfaceId, name, data, checkpoint } = params;
      
      if (id) {
        return actions.updateById(id, data, checkpoint);
      } else if (interfaceId && name) {
        return actions.updateByName(interfaceId, name, data, checkpoint);
      }
      
      throw new Error("Missing required parameters to identify the tab");
    },
    onSuccess: (result, variables) => {
      const { id, interfaceId, name } = variables.params;
      
      // Invalidate based on the parameters used
      if (id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tab-by-id', id] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', id] 
        });
      }
      
      if (interfaceId) {
        queryClient.invalidateQueries({ 
          queryKey: ['tabs', interfaceId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['interface-with-tabs', interfaceId] 
        });
        
        if (name) {
          queryClient.invalidateQueries({ 
            queryKey: ['tab', interfaceId, name] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['tab-with-tiles', interfaceId, name] 
          });
        }
      }
      
      // Also try to invalidate based on the result data
      if (result && typeof result === 'object' && 'id' in result) {
        queryClient.invalidateQueries({ 
          queryKey: ['tab-by-id', result.id] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', result.id] 
        });
        
        if ('interfaceId' in result && result.interfaceId) {
          queryClient.invalidateQueries({ 
            queryKey: ['tabs', result.interfaceId] 
          });
        }
      }
    },
  });
}

/**
 * Hook to delete a tab by name
 */
export function useDeleteTabQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      interfaceId, 
      name, 
      actions 
    }: { 
      interfaceId: string; 
      name: string;
      actions: GranularTabActions;
    }) => {
      return actions.deleteByName(interfaceId, name);
    },
    onSuccess: (_, variables) => {
      const { interfaceId, name } = variables;
      // Invalidate tabs list
      queryClient.invalidateQueries({ 
        queryKey: ['tabs', interfaceId] 
      });
      // Remove deleted tab from cache
      queryClient.removeQueries({ 
        queryKey: ['tab', interfaceId, name] 
      });
      queryClient.removeQueries({ 
        queryKey: ['tab-with-tiles', interfaceId, name] 
      });
      // Also invalidate interface with tabs
      queryClient.invalidateQueries({ 
        queryKey: ['interface-with-tabs', interfaceId] 
      });
    },
  });
}

/**
 * Hook to delete a tab by ID
 */
export function useDeleteTabByIdQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id,
      interfaceId, // Optional, for cache invalidation
      name, // Optional, for cache invalidation
      actions 
    }: { 
      id: string;
      interfaceId?: string;
      name?: string;
      actions: GranularTabActions;
    }) => {
      return actions.deleteById(id);
    },
    onSuccess: (_, variables) => {
      // Invalidate by ID
      queryClient.removeQueries({ 
        queryKey: ['tab-by-id', variables.id] 
      });
      queryClient.removeQueries({ 
        queryKey: ['tab-with-tiles-by-id', variables.id] 
      });
      
      // If we have parent info, invalidate those queries too
      if (variables.interfaceId) {
        queryClient.invalidateQueries({ 
          queryKey: ['tabs', variables.interfaceId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['interface-with-tabs', variables.interfaceId] 
        });
        
        if (variables.name) {
          queryClient.removeQueries({ 
            queryKey: ['tab', variables.interfaceId, variables.name] 
          });
          queryClient.removeQueries({ 
            queryKey: ['tab-with-tiles', variables.interfaceId, variables.name] 
          });
        }
      }
    },
  });
}

/**
 * Unified hook to delete a tab by either ID or name
 */
export function useDeleteTabUnifiedQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      params,
      actions 
    }: { 
      params: {
        id?: string;
        interfaceId?: string;
        name?: string;
      };
      actions: GranularTabActions;
    }) => {
      const { id, interfaceId, name } = params;
      
      if (id) {
        return actions.deleteById(id);
      } else if (interfaceId && name) {
        return actions.deleteByName(interfaceId, name);
      }
      
      throw new Error("Missing required parameters to identify the tab");
    },
    onSuccess: (_, variables) => {
      const { id, interfaceId, name } = variables.params;
      
      // Invalidate based on the parameters used
      if (id) {
        queryClient.removeQueries({ 
          queryKey: ['tab-by-id', id] 
        });
        queryClient.removeQueries({ 
          queryKey: ['tab-with-tiles-by-id', id] 
        });
      }
      
      if (interfaceId) {
        queryClient.invalidateQueries({ 
          queryKey: ['tabs', interfaceId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['interface-with-tabs', interfaceId] 
        });
        
        if (name) {
          queryClient.removeQueries({ 
            queryKey: ['tab', interfaceId, name] 
          });
          queryClient.removeQueries({ 
            queryKey: ['tab-with-tiles', interfaceId, name] 
          });
        }
      }
    },
  });
}

/**
 * Hook to create a checkpoint for a tab by name
 */
export function useCreateTabCheckpointQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      interfaceId, 
      name,
      description,
      actions 
    }: { 
      interfaceId: string; 
      name: string;
      description: string;
      actions: GranularTabActions;
    }) => {
      return actions.checkpointByName(interfaceId, name, description);
    },
    onSuccess: () => {
      // No need to invalidate queries for checkpoint creation
    },
  });
}

/**
 * Hook to create a checkpoint for a tab by ID
 */
export function useCreateTabCheckpointByIdQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id,
      description,
      actions 
    }: { 
      id: string;
      description: string;
      actions: GranularTabActions;
    }) => {
      return actions.checkpointById(id, description);
    },
    onSuccess: () => {
      // No need to invalidate queries for checkpoint creation
    },
  });
}

/**
 * Unified hook to create a checkpoint for a tab by either ID or name
 */
export function useCreateTabCheckpointUnifiedQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      params,
      actions 
    }: { 
      params: {
        id?: string;
        interfaceId?: string;
        name?: string;
        description: string;
      };
      actions: GranularTabActions;
    }) => {
      const { id, interfaceId, name, description } = params;
      
      if (id) {
        return actions.checkpointById(id, description);
      } else if (interfaceId && name) {
        return actions.checkpointByName(interfaceId, name, description);
      }
      
      throw new Error("Missing required parameters to identify the tab");
    },
    onSuccess: () => {
      // No need to invalidate queries for checkpoint creation
    },
  });
}

/**
 * Hook to get a checkpoint for a tab by name
 */
export function useGetTabCheckpointByNameQuery(
  interfaceId: string | null,
  name: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab-checkpoint-by-name', interfaceId, name],
    queryFn: async () => {
      if (!interfaceId || !name) return null;
      return actions.getCheckpointByName(interfaceId, name);
    },
    enabled: !!interfaceId && !!name,
  });
}

/**
 * Hook to get a checkpoint for a tab by ID
 */
export function useGetTabCheckpointByIdQuery(
  id: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab-checkpoint-by-id', id],
    queryFn: async () => {
      if (!id) return null;
      return actions.getCheckpointById(id);
    },
    enabled: !!id,
  });
}

/**
 * Unified hook to get a checkpoint for a tab by either ID or name
 */
export function useGetTabCheckpointUnifiedQuery(
  params: {
    id?: string | null;
    interfaceId?: string | null;
    name?: string | null;
  },
  actions: GranularTabActions
) {
  const { id, interfaceId, name } = params;
  const usingId = !!id;
  const usingPath = !!interfaceId && !!name;
  
  return useQuery({
    queryKey: usingId 
      ? ['tab-checkpoint-by-id', id] 
      : ['tab-checkpoint-by-name', interfaceId, name],
    queryFn: async () => {
      return actions.getCheckpoint({
        id: id as string,
        interfaceId: interfaceId as string,
        name: name as string
      });
    },
    enabled: usingId || usingPath,
  });
} 