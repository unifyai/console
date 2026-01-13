"use client";

import { useQuery, useMutation } from '@tanstack/react-query';
import { GranularTileActions, TileData, TilePosition } from '@/types/interfaces/grid';
import { useQueryClient } from "@tanstack/react-query";
import { TileType } from '@/contexts/slices/selectors/tile';


/**
 * Hook to fetch all tiles for a tab
 */
export function useListTilesQuery(
  tab_id: string | null,
  type: string | null,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tiles', tab_id, type],
    queryFn: async () => {
      if (!tab_id) return [];
      return actions.list(tab_id, type || undefined);
    },
    enabled: !!tab_id,
    staleTime: 10 * 60 * 1000, // tiles list rarely changes; keep fresh longer
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false, // Don't refetch on network reconnect
  });
}

/**
 * Hook to fetch a specific tile by name
 */
export function useGetTileQuery(
  tab_id: string | null,
  name: string | null,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tile', tab_id, name],
    queryFn: async () => {
      if (!tab_id || !name) return null;
      return actions.getByName(tab_id, name);
    },
    enabled: !!tab_id && !!name,
  });
}

/**
 * Hook to fetch a specific tile by ID
 */
export function useGetTileByIdQuery(
  id: string | null,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tile-by-id', id],
    queryFn: async () => {
      if (!id) return null;
      return actions.getById(id);
    },
    enabled: !!id,
  });
}

/**
 * Unified hook to fetch a specific tile by either ID or name
 */
export function useGetTileUnifiedQuery(
  params: {
    id?: string | null;
    tab_id?: string | null;
    name?: string | null;
    checkpoint?: boolean;
  },
  actions: GranularTileActions
) {
  const { id, tab_id, name, checkpoint } = params;
  const usingId = !!id;
  const usingPath = !!tab_id && !!name;
  
  return useQuery({
    queryKey: usingId 
      ? ['tile-by-id', id, checkpoint] 
      : ['tile', tab_id, name, checkpoint],
    queryFn: async () => {
      if (usingId) {
        return actions.getById(id as string, checkpoint);
      } else if (usingPath) {
        return actions.getByName(
          tab_id as string, 
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
 * Hook to create a new tile
 */
export function useCreateTileQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    retry: 5,
    retryDelay: (attempt: number) => Math.min(2000 * Math.pow(2, attempt - 1), 30000),
    mutationFn: async ({ 
      tab_id, 
      name,
      position,
      data, 
      type,
      tile_id,
      actions 
    }: { 
      tab_id: string; 
      name: string;
      position: TilePosition;
      data: Omit<Partial<TileData>, 'id' | 'tab_id' | 'name' | 'type' | 'position' | 'created_at' | 'updated_at'>; 
      tile_id?: string;
      type?: string;
      actions: GranularTileActions;
    }) => {
      return actions.create(tab_id, name, position, data, tile_id, type);
    },
    onSuccess: (result, variables) => {
      // Invalidate tiles for this tab
      if (result && 'tab_id' in result) {
        queryClient.invalidateQueries({ 
          queryKey: ['tiles', result.tab_id] 
        });
        // Also invalidate tab with tiles
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', result.tab_id] 
        });
      }
    },
  });
}

/**
 * Hook to update a tile
 */
export function useUpdateTileQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    retry: 5,
    retryDelay: (attempt: number) => Math.min(2000 * Math.pow(2, attempt - 1), 30000),
    mutationFn: async ({ 
      id,
      tab_id, 
      name, 
      data, 
      actions 
    }: { 
      id?: string;
      tab_id?: string; 
      name?: string;
      data: Omit<Partial<TileData>, 'id' | 'tab_id' | 'created_at' | 'updated_at'>; 
      actions: GranularTileActions;
    }) => {
      if (id) {
        return actions.updateById(id, data);
      } else if (tab_id && name) {
        return actions.updateByName(tab_id, name, data);
      } else {
        throw new Error("Invalid arguments");
      }
    },
    onSuccess: (result, variables) => {
      // Invalidate specific tile and tiles list
      const { id, tab_id, name } = variables;
      if (id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tile-by-id', id] 
        });
      } else if (tab_id && name) {
        queryClient.invalidateQueries({ 
          queryKey: ['tile', tab_id, name] 
        });
      }
      // Invalidate tiles list
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tiles', tab_id] 
        });
      }
      // Also invalidate tab with tiles
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', tab_id] 
        });
      }
    },
  });
}

