'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { GranularTileActions, TileData, TilePosition } from '@/types/interfaces/grid';
import { useQueryClient } from '@tanstack/react-query';
import { TileType } from '@/contexts/slices/selectors/tile';

/**
 * Hook to fetch all tiles for a tab
 */
export function useListTilesQuery(
  tabId: string | null,
  type: string | null,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tiles', tabId, type],
    queryFn: async () => {
      if (!tabId) return [];
      return actions.list(tabId, type || undefined);
    },
    enabled: !!tabId,
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
  tabId: string | null,
  name: string | null,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tile', tabId, name],
    queryFn: async () => {
      if (!tabId || !name) return null;
      return actions.getByName(tabId, name);
    },
    enabled: !!tabId && !!name,
  });
}

/**
 * Hook to fetch a specific tile by ID
 */
export function useGetTileByIdQuery(id: string | null, actions: GranularTileActions) {
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
    tabId?: string | null;
    name?: string | null;
    checkpoint?: boolean;
  },
  actions: GranularTileActions
) {
  const { id, tabId, name, checkpoint } = params;
  const usingId = !!id;
  const usingPath = !!tabId && !!name;

  return useQuery({
    queryKey: usingId ? ['tile-by-id', id, checkpoint] : ['tile', tabId, name, checkpoint],
    queryFn: async () => {
      if (usingId) {
        return actions.getById(id as string, checkpoint);
      } else if (usingPath) {
        return actions.getByName(tabId as string, name as string, checkpoint);
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
      tabId,
      name,
      position,
      data,
      type,
      tileId,
      actions,
    }: {
      tabId: string;
      name: string;
      position: TilePosition;
      data: Omit<
        Partial<TileData>,
        'id' | 'tabId' | 'name' | 'type' | 'position' | 'createdAt' | 'updatedAt'
      >;
      tileId?: string;
      type?: string;
      actions: GranularTileActions;
    }) => {
      return actions.create(tabId, name, position, data, tileId, type);
    },
    onSuccess: (result, variables) => {
      // Invalidate tiles for this tab
      if (result && 'tabId' in result) {
        queryClient.invalidateQueries({
          queryKey: ['tiles', result.tabId],
        });
        // Also invalidate tab with tiles
        queryClient.invalidateQueries({
          queryKey: ['tab-with-tiles-by-id', result.tabId],
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
      tabId,
      name,
      data,
      actions,
    }: {
      id?: string;
      tabId?: string;
      name?: string;
      data: Omit<Partial<TileData>, 'id' | 'tabId' | 'createdAt' | 'updatedAt'>;
      actions: GranularTileActions;
    }) => {
      if (id) {
        return actions.updateById(id, data);
      } else if (tabId && name) {
        return actions.updateByName(tabId, name, data);
      } else {
        throw new Error('Invalid arguments');
      }
    },
    onSuccess: (result, variables) => {
      // Invalidate specific tile and tiles list
      const { id, tabId, name } = variables;
      if (id) {
        queryClient.invalidateQueries({
          queryKey: ['tile-by-id', id],
        });
      } else if (tabId && name) {
        queryClient.invalidateQueries({
          queryKey: ['tile', tabId, name],
        });
      }
      // Invalidate tiles list
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tiles', tabId],
        });
      }
      // Also invalidate tab with tiles
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tab-with-tiles-by-id', tabId],
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
      tabId,
      tiles,
      actions,
    }: {
      tabId: string;
      tiles: Array<{
        id: string;
        position: TilePosition;
      }>;
      actions: GranularTileActions & {
        // This method needs to be added to the GranularTileActions interface
        updateTilesPositions?: (
          tabId: string,
          tiles: Array<{
            id: string;
            position: TilePosition;
          }>
        ) => Promise<TileData[]>;
      };
    }) => {
      if (!actions.updateTilesPositions) {
        throw new Error('updateTilesPositions method is not implemented');
      }
      return actions.updateTilesPositions(tabId, tiles);
    },
    onSuccess: (_, variables) => {
      // Invalidate tiles list
      queryClient.invalidateQueries({
        queryKey: ['tiles', variables.tabId],
      });
      // Invalidate each updated tile
      variables.tiles.forEach((tile) => {
        queryClient.invalidateQueries({
          queryKey: ['tile-by-id', tile.id],
        });
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({
        queryKey: ['tab-with-tiles-by-id', variables.tabId],
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
      tabId,
      name,
      actions,
    }: {
      id?: string;
      tabId?: string;
      name?: string;
      actions: GranularTileActions;
    }) => {
      if (id) {
        return actions.deleteById(id);
      } else if (tabId && name) {
        return actions.deleteByName(tabId, name);
      } else {
        throw new Error('Invalid arguments');
      }
    },
    onSuccess: (_, variables) => {
      const { id, tabId, name } = variables;
      // Invalidate tiles list
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tiles', tabId],
        });
      }
      // Remove deleted tile from cache
      if (id) {
        queryClient.removeQueries({
          queryKey: ['tile-by-id', id],
        });
      } else if (tabId && name) {
        queryClient.removeQueries({
          queryKey: ['tile', tabId, name],
        });
      }
      // Also invalidate tab with tiles
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tab-with-tiles-by-id', tabId],
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
      tabId,
      name,
      description,
      actions,
    }: {
      tabId: string;
      name: string;
      description: string;
      actions: GranularTileActions;
    }) => {
      return actions.checkpointByName(tabId, name, description);
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
  tabId: string | null,
  name: string | null,
  tileType: string | null,
  actions: GranularTileActions & {
    // These methods need to be added to the GranularTileActions interface
    getTableData?: (tabId: string, name: string) => Promise<any>;
    getPlotData?: (tabId: string, name: string) => Promise<any>;
    getViewData?: (tabId: string, name: string) => Promise<any>;
    getEditorData?: (tabId: string, name: string) => Promise<any>;
    getTerminalData?: (tabId: string, name: string) => Promise<any>;
  }
) {
  return useQuery({
    queryKey: [`${tileType?.toLowerCase()}-data`, tabId, name],
    queryFn: async () => {
      if (!tabId || !name || !tileType) return null;

      switch (tileType.toLowerCase()) {
        case 'table':
          return actions.getTableData?.(tabId, name);
        case 'plot':
          return actions.getPlotData?.(tabId, name);
        case 'view':
          return actions.getViewData?.(tabId, name);
        case 'editor':
          return actions.getEditorData?.(tabId, name);
        case 'terminal':
          return actions.getTerminalData?.(tabId, name);
        default:
          return null;
      }
    },
    enabled: !!tabId && !!name && !!tileType,
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
      tabId,
      name,
      updateData,
      actions,
    }: {
      id?: string;
      tabId?: string;
      name?: string;
      updateData: Record<string, any>;
      actions: GranularTileActions;
    }) => {
      if (id) {
        return actions.patchById(id, updateData);
      } else if (tabId && name) {
        return actions.patchByName(tabId, name, updateData);
      } else {
        throw new Error('Invalid arguments');
      }
    },
    onSuccess: (result, variables) => {
      const { id, tabId, name } = variables;

      // Invalidate tile
      if (id) {
        queryClient.invalidateQueries({
          queryKey: ['tile-by-id', id],
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ['tile', tabId, name],
        });
      }

      // Invalidate tiles list
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tiles', tabId],
        });
      }

      // Invalidate tab with tiles if we know the tab
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tab-with-tiles-by-id', tabId],
        });
      }
    },
  });
}

