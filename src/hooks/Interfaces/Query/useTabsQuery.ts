"use client";

import { useQuery, useMutation } from '@tanstack/react-query';
import { GranularTabActions, TabData } from '@/types/interfaces/grid';
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook to fetch all tabs for an interface
 */
export function useListTabsQuery(
  interface_id: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tabs', interface_id],
    queryFn: async () => {
      if (!interface_id) return [];
      return actions.list(interface_id);
    },
    enabled: !!interface_id,
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
  interface_id: string | null,
  name: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab', interface_id, name],
    queryFn: async () => {
      if (!interface_id || !name) return null;
      return actions.getByName(interface_id, name);
    },
    enabled: !!interface_id && !!name,
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
    interface_id?: string | null;
    name?: string | null;
    checkpoint?: boolean;
  },
  actions: GranularTabActions
) {
  const { id, interface_id, name, checkpoint } = params;
  const usingId = !!id;
  const usingPath = !!interface_id && !!name;
  
  return useQuery({
    queryKey: usingId 
      ? ['tab-by-id', id, checkpoint] 
      : ['tab', interface_id, name, checkpoint],
    queryFn: async () => {
      if (usingId) {
        return actions.getById(id as string, checkpoint);
      } else if (usingPath) {
        return actions.getByName(
          interface_id as string, 
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
  interface_id: string | null,
  name: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab-with-tiles', interface_id, name],
    queryFn: async () => {
      if (!interface_id || !name) return null;
      return actions.getTabWithTilesByName(interface_id, name);
    },
    enabled: !!interface_id && !!name,
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
    interface_id?: string | null;
    name?: string | null;
    checkpoint?: boolean;
  },
  actions: GranularTabActions
) {
  const { id, interface_id, name, checkpoint } = params;
  const usingId = !!id;
  const usingPath = !!interface_id && !!name;
  
  return useQuery({
    queryKey: usingId 
      ? ['tab-with-tiles-by-id', id, checkpoint] 
      : ['tab-with-tiles', interface_id, name, checkpoint],
    queryFn: async () => {
      if (usingId) {
        return actions.getTabWithTilesById(id as string, checkpoint);
      } else if (usingPath) {
        return actions.getTabWithTilesByName(
          interface_id as string, 
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
      interface_id, 
      name,
      data, 
      tab_id,
      actions 
    }: { 
      interface_id: string; 
      name: string;
      data: Partial<Omit<TabData, 'id' | 'interface_id' | 'name' | 'created_at' | 'updated_at'>>; 
      tab_id?: string;
      actions: GranularTabActions;
    }) => {
      try {
        if (typeof actions.create !== 'function') {
          // Try to dynamically access the create method to work around potential serialization issues
          const createMethod = actions["create"];
          
          if (typeof createMethod === 'function') {
            const result = await (createMethod as Function)(interface_id, name, data, tab_id);
            return result;
          }
          
          throw new Error("actions.create is not a function");
        }
        
        const result = await actions.create(interface_id, name, data, tab_id);
        return result;
      } catch (error) {
        console.error("[useTabsQuery] Error creating tab:", error);
        throw error;
      }
    },
    onSuccess: (result) => {
      // Invalidate tabs query to refetch the list
      if (result && 'interface_id' in result) {
        queryClient.invalidateQueries({ 
          queryKey: ['tabs', result.interface_id] 
        });
        // Also invalidate interface with tabs
        queryClient.invalidateQueries({ 
          queryKey: ['interface-with-tabs', result.interface_id] 
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
      interface_id, 
      name, 
      data, 
      actions 
    }: { 
      interface_id: string; 
      name: string;
      data: Partial<Omit<TabData, 'id' | 'interface_id' | 'created_at' | 'updated_at'>>; 
      actions: GranularTabActions;
    }) => {
      return actions.updateByName(interface_id, name, data);
    },
    onSuccess: (result, variables) => {
      // Invalidate specific tab and tabs list
      const { interface_id, name } = variables;
      queryClient.invalidateQueries({ 
        queryKey: ['tab', interface_id, name] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tabs', interface_id] 
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({ 
        queryKey: ['tab-with-tiles', interface_id, name] 
      });
      // Also invalidate interface with tabs
      queryClient.invalidateQueries({ 
        queryKey: ['interface-with-tabs', interface_id] 
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
      data: Partial<Omit<TabData, 'id' | 'interface_id' | 'created_at' | 'updated_at'>>; 
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
        
        // If we know the interface_id, we can invalidate related queries
        if ('interface_id' in result && result.interface_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['tabs', result.interface_id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['interface-with-tabs', result.interface_id] 
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
        interface_id?: string;
        name?: string;
        data: Partial<Omit<TabData, 'id' | 'interface_id' | 'created_at' | 'updated_at'>>;
        checkpoint?: boolean;
      };
      actions: GranularTabActions;
    }) => {
      const { id, interface_id, name, data, checkpoint } = params;
      
      if (id) {
        return actions.updateById(id, data, checkpoint);
      } else if (interface_id && name) {
        return actions.updateByName(interface_id, name, data, checkpoint);
      }
      
      throw new Error("Missing required parameters to identify the tab");
    },
    onSuccess: (result, variables) => {
      const { id, interface_id, name } = variables.params;
      
      // Invalidate based on the parameters used
      if (id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tab-by-id', id] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', id] 
        });
      }
      
      if (interface_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tabs', interface_id] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['interface-with-tabs', interface_id] 
        });
        
        if (name) {
          queryClient.invalidateQueries({ 
            queryKey: ['tab', interface_id, name] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['tab-with-tiles', interface_id, name] 
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
        
        if ('interface_id' in result && result.interface_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['tabs', result.interface_id] 
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
      interface_id, 
      name, 
      actions 
    }: { 
      interface_id: string; 
      name: string;
      actions: GranularTabActions;
    }) => {
      return actions.deleteByName(interface_id, name);
    },
    onSuccess: (_, variables) => {
      const { interface_id, name } = variables;
      // Invalidate tabs list
      queryClient.invalidateQueries({ 
        queryKey: ['tabs', interface_id] 
      });
      // Remove deleted tab from cache
      queryClient.removeQueries({ 
        queryKey: ['tab', interface_id, name] 
      });
      queryClient.removeQueries({ 
        queryKey: ['tab-with-tiles', interface_id, name] 
      });
      // Also invalidate interface with tabs
      queryClient.invalidateQueries({ 
        queryKey: ['interface-with-tabs', interface_id] 
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
      interface_id, // Optional, for cache invalidation
      name, // Optional, for cache invalidation
      actions 
    }: { 
      id: string;
      interface_id?: string;
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
      if (variables.interface_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tabs', variables.interface_id] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['interface-with-tabs', variables.interface_id] 
        });
        
        if (variables.name) {
          queryClient.removeQueries({ 
            queryKey: ['tab', variables.interface_id, variables.name] 
          });
          queryClient.removeQueries({ 
            queryKey: ['tab-with-tiles', variables.interface_id, variables.name] 
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
        interface_id?: string;
        name?: string;
      };
      actions: GranularTabActions;
    }) => {
      const { id, interface_id, name } = params;
      
      if (id) {
        return actions.deleteById(id);
      } else if (interface_id && name) {
        return actions.deleteByName(interface_id, name);
      }
      
      throw new Error("Missing required parameters to identify the tab");
    },
    onSuccess: (_, variables) => {
      const { id, interface_id, name } = variables.params;
      
      // Invalidate based on the parameters used
      if (id) {
        queryClient.removeQueries({ 
          queryKey: ['tab-by-id', id] 
        });
        queryClient.removeQueries({ 
          queryKey: ['tab-with-tiles-by-id', id] 
        });
      }
      
      if (interface_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tabs', interface_id] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['interface-with-tabs', interface_id] 
        });
        
        if (name) {
          queryClient.removeQueries({ 
            queryKey: ['tab', interface_id, name] 
          });
          queryClient.removeQueries({ 
            queryKey: ['tab-with-tiles', interface_id, name] 
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
      interface_id, 
      name,
      description,
      actions 
    }: { 
      interface_id: string; 
      name: string;
      description: string;
      actions: GranularTabActions;
    }) => {
      return actions.checkpointByName(interface_id, name, description);
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
        interface_id?: string;
        name?: string;
        description: string;
      };
      actions: GranularTabActions;
    }) => {
      const { id, interface_id, name, description } = params;
      
      if (id) {
        return actions.checkpointById(id, description);
      } else if (interface_id && name) {
        return actions.checkpointByName(interface_id, name, description);
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
  interface_id: string | null,
  name: string | null,
  actions: GranularTabActions
) {
  return useQuery({
    queryKey: ['tab-checkpoint-by-name', interface_id, name],
    queryFn: async () => {
      if (!interface_id || !name) return null;
      return actions.getCheckpointByName(interface_id, name);
    },
    enabled: !!interface_id && !!name,
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
    interface_id?: string | null;
    name?: string | null;
  },
  actions: GranularTabActions
) {
  const { id, interface_id, name } = params;
  const usingId = !!id;
  const usingPath = !!interface_id && !!name;
  
  return useQuery({
    queryKey: usingId 
      ? ['tab-checkpoint-by-id', id] 
      : ['tab-checkpoint-by-name', interface_id, name],
    queryFn: async () => {
      return actions.getCheckpoint({
        id: id as string,
        interface_id: interface_id as string,
        name: name as string
      });
    },
    enabled: usingId || usingPath,
  });
} 