/**
 * Hook to update tile positions (reordering, resizing, repositioning)
 * Note: This method needs to be added to the GranularTileActions interface
 */
export function useUpdateTilesPositionsQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    retry: 5,
    retryDelay: (attempt: number) => Math.min(2000 * Math.pow(2, attempt - 1), 30000),
    mutationFn: async ({ 
      tab_id, 
      tiles, 
      actions 
    }: { 
      tab_id: string;
      tiles: Array<{
        id: string;
        position: TilePosition;
      }>;
      actions: GranularTileActions & {
        // This method needs to be added to the GranularTileActions interface
        updateTilesPositions?: (tab_id: string, tiles: Array<{
          id: string;
          position: TilePosition;
        }>) => Promise<TileData[]>;
      };
    }) => {
      if (!actions.updateTilesPositions) {
        throw new Error("updateTilesPositions method is not implemented");
      }
      return actions.updateTilesPositions(tab_id, tiles);
    },
    onSuccess: (_, variables) => {
      // Invalidate tiles list
      queryClient.invalidateQueries({ 
        queryKey: ['tiles', variables.tab_id] 
      });
      // Invalidate each updated tile
      variables.tiles.forEach(tile => {
        queryClient.invalidateQueries({ 
          queryKey: ['tile-by-id', tile.id] 
        });
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({ 
        queryKey: ['tab-with-tiles-by-id', variables.tab_id] 
      });
    },
  });
}

/**
 * Hook to delete a tile
 */
export function useDeleteTileQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    retry: 5,
    retryDelay: (attempt: number) => Math.min(2000 * Math.pow(2, attempt - 1), 30000),
    mutationFn: async ({ 
      id,
      tab_id, 
      name, 
      actions 
    }: { 
      id?: string;
      tab_id?: string; 
      name?: string;
      actions: GranularTileActions;
    }) => {
      if (id) {
        return actions.deleteById(id);
      } else if (tab_id && name) {
        return actions.deleteByName(tab_id, name);
      } else {
        throw new Error("Invalid arguments");
      }
    },
    onSuccess: (_, variables) => {
      const { id, tab_id, name } = variables;
      // Invalidate tiles list
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tiles', tab_id] 
        });
      }
      // Remove deleted tile from cache
      if (id) {
        queryClient.removeQueries({ 
          queryKey: ['tile-by-id', id] 
        });
      } else if (tab_id && name) {
        queryClient.removeQueries({ 
          queryKey: ['tile', tab_id, name] 
        });
      }
      // Also invalidate tab with tiles
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', tab_id] 
        });
      }
    },
  });
}

/**
 * Hook to create a checkpoint for a tile
 */
export function useCreateTileCheckpointQuery() {
  return useMutation({
    retry: 3,
    retryDelay: (attempt: number) => Math.min(2000 * Math.pow(2, attempt - 1), 15000),
    mutationFn: async ({ 
      tab_id,
      name,
      description,
      actions 
    }: { 
      tab_id: string; 
      name: string;
      description: string;
      actions: GranularTileActions;
    }) => {
      return actions.checkpointByName(tab_id, name, description);
    },
    onSuccess: (_, variables) => {
      // No need to invalidate any queries here as the checkpoint doesn't affect the current state
    },
  });
}

/**
 * Hook to get tile data based on type
 * Note: The specialized data methods (getTableData, getPlotData, etc.) 
 * need to be added to the GranularTileActions interface
 */
export function useTileDataQuery(
  tab_id: string | null,
  name: string | null,
  tileType: string | null,
  actions: GranularTileActions & {
    // These methods need to be added to the GranularTileActions interface
    getTableData?: (tab_id: string, name: string) => Promise<any>;
    getPlotData?: (tab_id: string, name: string) => Promise<any>;
    getViewData?: (tab_id: string, name: string) => Promise<any>;
  }
) {
  return useQuery({
    queryKey: [`${tileType?.toLowerCase()}-data`, tab_id, name],
    queryFn: async () => {
      if (!tab_id || !name || !tileType) return null;
      
      switch (tileType.toLowerCase()) {
        case 'table':
          return actions.getTableData?.(tab_id, name);
        case 'plot':
          return actions.getPlotData?.(tab_id, name);
        case 'view':
          return actions.getViewData?.(tab_id, name);
        default:
          return null;
      }
    },
    enabled: !!tab_id && !!name && !!tileType,
  });
}

