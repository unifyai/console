"use client";

import { useQuery, useMutation } from '@tanstack/react-query';
import { GranularInterfaceActions, InterfaceData } from '@/types/evals/grid';
import { useQueryClient } from "@tanstack/react-query";

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
      return actions.list(projectId);
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
      return actions.getByName(projectId, interfaceName);
    },
    enabled: !!projectId && !!interfaceName,
  });
}

/**
 * Hook to fetch a specific interface by ID
 */
export function useGetInterfaceByIdQuery(
  interfaceId: string | null,
  actions: GranularInterfaceActions
) {
  return useQuery({
    queryKey: ['interface-by-id', interfaceId],
    queryFn: async () => {
      if (!interfaceId) return null;
      return actions.getById(interfaceId);
    },
    enabled: !!interfaceId,
  });
}

/**
 * Unified hook to fetch a specific interface by either ID or name
 */
export function useGetInterfaceUnifiedQuery(
  params: {
    interfaceId?: string | null;
    projectId?: string | null;
    name?: string | null;
    checkpoint?: boolean;
  },
  actions: GranularInterfaceActions
) {
  const { interfaceId, projectId, name, checkpoint } = params;
  const usingId = !!interfaceId;
  const usingPath = !!projectId && !!name;
  
  return useQuery({
    queryKey: usingId 
      ? ['interface-by-id', interfaceId, checkpoint] 
      : ['interface', projectId, name, checkpoint],
    queryFn: async () => {
      if (usingId) {
        return actions.getById(interfaceId as string, checkpoint);
      } else if (usingPath) {
        return actions.getByName(
          projectId as string, 
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
 * Hook to fetch a specific interface with all its tabs
 */
export function useGetInterfaceWithTabsQuery(
  projectId: string | null,
  interfaceName: string | null,
  actions: GranularInterfaceActions & {
    // This method needs to be added to the GranularInterfaceActions interface
    getInterfaceWithTabs?: (projectId: string, interfaceName: string) => Promise<any>;
  }
) {
  return useQuery({
    queryKey: ['interface-with-tabs', projectId, interfaceName],
    queryFn: async () => {
      if (!projectId || !interfaceName || !actions.getInterfaceWithTabs) return null;
      return actions.getInterfaceWithTabs(projectId, interfaceName);
    },
    enabled: !!projectId && !!interfaceName && !!actions.getInterfaceWithTabs,
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
      ...interfaceData
    }: { 
      projectId: string; 
      name: string;
      color?: string;
      active_tab_id?: string;
      actions: GranularInterfaceActions;
    }) => {
      const { actions, ...restData } = interfaceData;
      return actions.create(projectId, name, restData.color);
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
      data: Partial<Omit<InterfaceData, 'id' | 'project_id' | 'created_at' | 'updated_at'>>; 
      actions: GranularInterfaceActions;
    }) => {
      return actions.updateByName(projectId, interfaceName, data);
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
 * Hook to update an interface by ID
 */
export function useUpdateInterfaceByIdQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      interfaceId, 
      data, 
      actions 
    }: { 
      interfaceId: string;
      data: Partial<Omit<InterfaceData, 'id' | 'project_id' | 'created_at' | 'updated_at'>>; 
      actions: GranularInterfaceActions;
    }) => {
      return actions.updateById(interfaceId, data);
    },
    onSuccess: (result) => {
      if (result && 'id' in result) {
        // Invalidate the interface by ID
        queryClient.invalidateQueries({ 
          queryKey: ['interface-by-id', result.id] 
        });
        
        // If we know the project_id, we can invalidate related queries
        if ('project_id' in result && result.project_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['interfaces', result.project_id] 
          });
        }
      }
    },
  });
}

/**
 * Unified hook to update an interface by either ID or name
 */
export function useUpdateInterfaceUnifiedQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      interfaceId,
      projectId,
      name,
      data,
      checkpoint,
      actions 
    }: { 
      interfaceId?: string;
      projectId?: string;
      name?: string;
      data: Partial<Omit<InterfaceData, 'id' | 'project_id' | 'created_at' | 'updated_at'>>;
      checkpoint?: boolean;
      actions: GranularInterfaceActions;
    }) => {

      if (interfaceId) {
        return actions.updateById(interfaceId, data, checkpoint);
      } else if (projectId && name) {
        return actions.updateByName(projectId, name, data, checkpoint);
      }
      
      throw new Error("Missing required parameters to identify the interface");
    },
    onSuccess: (result, variables) => {
      const { interfaceId, projectId, name } = variables;
      
      // Invalidate based on the parameters used
      if (interfaceId) {
        queryClient.invalidateQueries({ 
          queryKey: ['interface-by-id', interfaceId] 
        });
      }
      
      if (projectId) {
        queryClient.invalidateQueries({ 
          queryKey: ['interfaces', projectId] 
        });
        
        if (name) {
          queryClient.invalidateQueries({ 
            queryKey: ['interface', projectId, name] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['interface-with-tabs', projectId, name] 
          });
        }
      }
      
      // Also try to invalidate based on the result data
      if (result && typeof result === 'object' && 'id' in result) {
        queryClient.invalidateQueries({ 
          queryKey: ['interface-by-id', result.id] 
        });
        
        if ('project_id' in result && result.project_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['interfaces', result.project_id] 
          });
        }
      }
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
      return actions.deleteByName(projectId, interfaceName);
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
 * Hook to delete an interface by ID
 */
export function useDeleteInterfaceByIdQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      interfaceId,
      projectId, // Optional, for cache invalidation
      interfaceName, // Optional, for cache invalidation
      actions 
    }: { 
      interfaceId: string;
      projectId?: string;
      interfaceName?: string;
      actions: GranularInterfaceActions;
    }) => {
      return actions.deleteById(interfaceId);
    },
    onSuccess: (_, variables) => {
      // Invalidate by ID
      queryClient.removeQueries({ 
        queryKey: ['interface-by-id', variables.interfaceId] 
      });
      
      // If we have project info, invalidate those queries too
      if (variables.projectId) {
        queryClient.invalidateQueries({ 
          queryKey: ['interfaces', variables.projectId] 
        });
        
        if (variables.interfaceName) {
          queryClient.removeQueries({ 
            queryKey: ['interface', variables.projectId, variables.interfaceName] 
          });
          queryClient.removeQueries({ 
            queryKey: ['interface-with-tabs', variables.projectId, variables.interfaceName] 
          });
        }
      }
    },
  });
}

/**
 * Unified hook to delete an interface by either ID or name
 */
export function useDeleteInterfaceUnifiedQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      params,
      actions 
    }: { 
      params: {
        interfaceId?: string;
        projectId?: string;
        name?: string;
      };
      actions: GranularInterfaceActions;
    }) => {
      const { interfaceId, projectId, name } = params;
      
      if (interfaceId) {
        return actions.deleteById(interfaceId);
      } else if (projectId && name) {
        return actions.deleteByName(projectId, name);
      }
      
      throw new Error("Missing required parameters to identify the interface");
    },
    onSuccess: (_, variables) => {
      const { interfaceId, projectId, name } = variables.params;
      
      // Invalidate based on the parameters used
      if (interfaceId) {
        queryClient.removeQueries({ 
          queryKey: ['interface-by-id', interfaceId] 
        });
      }
      
      if (projectId) {
        queryClient.invalidateQueries({ 
          queryKey: ['interfaces', projectId] 
        });
        
        if (name) {
          queryClient.removeQueries({ 
            queryKey: ['interface', projectId, name] 
          });
          queryClient.removeQueries({ 
            queryKey: ['interface-with-tabs', projectId, name] 
          });
        }
      }
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
      return actions.checkpointByName(projectId, interfaceName, description);
    },
    onSuccess: (_, variables) => {
      // Invalidate checkpoints query to refetch data
      queryClient.invalidateQueries({ 
        queryKey: ['interfaces', variables.projectId, true] 
      });
    },
  });
}

/**
 * Hook to get a checkpoint for an interface by name
 */
export function useGetInterfaceCheckpointByNameQuery(
  projectId: string | null,
  name: string | null,
  actions: GranularInterfaceActions
) {
  return useQuery({
    queryKey: ['interface-checkpoint-by-name', projectId, name],
    queryFn: async () => {
      if (!projectId || !name) return null;
      return actions.getCheckpointByName(projectId, name);
    },
    enabled: !!projectId && !!name,
  });
}

/**
 * Hook to get a checkpoint for an interface by ID
 */
export function useGetInterfaceCheckpointByIdQuery(
  interfaceId: string | null,
  actions: GranularInterfaceActions
) {
  return useQuery({
    queryKey: ['interface-checkpoint-by-id', interfaceId],
    queryFn: async () => {
      if (!interfaceId) return null;
      return actions.getCheckpointById(interfaceId);
    },
    enabled: !!interfaceId,
  });
}

/**
 * Unified hook to get a checkpoint for an interface by either ID or name
 */
export function useGetInterfaceCheckpointUnifiedQuery(
  params: {
    interfaceId?: string | null;
    projectId?: string | null;
    name?: string | null;
  },
  actions: GranularInterfaceActions
) {
  const { interfaceId, projectId, name } = params;
  const usingId = !!interfaceId;
  const usingPath = !!projectId && !!name;
  
  return useQuery({
    queryKey: usingId 
      ? ['interface-checkpoint-by-id', interfaceId] 
      : ['interface-checkpoint-by-name', projectId, name],
    queryFn: async () => {
      return actions.getCheckpoint({
        interface_id: interfaceId as string,
        projectId: projectId as string,
        name: name as string
      });
    },
    enabled: usingId || usingPath,
  });
} 