import { Tile, TileType } from '@/contexts/slices/selectors/tile';

export interface DependencyConfig {
  tileType: TileType;
  isIndependent: boolean;
  getDependencies: (tile: Tile) => string[];
  description: string;
}

export interface TileDependencyGraph {
  tileId: string;
  dependencies: Set<string>;
  dependents: Set<string>;
}

export interface DependencyGraphResult {
  sortedTileIds: string[];
  dependencyMap: Map<string, TileDependencyGraph>;
  circularDependencies: string[][];
}

/**
 * Represents the render state of a tile, including dependency and data readiness
 */
export interface TileRenderState {
  /** The tile ID */
  tileId: string;

  /** Whether the tile can be rendered (all dependencies AND own data ready) */
  canRender: boolean;

  /** Whether all dependency tiles have their data ready */
  dependenciesReady: boolean;

  /** Whether this tile is waiting for dependencies (only applies to dependent tiles) */
  isWaitingForDependencies: boolean;

  /**
   * List of missing items preventing render
   * Includes both missing dependencies and missing own data
   * Format: ["dependency: TableName", "own data: tableDataItem", ...]
   */
  missingDependencies: string[];
}

export interface DependencyManagerConfig {
  enableCircularDependencyDetection: boolean;
  maxDependencyDepth: number;
  logDependencyChanges: boolean;
}
