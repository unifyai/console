import { Tile, TileType } from '@/contexts/slices/selectors/tile';
import { getUsedTableNames } from '@/utils/data/buildPlotDataItem';
import { convertTileToTileData } from '@/contexts/utils/sliceUtils';
import { UseQueryResult } from '@tanstack/react-query';

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
  shouldStartBuilding: (tabArgumentsReady: boolean, externalDependenciesReady: boolean) => boolean;

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
      const tableDataItem = queryClient.getQueryData(['tableDataItem', tileId]) as
        | {
            isLoading?: boolean;
            logs?: any[];
            fields?: object;
            contextNotFound?: boolean; // Set when context returns 404
            error?: string;
          }
        | undefined;
      const tableArguments = queryClient.getQueryData(['tableArguments', tabId]);

      const missingData: string[] = [];
      if (!tableDataItem) {
        missingData.push('tableDataItem');
      } else if (tableDataItem.isLoading) {
        // Data exists but is still loading - not ready yet!
        missingData.push('tableDataItem (loading)');
      } else if (tableDataItem.contextNotFound) {
        // Context doesn't exist (404) - this is a valid "ready" state
        // The tile should render with an error/empty message instead of waiting forever
        console.log(
          `[checkInternalDataReadiness] contextNotFound=true for tile ${tileId}, marking as READY`
        );
        // Don't add to missingData - we're ready to render
      } else if (tableDataItem.error) {
        // Any error state (including context not found from catch block) - ready to show error UI
        console.log(
          `[checkInternalDataReadiness] error="${tableDataItem.error}" for tile ${tileId}, marking as READY`
        );
        // Don't add to missingData - we're ready to render error state
      }
      // Note: Empty tables (no logs, no fields) are VALID - this can happen for:
      // 1. Newly created tables
      // 2. Tables with context: null and no data in the project
      // 3. Tables where the filter returns no results
      // So we don't check for empty logs/fields anymore - if tableDataItem exists
      // and isn't loading/error, it's ready to render (even if empty)
      if (!tableArguments) missingData.push('tableArguments');

      console.log(
        `[checkInternalDataReadiness] tile ${tileId}: contextNotFound=${tableDataItem?.contextNotFound}, error=${tableDataItem?.error}, isReady=${missingData.length === 0}, missing=${JSON.stringify(missingData)}`
      );

      return {
        isReady: missingData.length === 0,
        missingData,
      };
    },

    getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
      // This will be implemented by the hook that calls this config
      return { queries: [], isBuilding: false };
    },
  },

  Plot: {
    tileType: 'Plot',
    isIndependent: false,
    description: 'Dependent tile - requires table tiles referenced in xAxis, yAxis, plotGroupBy',

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
        missingData,
      };
    },

    getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
      return { queries: [], isBuilding: false };
    },
  },

  View: {
    tileType: 'View',
    isIndependent: false,
    description: 'Dependent tile - requires the table tile specified in table property',

    getExternalDependencies: getViewDependencies,

    needsTabArguments: false,
    needsExternalDependencies: true,

    shouldStartBuilding: (tabArgumentsReady, externalDependenciesReady) =>
      externalDependenciesReady,

    checkInternalDataReadiness: (tileId, tabId, queryClient) => {
      // Views typically don't have specific internal data requirements beyond dependencies
      return {
        isReady: true,
        missingData: [],
      };
    },

    getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
      return { queries: [], isBuilding: false };
    },
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
        missingData: [],
      };
    },

    getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
      return { queries: [], isBuilding: false };
    },
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
        missingData: [],
      };
    },

    getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
      return { queries: [], isBuilding: false };
    },
  },
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
  return Object.keys(TILE_BUILD_AND_RENDER_CONFIGS).filter(
    (type) => TILE_BUILD_AND_RENDER_CONFIGS[type as TileType].isIndependent
  ) as TileType[];
}

/**
 * Get all dependent tile types
 */
export function getDependentTileTypes(): TileType[] {
  return Object.keys(TILE_BUILD_AND_RENDER_CONFIGS).filter(
    (type) => !TILE_BUILD_AND_RENDER_CONFIGS[type as TileType].isIndependent
  ) as TileType[];
}
