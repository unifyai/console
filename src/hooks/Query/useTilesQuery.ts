"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GranularTileActions, TileData, TilePosition, TableTileData, PlotTileData, ViewTileData, EditorTileData } from '@/types/evals/grid';

/**
 * Hook to fetch all tiles for a tab
 */
export function useListTilesQuery(
  projectId: string | null,
  interfaceName: string | null,
  tabName: string | null,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tiles', projectId, interfaceName, tabName],
    queryFn: async () => {
      if (!projectId || !interfaceName || !tabName) return [];
      return actions.listTiles(projectId, interfaceName, tabName);
    },
    enabled: !!projectId && !!interfaceName && !!tabName,
  });
}

/**
 * Hook to fetch a specific tile by name
 */
export function useGetTileQuery(
  projectId: string | null,
  interfaceName: string | null,
  tabName: string | null,
  tileName: string | null,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tile', projectId, interfaceName, tabName, tileName],
    queryFn: async () => {
      if (!projectId || !interfaceName || !tabName || !tileName) return null;
      return actions.getTileByName(projectId, interfaceName, tabName, tileName);
    },
    enabled: !!projectId && !!interfaceName && !!tabName && !!tileName,
  });
}

/**
 * Hook to create a new tile
 */
export function useCreateTileQuery() {
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
        name: string;
        type: string;
        position: TilePosition;
        min_width?: number;
        min_height?: number;
        visible?: boolean;
        locked?: boolean;
        context?: string;
        table?: string;
        auto_update?: string;
        freeze?: string;
        filters?: string;
        common_filter?: string;
        metric?: string;
        table_tile?: TableTileData;
        plot_tile?: PlotTileData;
        view_tile?: ViewTileData;
        editor_tile?: EditorTileData;
      }; 
      actions: GranularTileActions;
    }) => {
      return actions.createTile(projectId, interfaceName, tabName, data);
    },
    onSuccess: (_, variables) => {
      // Invalidate tiles query to refetch the list
      queryClient.invalidateQueries({ 
        queryKey: ['tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({ 
        queryKey: ['tab-with-tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
    },
  });
}

/**
 * Hook to update a tile
 */
export function useUpdateTileQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      tabName, 
      tileName, 
      data, 
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabName: string;
      tileName: string;
      data: { 
        name?: string;
        position?: TilePosition;
        min_width?: number;
        min_height?: number;
        visible?: boolean;
        locked?: boolean;
        context?: string;
        table?: string;
        auto_update?: string;
        freeze?: string;
        filters?: string;
        common_filter?: string;
        metric?: string;
        table_tile?: TableTileData;
        plot_tile?: PlotTileData;
        view_tile?: ViewTileData;
        editor_tile?: EditorTileData;
      }; 
      actions: GranularTileActions;
    }) => {
      return actions.updateTile(projectId, interfaceName, tabName, tileName, data);
    },
    onSuccess: (_, variables) => {
      // Invalidate specific tile and tiles list
      queryClient.invalidateQueries({ 
        queryKey: ['tile', variables.projectId, variables.interfaceName, variables.tabName, variables.tileName] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({ 
        queryKey: ['tab-with-tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
    },
  });
}

/**
 * Hook to update tile positions (for drag and drop grid layout)
 */
export function useUpdateTilesPositionsQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      tabName, 
      tiles, 
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabName: string;
      tiles: Array<{
        id: string;
        position: TilePosition;
      }>;
      actions: GranularTileActions;
    }) => {
      return actions.updateTilesPositions(projectId, interfaceName, tabName, tiles);
    },
    onSuccess: (_, variables) => {
      // Invalidate tiles list
      queryClient.invalidateQueries({ 
        queryKey: ['tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      // Invalidate each updated tile
      variables.tiles.forEach(tile => {
        queryClient.invalidateQueries({ 
          queryKey: ['tile', variables.projectId, variables.interfaceName, variables.tabName, tile.id] 
        });
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({ 
        queryKey: ['tab-with-tiles', variables.projectId, variables.interfaceName, variables.tabName] 
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
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      tabName, 
      tileName, 
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabName: string;
      tileName: string;
      actions: GranularTileActions;
    }) => {
      return actions.deleteTile(projectId, interfaceName, tabName, tileName);
    },
    onSuccess: (_, variables) => {
      // Invalidate tiles list
      queryClient.invalidateQueries({ 
        queryKey: ['tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      // Remove deleted tile from cache
      queryClient.removeQueries({ 
        queryKey: ['tile', variables.projectId, variables.interfaceName, variables.tabName, variables.tileName] 
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({ 
        queryKey: ['tab-with-tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
    },
  });
}

/**
 * Hook to create a checkpoint for a tile
 */
export function useCreateTileCheckpointQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName,
      tabName,
      tileName,
      description,
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabName: string;
      tileName: string;
      description: string;
      actions: GranularTileActions;
    }) => {
      return actions.createTileCheckpoint(projectId, interfaceName, tabName, tileName, description);
    },
    onSuccess: (_, variables) => {
      // Invalidate checkpoints query to refetch data
      queryClient.invalidateQueries({ 
        queryKey: ['tiles', variables.projectId, variables.interfaceName, variables.tabName, true] 
      });
    },
  });
}

/**
 * Hook to fetch data for a tile based on its type
 */
export function useTileDataQuery(
  projectId: string | null,
  interfaceName: string | null,
  tabName: string | null,
  tileName: string | null,
  tileType: string | null,
  isCheckpoint: boolean = false,
  actions: GranularTileActions
) {
  return useQuery({
    queryKey: ['tileData', projectId, interfaceName, tabName, tileName, tileType, isCheckpoint],
    queryFn: async () => {
      if (!projectId || !interfaceName || !tabName || !tileName || !tileType) return null;
      
      // Different data fetching based on tile type
      switch(tileType) {
        case 'table':
          return actions.getTableData(projectId, interfaceName, tabName, tileName, isCheckpoint);
        case 'plot':
          return actions.getPlotData(projectId, interfaceName, tabName, tileName, isCheckpoint);
        case 'view':
          return actions.getViewData(projectId, interfaceName, tabName, tileName, isCheckpoint);
        case 'editor':
          return actions.getEditorData(projectId, interfaceName, tabName, tileName, isCheckpoint);
        default:
          return null;
      }
    },
    enabled: !!projectId && !!interfaceName && !!tabName && !!tileName && !!tileType,
  });
}

/**
 * Hook to patch a tile (partial update)
 */
export function usePatchTileQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      tabName, 
      tileName, 
      updateData, 
      checkpoint = false,
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabName: string;
      tileName: string;
      updateData: {
        name?: string;
        position?: TilePosition;
        min_width?: number;
        min_height?: number;
        visible?: boolean;
        locked?: boolean;
        moved?: boolean;
        static?: boolean;
        context?: string;
        table?: string;
        auto_update?: string;
        freeze?: string;
        filters?: string;
        common_filter?: string;
        metric?: string;
        table_tile?: TableTileData;
        plot_tile?: PlotTileData;
        view_tile?: ViewTileData;
        editor_tile?: EditorTileData;
      };
      checkpoint?: boolean;
      actions: GranularTileActions;
    }) => {
      return actions.patchTile(projectId, interfaceName, tabName, tileName, updateData, checkpoint);
    },
    onSuccess: (_, variables) => {
      // Invalidate specific tile and tiles list
      queryClient.invalidateQueries({ 
        queryKey: ['tile', variables.projectId, variables.interfaceName, variables.tabName, variables.tileName] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({ 
        queryKey: ['tab-with-tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      // Invalidate any tile data
      queryClient.invalidateQueries({
        queryKey: ['tileData', variables.projectId, variables.interfaceName, variables.tabName, variables.tileName]
      });
    },
  });
}

/**
 * Hook to patch a specialized tile (table, plot, view, editor)
 */
export function usePatchSpecializedTileQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      interfaceName, 
      tabName, 
      tileName, 
      tileType,
      updateData, 
      checkpoint = false,
      actions 
    }: { 
      projectId: string; 
      interfaceName: string;
      tabName: string;
      tileName: string;
      tileType: "Table" | "Plot" | "View" | "Editor";
      updateData: Record<string, any>;
      checkpoint?: boolean;
      actions: GranularTileActions;
    }) => {
      return actions.patchSpecializedTile(
        projectId, 
        interfaceName, 
        tabName, 
        tileName, 
        tileType,
        updateData,
        checkpoint
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate specific tile and tiles list
      queryClient.invalidateQueries({ 
        queryKey: ['tile', variables.projectId, variables.interfaceName, variables.tabName, variables.tileName] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      // Also invalidate tab with tiles
      queryClient.invalidateQueries({ 
        queryKey: ['tab-with-tiles', variables.projectId, variables.interfaceName, variables.tabName] 
      });
      // Invalidate any tile data
      queryClient.invalidateQueries({
        queryKey: ['tileData', variables.projectId, variables.interfaceName, variables.tabName, variables.tileName, variables.tileType.toLowerCase()]
      });
    },
  });
} 