/**
 * Hook to patch a specialized tile by name
 */
export function usePatchSpecializedTileQuery<T extends TileType>() {
  const queryClient = useQueryClient();

  return useMutation({
    retry: 5,
    retryDelay: (attempt: number) => Math.min(2000 * Math.pow(2, attempt - 1), 30000),
    mutationFn: async ({
      tabId,
      name,
      tileType,
      updateData,
      actions,
    }: {
      tabId: string;
      name: string;
      tileType: T;
      updateData: Record<string, any>;
      actions: GranularTileActions;
    }) => {
      return actions.patchSpecializedByName(tabId, name, tileType, updateData);
    },
    onSuccess: (result, variables) => {
      const { tabId, name, tileType } = variables;

      // Invalidate tile
      queryClient.invalidateQueries({
        queryKey: ['tile', tabId, name],
      });

      // Invalidate specialized data if we're using it
      queryClient.invalidateQueries({
        queryKey: ['specialized-tile-data', tabId, name, tileType],
      });

      // Invalidate tiles list
      queryClient.invalidateQueries({
        queryKey: ['tiles', tabId],
      });

      // Invalidate tab with tiles if we know the tab
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tab-with-tiles-by-id', tabId],
        });
      }
    },
  });
}

/**
 * Hook to get a checkpoint for a tile by name
 */
export function useGetTileCheckpointByNameQuery(
  tabId: string | null,
  name: string | null,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tile-checkpoint-by-name', tabId, name],
    queryFn: async () => {
      if (!tabId || !name) return null;
      return actions.getCheckpointByName(tabId, name);
    },
    enabled: !!tabId && !!name,
  });
}

/**
 * Hook to get a checkpoint for a tile by ID
 */
export function useGetTileCheckpointByIdQuery(id: string | null, actions: GranularTileActions) {
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
    tabId?: string | null;
    name?: string | null;
  },
  actions: GranularTileActions
) {
  const { id, tabId, name } = params;
  const usingId = !!id;
  const usingPath = !!tabId && !!name;

  return useQuery({
    queryKey: usingId ? ['tile-checkpoint-by-id', id] : ['tile-checkpoint-by-name', tabId, name],
    queryFn: async () => {
      return actions.getCheckpoint({
        id: id as string,
        tabId: tabId as string,
        name: name as string,
      });
    },
    enabled: usingId || usingPath,
  });
}
