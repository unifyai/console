// Types
export type {
  DependencyConfig,
  TileDependencyGraph,
  DependencyGraphResult,
  TileRenderState,
  DependencyManagerConfig,
} from './types';

// Unified Configuration (replaces both old configs and strategies)
export type { TileBuildAndRenderConfig } from './config';
export {
  TILE_BUILD_AND_RENDER_CONFIGS,
  getTileBuildAndRenderConfig,
  isIndependentTileType,
  getIndependentTileTypes,
  getDependentTileTypes,
} from './config';

// Core dependency manager
export {
  buildTileDependencyGraph,
  useTileDependencyGraphForTab,
  useDependencyAwareSortedTilesForTab,
  useEnsureTabArguments,
  useEnsureTileDataBeforeRender,
} from './dependencyManager';
