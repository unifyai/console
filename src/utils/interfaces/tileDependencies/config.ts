import { Tile, TileType } from "@/contexts/slices/selectors/tile";
import { getUsedTableNames } from "@/utils/data/buildPlotDataItem";
import { convertTileToTileData } from "@/contexts/utils/sliceUtils";
import { UseQueryResult } from "@tanstack/react-query";

/**
 * Unified configuration interface for each tile type
 * Handles both dependency resolution and data building/rendering logic
 */
export interface TileBuildAndRenderConfig {
  tileType: TileType;
  isIndependent: boolean;
  description: string;
  
  // External dependency resolution
  getExternalDependencies: (tile: Tile) => string[];
  
  // Building prerequisites
  needsTabArguments: boolean;
  needsExternalDependencies: boolean;
  
  // Building readiness logic
  shouldStartBuilding: (
    tabArgumentsReady: boolean,
    externalDependenciesReady: boolean
  ) => boolean;
  
  // Internal data requirements checking
  checkInternalDataReadiness: (
    tileId: string,
    tabId: string,
    queryClient: any
  ) => {
    isReady: boolean;
    missingData: string[];
  };
  
  // Data building hook management
  getDataBuildingHooks: (
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string,
    shouldStartBuilding: boolean,
    actions: any
  ) => {
    queries: UseQueryResult<any>[];
    isBuilding: boolean;
  };
}

/**
 * Extracts table dependencies from plot tile configuration
 * Reuses existing getUsedTableNames utility
 */
function getPlotDependencies(tile: Tile): string[] {
  if (!tile.plotTile) return [];
  
  const plotTileData = convertTileToTileData(tile as Tile);
  return getUsedTableNames(plotTileData);
}

/**
 * Extracts table dependency from view tile configuration
 */
function getViewDependencies(tile: Tile): string[] {
  return tile.table ? [tile.table] : [];
}

/**
 * Unified configuration for all tile types
 * Single source of truth for dependencies, building, and rendering
 */
export const TILE_BUILD_AND_RENDER_CONFIGS: Record<TileType, TileBuildAndRenderConfig> = {
  Table: {
    tileType: 'Table',
    isIndependent: true,
    description: 'Independent tile - can render immediately after own data is built',
    
    getExternalDependencies: () => [],
    
    needsTabArguments: true,
    needsExternalDependencies: false,
    
    shouldStartBuilding: (tabArgumentsReady) => tabArgumentsReady,
    
    checkInternalDataReadiness: (tileId, tabId, queryClient) => {
      const tableDataItem = queryClient.getQueryData(['tableDataItem', tileId]);
      const tableArguments = queryClient.getQueryData(['tableArguments', tabId]);
      
      const missingData: string[] = [];
      if (!tableDataItem) missingData.push('tableDataItem');
      if (!tableArguments) missingData.push('tableArguments');
      
      return {
        isReady: missingData.length === 0,
        missingData
      };
    },
    
    getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
      // This will be implemented by the hook that calls this config
      return { queries: [], isBuilding: false };
    }
  },
  
  Plot: {
    tileType: 'Plot',
    isIndependent: false,
    description: 'Dependent tile - requires table tiles referenced in x_axis, y_axis, plot_group_by',
    
    getExternalDependencies: getPlotDependencies,
    
    needsTabArguments: true,
    needsExternalDependencies: true,
    
    shouldStartBuilding: (tabArgumentsReady, externalDependenciesReady) => 
      tabArgumentsReady && externalDependenciesReady,
    
    checkInternalDataReadiness: (tileId, tabId, queryClient) => {
      const plotDataItem = queryClient.getQueryData(['plotDataItem', tileId]);
      const plotArguments = queryClient.getQueryData(['plotArguments', tabId]);
      
      const missingData: string[] = [];
      if (!plotDataItem) missingData.push('plotDataItem');
      if (!plotArguments) missingData.push('plotArguments');
      
      return {
        isReady: missingData.length === 0,
        missingData
      };
    },
    
    getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
      return { queries: [], isBuilding: false };
    }
  },
  
  View: {
    tileType: 'View',
    isIndependent: false,
    description: 'Dependent tile - requires the table tile specified in table property',
    
    getExternalDependencies: getViewDependencies,
    
    needsTabArguments: false,
    needsExternalDependencies: true,
    
    shouldStartBuilding: (tabArgumentsReady, externalDependenciesReady) => externalDependenciesReady,
    
    checkInternalDataReadiness: (tileId, tabId, queryClient) => {
      // Views typically don't have specific internal data requirements beyond dependencies
      return {
        isReady: true,
        missingData: []
      };
    },
    
    getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
      return { queries: [], isBuilding: false };
    }
  },
  
  Editor: {
    tileType: 'Editor',
    isIndependent: true,
    description: 'Independent tile - can render immediately',
    
    getExternalDependencies: () => [],
    
    needsTabArguments: false,
    needsExternalDependencies: false,
    
    shouldStartBuilding: () => true,
    
    checkInternalDataReadiness: (tileId, tabId, queryClient) => {
      // Editors manage their own internal state
      return {
        isReady: true,
        missingData: []
      };
    },
    
    getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
      return { queries: [], isBuilding: false };
    }
  },
  
  Terminal: {
    tileType: 'Terminal',
    isIndependent: true,
    description: 'Independent tile - can render immediately',
    
    getExternalDependencies: () => [],
    
    needsTabArguments: false,
    needsExternalDependencies: false,
    
    shouldStartBuilding: () => true,
    
    checkInternalDataReadiness: (tileId, tabId, queryClient) => {
      // Terminals manage their own internal state
      return {
        isReady: true,
        missingData: []
      };
    },
    
    getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
      return { queries: [], isBuilding: false };
    }
  }
};

/**
 * Get unified configuration for a tile type
 */
export function getTileBuildAndRenderConfig(tileType: TileType): TileBuildAndRenderConfig {
  return TILE_BUILD_AND_RENDER_CONFIGS[tileType];
}

/**
 * Check if a tile type is independent
 */
export function isIndependentTileType(tileType: TileType): boolean {
  return TILE_BUILD_AND_RENDER_CONFIGS[tileType].isIndependent;
}

/**
 * Get all independent tile types
 */
export function getIndependentTileTypes(): TileType[] {
  return Object.keys(TILE_BUILD_AND_RENDER_CONFIGS)
    .filter(type => TILE_BUILD_AND_RENDER_CONFIGS[type as TileType].isIndependent) as TileType[];
}

/**
 * Get all dependent tile types
 */
export function getDependentTileTypes(): TileType[] {
  return Object.keys(TILE_BUILD_AND_RENDER_CONFIGS)
    .filter(type => !TILE_BUILD_AND_RENDER_CONFIGS[type as TileType].isIndependent) as TileType[];
}