/**
 * Hook to patch a tile by name
 */
export function usePatchTileQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    retry: 5,
    retryDelay: (attempt: number) => Math.min(2000 * Math.pow(2, attempt - 1), 30000),
    mutationFn: async ({
      id,
      tab_id, 
      name, 
      updateData, 
      actions 
    }: { 
      id?: string;
      tab_id?: string; 
      name?: string;
      updateData: Record<string, any>;
      actions: GranularTileActions;
    }) => {
      if (id) {
        return actions.patchById(id, updateData);
      } else if (tab_id && name) {
        return actions.patchByName(tab_id, name, updateData);
      } else {
        throw new Error("Invalid arguments");
      }
    },
    onSuccess: (result, variables) => {
      const { id, tab_id, name } = variables;
      
      // Invalidate tile
      if (id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tile-by-id', id] 
        });
      } else {
        queryClient.invalidateQueries({ 
          queryKey: ['tile', tab_id, name] 
        });
      }
      
      // Invalidate tiles list
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tiles', tab_id] 
        });
      }
      
      // Invalidate tab with tiles if we know the tab
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', tab_id] 
        });
      }
    },
  });
}

/**
 * Hook to patch a specialized tile by name
 */
export function usePatchSpecializedTileQuery<
  T extends TileType
>() {
  const queryClient = useQueryClient();
  
  return useMutation({
    retry: 5,
    retryDelay: (attempt: number) => Math.min(2000 * Math.pow(2, attempt - 1), 30000),
    mutationFn: async ({ 
      tab_id, 
      name, 
      tileType,
      updateData, 
      actions 
    }: { 
      tab_id: string; 
      name: string;
      tileType: T;
      updateData: Record<string, any>; 
      actions: GranularTileActions;
    }) => {
      return actions.patchSpecializedByName(tab_id, name, tileType, updateData);
    },
    onSuccess: (result, variables) => {
      const { tab_id, name, tileType } = variables;
      
      // Invalidate tile
      queryClient.invalidateQueries({ 
        queryKey: ['tile', tab_id, name] 
      });
      
      // Invalidate specialized data if we're using it
      queryClient.invalidateQueries({ 
        queryKey: ['specialized-tile-data', tab_id, name, tileType] 
      });
      
      // Invalidate tiles list
      queryClient.invalidateQueries({ 
        queryKey: ['tiles', tab_id] 
      });
      
      // Invalidate tab with tiles if we know the tab
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', tab_id] 
        });
      }
    },
  });
}

/**
 * Hook to get a checkpoint for a tile by name
 */
export function useGetTileCheckpointByNameQuery(
  tab_id: string | null,
  name: string | null,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tile-checkpoint-by-name', tab_id, name],
    queryFn: async () => {
      if (!tab_id || !name) return null;
      return actions.getCheckpointByName(tab_id, name);
    },
    enabled: !!tab_id && !!name,
  });
}

/**
 * Hook to get a checkpoint for a tile by ID
 */
export function useGetTileCheckpointByIdQuery(
  id: string | null,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tile-checkpoint-by-id', id],
    queryFn: async () => {
      if (!id) return null;
      return actions.getCheckpointById(id);
    },
    enabled: !!id,
  });
}

/**
 * Unified hook to get a checkpoint for a tile by either ID or name
 */
export function useGetTileCheckpointUnifiedQuery(
  params: {
    id?: string | null;
    tab_id?: string | null;
    name?: string | null;
  },
  actions: GranularTileActions
) {
  const { id, tab_id, name } = params;
  const usingId = !!id;
  const usingPath = !!tab_id && !!name;
  
  return useQuery({
    queryKey: usingId 
      ? ['tile-checkpoint-by-id', id] 
      : ['tile-checkpoint-by-name', tab_id, name],
    queryFn: async () => {
      return actions.getCheckpoint({
        id: id as string,
        tab_id: tab_id as string,
        name: name as string
      });
    },
    enabled: usingId || usingPath,
  });
} 