"use client";

import { useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Tile, TileType } from "@/contexts/slices/selectors/tile";
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { selectTileById, selectTilesForTab } from "@/contexts/selectors/tile";
import { useEnsureTableTileData } from '@/hooks/Interfaces/Query/useEnsureTableTileData';
import { useEnsurePlotTileData } from '@/hooks/Interfaces/Query/useEnsurePlotTileData';
import { updateTabArguments, fetchProjectsContextsFields, OptimisticUpdateDependencies } from '@/utils/data/buildServerDataOptimistic';
import { ContextActions, FieldsActions, GranularTileActions, LogsActions, ProjectsActions, TileData } from '@/types/interfaces/grid';
import { TableArguments, PlotArguments } from '@/types/interfaces/logs';
import { getTileBuildAndRenderConfig } from "./config";
import { 
  DependencyGraphResult, 
  TileDependencyGraph, 
  TileRenderState, 
  DependencyManagerConfig,
} from "./types";

/**
 * Debug flag for tile dependency logging
 * Set NEXT_PUBLIC_DEBUG_TILE_DEPENDENCIES=true to enable detailed logging
 */
const DEBUG_TILE_DEPENDENCIES = process.env.NEXT_PUBLIC_DEBUG_TILE_DEPENDENCIES === 'true';

/**
 * Conditional debug logger for tile dependencies
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_TILE_DEPENDENCIES) {
    console.log(...args);
  }
};

/**
 * Conditional debug warn for tile dependencies
 */
const debugWarn = (...args: any[]) => {
  if (DEBUG_TILE_DEPENDENCIES) {
    console.warn(...args);
  }
};

/**
 * Default configuration for dependency manager
 */
const DEFAULT_CONFIG: DependencyManagerConfig = {
  enableCircularDependencyDetection: true,
  maxDependencyDepth: 10,
  logDependencyChanges: true
};

/**
 * Builds a dependency graph from tiles with topological sorting
 * Optimized with proper circular dependency detection
 */
export function buildTileDependencyGraph(
  tiles: Tile[],
  config: Partial<DependencyManagerConfig> = {}
): DependencyGraphResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Create dependency map
  const dependencyMap = new Map<string, TileDependencyGraph>();
  const tileByName = new Map<string, Tile>();
  
  // Index tiles by ID and name
  tiles.forEach(tile => {
    dependencyMap.set(tile.id, {
      tileId: tile.id,
      dependencies: new Set(),
      dependents: new Set()
    });
    
    if (tile.name) {
      tileByName.set(tile.name, tile);
    }
  });
  
  // Build dependencies for each tile using unified config
  tiles.forEach(tile => {
    const tileType = tile.type as TileType;
    if (!tileType) return;
    
    const config = getTileBuildAndRenderConfig(tileType);
    const dependencies = config.getExternalDependencies(tile);
    const tileGraph = dependencyMap.get(tile.id)!;
    
    dependencies.forEach(depName => {
      const depTile = tileByName.get(depName);
      if (depTile && depTile.id !== tile.id) {
        tileGraph.dependencies.add(depTile.id);
        
        // Add reverse dependency
        const depGraph = dependencyMap.get(depTile.id);
        if (depGraph) {
          depGraph.dependents.add(tile.id);
        }
      }
    });
  });
  
  // Detect circular dependencies
  const circularDependencies: string[][] = [];
  if (finalConfig.enableCircularDependencyDetection) {
    circularDependencies.push(...detectCircularDependencies(dependencyMap, finalConfig.maxDependencyDepth));
  }
  
  // Remove circular dependencies from the graph
  circularDependencies.forEach(cycle => {
    for (let i = 0; i < cycle.length; i++) {
      const currentId = cycle[i];
      const nextId = cycle[(i + 1) % cycle.length];
      
      const currentGraph = dependencyMap.get(currentId);
      const nextGraph = dependencyMap.get(nextId);
      
      if (currentGraph && nextGraph) {
        currentGraph.dependencies.delete(nextId);
        nextGraph.dependents.delete(currentId);
      }
    }
  });
  
  // Perform topological sort
  const sortedTileIds = topologicalSort(dependencyMap);
  
  if (finalConfig.logDependencyChanges) {
    const tileById = new Map(tiles.map(t => [t.id, t]));
    debugLog(`[DependencyManager] Sorted ${sortedTileIds.length} tiles:`, 
      sortedTileIds.map(id => {
        const tile = tileById.get(id);
        return `${tile?.name}(${tile?.type})`;
      })
    );
    
    if (circularDependencies.length > 0) {
      debugWarn(`[DependencyManager] Detected ${circularDependencies.length} circular dependencies:`, 
        circularDependencies.map(cycle => 
          cycle.map(id => tileById.get(id)?.name).join(' -> ')
        )
      );
    }
  }
  
  return {
    sortedTileIds,
    dependencyMap,
    circularDependencies
  };
}

/**
 * Detects circular dependencies in the dependency graph
 */
function detectCircularDependencies(
  dependencyMap: Map<string, TileDependencyGraph>,
  maxDepth: number
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(tileId: string, path: string[]): void {
    if (path.length > maxDepth) return;
    
    if (recursionStack.has(tileId)) {
      // Found a cycle
      const cycleStart = path.indexOf(tileId);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        cycles.push([...cycle, tileId]);
      }
      return;
    }
    
    if (visited.has(tileId)) return;
    
    visited.add(tileId);
    recursionStack.add(tileId);
    
    const tileGraph = dependencyMap.get(tileId);
    if (tileGraph) {
      tileGraph.dependencies.forEach(depId => {
        dfs(depId, [...path, tileId]);
      });
    }
    
    recursionStack.delete(tileId);
  }
  
  for (const tileId of Array.from(dependencyMap.keys())) {
    if (!visited.has(tileId)) {
      dfs(tileId, []);
    }
  }
  
  return cycles;
}

/**
 * Performs topological sort on the dependency graph
 */
function topologicalSort(dependencyMap: Map<string, TileDependencyGraph>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function visit(tileId: string): boolean {
    if (visiting.has(tileId)) {
      // Circular dependency - skip this edge
      return false;
    }
    
    if (visited.has(tileId)) {
      return true;
    }
    
    visiting.add(tileId);
    
    const tileGraph = dependencyMap.get(tileId);
    if (tileGraph) {
      // Visit all dependencies first
      const deps = Array.from(tileGraph.dependencies);
      for (const depId of deps) {
        if (!visit(depId)) {
          // Remove problematic dependency
          tileGraph.dependencies.delete(depId);
          const depGraph = dependencyMap.get(depId);
          if (depGraph) {
            depGraph.dependents.delete(tileId);
          }
        }
      }
    }
    
    visiting.delete(tileId);
    visited.add(tileId);
    sorted.push(tileId);
    
    return true;
  }
  
  // Visit all tiles
  Array.from(dependencyMap.keys()).forEach(tileId => {
    visit(tileId);
  });
  
  return sorted;
}

/**
 * Hook to build and manage tile dependency graph using store selector
 * More efficient as it gets tiles directly from the store
 */
export function useTileDependencyGraphForTab(
  tabId: string,
  config?: Partial<DependencyManagerConfig>
): DependencyGraphResult {
  const storeApi = useStoreApiContext();
  const state = storeApi.getState();

  const tiles = selectTilesForTab(state, tabId);
  return buildTileDependencyGraph(tiles, config);
}

/**
 * Get tiles sorted by dependencies using store selector
 * This is the main hook that components should use - more efficient version
 */
export function useDependencyAwareSortedTilesForTab(
  tabId: string,
  config?: Partial<DependencyManagerConfig>
): {
  sortedTiles: Tile[];
  dependencyGraph: DependencyGraphResult;
} {
  const storeApi = useStoreApiContext();
  const state = storeApi.getState();
    
  const tiles = selectTilesForTab(state, tabId);
  const dependencyGraph = buildTileDependencyGraph(tiles, config);
  
  const sortedTiles = useMemo(() => {
    const tileById = new Map(tiles.map(t => [t.id, t]));
    return dependencyGraph.sortedTileIds
      .map(id => tileById.get(id))
      .filter((tile): tile is Tile => !!tile);
  }, [tiles, dependencyGraph.sortedTileIds]);
  
  return {
    sortedTiles,
    dependencyGraph
  };
}

/**
 * Hook that ensures tab-level arguments (tableArguments and plotArguments) are built
 * This must run before individual tiles can be rendered
 */
export function useEnsureTabArguments(
  tabId: string,
  projectId: string,
  actions: {
    tileActions: GranularTileActions;
    projectsActions: ProjectsActions;
    contextActions: ContextActions;
    fieldsActions: FieldsActions;
    logsActions: LogsActions;
  }
) {
  const queryClient = useQueryClient();
  
  return useQuery<{ tableArguments: TableArguments; plotArguments: PlotArguments }>({
    queryKey: ["ensureTabArguments", tabId, projectId],
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!tabId && !!projectId,
    queryFn: async () => {
      debugLog(`[useEnsureTabArguments] Building arguments for tab ${tabId}`);
      
      // Fast-path: check if both arguments already exist
      const existingTableArgs = queryClient.getQueryData<TableArguments>(["tableArguments", tabId]);
      const existingPlotArgs = queryClient.getQueryData<PlotArguments>(["plotArguments", tabId]);
      
      if (existingTableArgs && existingPlotArgs) {
        debugLog(`[useEnsureTabArguments] Arguments already cached for tab ${tabId}`);
        return { tableArguments: existingTableArgs, plotArguments: existingPlotArgs };
      }

      // Get tiles for this tab
      let tiles = queryClient.getQueryData<TileData[]>(["tiles", tabId]);
      if (!tiles || (typeof tiles === "object" && Object.keys(tiles).includes("error"))) {
        tiles = await actions.tileActions.list(tabId, undefined, false);
        queryClient.setQueryData(["tiles", tabId], tiles);
      }

      if (!tiles || tiles.length === 0) {
        // No tiles, set empty arguments
        const emptyTableArgs = {};
        const emptyPlotArgs = {};
        
        queryClient.setQueryData(["tableArguments", tabId], emptyTableArgs);
        queryClient.setQueryData(["plotArguments", tabId], emptyPlotArgs);
        
        return { tableArguments: emptyTableArgs, plotArguments: emptyPlotArgs };
      }

      // Build dependencies
      const dependencies: OptimisticUpdateDependencies = {
        queryClient,
        projectId,
        tabId,
        projectsActions: actions.projectsActions,
        contextActions: actions.contextActions,
        fieldsActions: actions.fieldsActions,
        logsActions: actions.logsActions,
      };

      // Get table tiles to fetch fields
      const tableTiles = tiles.filter(t => t.type === "Table");
      
      if (tableTiles.length === 0) {
        // No table tiles, set empty arguments
        const emptyTableArgs = {};
        const emptyPlotArgs = {};
        
        queryClient.setQueryData(["tableArguments", tabId], emptyTableArgs);
        queryClient.setQueryData(["plotArguments", tabId], emptyPlotArgs);
        
        return { tableArguments: emptyTableArgs, plotArguments: emptyPlotArgs };
      }

      // Fetch fields for table tiles
      const { fieldsArray } = await fetchProjectsContextsFields(
        dependencies,
        tableTiles,
        { refetchFields: true, updateCache: true }
      );

      // Build and cache arguments
      const result = await updateTabArguments(
        dependencies,
        tiles, // tiles is guaranteed to be defined here
        fieldsArray,
        { updateCache: true }
      );

      debugLog(`[useEnsureTabArguments] Built arguments for tab ${tabId}:`, 
        `tableArguments keys: ${Object.keys(result.tableArguments).length}`,
        `plotArguments keys: ${Object.keys(result.plotArguments).length}`);

      return result;
    },
  });
}

/**
 * Hook that creates a reactive query to watch external dependencies
 * This automatically re-runs when dependency data changes
 */
function useExternalDependenciesQuery(
  tile: Tile | null,
  tabId: string,
  config: ReturnType<typeof getTileBuildAndRenderConfig>
) {
  const storeApi = useStoreApiContext();
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['externalDependencies', tile?.id, tabId],
    queryFn: () => {
      if (!config.needsExternalDependencies || !tile) {
        return { isReady: true, missingDependencies: [] };
      }
      
      const state = storeApi.getState();
      const allTiles = selectTilesForTab(state, tabId);
      const externalDependencyNames = config.getExternalDependencies(tile);
      const missingDependencies: string[] = [];
      
      debugLog(`🔍 [externalDependenciesQuery] Checking external dependencies for ${tile.name}: [${externalDependencyNames.join(', ')}]`);
      
      for (const depName of externalDependencyNames) {
        const depTile = allTiles.find(t => t.name === depName);
        if (!depTile) {
          debugWarn(`❌ [externalDependenciesQuery] Dependency tile "${depName}" not found for ${tile.name}`);
          missingDependencies.push(`external: ${depName} (not found)`);
          continue;
        }
        
        const depTileType = depTile.type as TileType;
        const depConfig = getTileBuildAndRenderConfig(depTileType);
        const depDataCheck = depConfig.checkInternalDataReadiness(depTile.id, tabId, queryClient);
        
        debugLog(`🔍 [externalDependenciesQuery] Dependency "${depName}" (${depTileType}) data check:`, {
          isReady: depDataCheck.isReady,
          missingData: depDataCheck.missingData,
          tileId: depTile.id
        });
        
        if (!depDataCheck.isReady) {
          debugLog(`⏳ [externalDependenciesQuery] External dependency "${depName}" not ready - missing: [${depDataCheck.missingData.join(', ')}]`);
          missingDependencies.push(`external: ${depName} (${depDataCheck.missingData.join(', ')})`);
        } else {
          debugLog(`✅ [externalDependenciesQuery] External dependency "${depName}" ready!`);
        }
      }
      
      const result = {
        isReady: missingDependencies.length === 0,
        missingDependencies
      };
      
      debugLog(`🔍 [externalDependenciesQuery] Final result for ${tile.name}:`, result);
      return result;
    },
    enabled: !!tile && !!config.needsExternalDependencies,
    staleTime: 0, // Always check fresh
    refetchInterval: 1000, // Re-check every second to catch dependency changes
    refetchOnWindowFocus: false
  });
}

/**
 * Hook that creates a reactive query to watch internal data
 * This automatically re-runs when internal data changes
 */
function useInternalDataQuery(
  tile: Tile | null,
  tileId: string,
  tabId: string,
  tileType: TileType,
  config: ReturnType<typeof getTileBuildAndRenderConfig>
) {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['internalData', tileId, tabId],
    queryFn: () => {
      if (!tile) {
        return { isReady: true, missingData: [] };
      }
      
      debugLog(`🔍 [internalDataQuery] Checking internal data for ${tile.name} (${tileType})`);
      const result = config.checkInternalDataReadiness(tileId, tabId, queryClient);
      
      debugLog(`🔍 [internalDataQuery] Internal data check for ${tile.name}:`, result);
      return result;
    },
    enabled: !!tile,
    staleTime: 0, // Always check fresh
    refetchInterval: 1000, // Re-check every second to catch data changes
    refetchOnWindowFocus: false
  });
}

/**
 * Hook that ensures tile data is built and cached before rendering
 * Uses React Query's reactivity instead of complex memoization
 */
export function useEnsureTileDataBeforeRender(
  tileId: string,
  tabId: string,
  interfaceId: string,
  projectId: string,
  actions: {
    tileActions: GranularTileActions;
    projectsActions: ProjectsActions;
    contextActions: ContextActions;
    fieldsActions: FieldsActions;
    logsActions: LogsActions;
  }
) {
  const storeApi = useStoreApiContext();
  const state = storeApi.getState();
  const tile = selectTileById(state, tileId);
  const tileType = tile?.type as TileType;
  
  // Get unified config for this tile type
  const config = getTileBuildAndRenderConfig(tileType);
  
  // STEP 1: Check TAB-LEVEL PREREQUISITES (for building)
  const tabArgumentsQueryReady = useEnsureTabArguments(tabId, projectId, actions);
  const tabArgumentsQuery = config.needsTabArguments ? tabArgumentsQueryReady : null;
  const tabPrerequisitesReady = !config.needsTabArguments || !!tabArgumentsQuery?.data;
  
  // STEP 2: Check EXTERNAL DEPENDENCIES - REACTIVE QUERY APPROACH
  const externalDependenciesQuery = useExternalDependenciesQuery(tile, tabId, config);
  const externalDependenciesCheck = externalDependenciesQuery.data || { isReady: false, missingDependencies: [] };
  
  // STEP 3: Check INTERNAL DATA REQUIREMENTS - REACTIVE QUERY APPROACH  
  const internalDataQuery = useInternalDataQuery(tile, tileId, tabId, tileType, config);
  const internalDataCheck = internalDataQuery.data || { isReady: false, missingData: [] };
  
  // STEP 4: Determine BUILD READINESS (when to start building data)
  const shouldStartBuilding = config.shouldStartBuilding(tabPrerequisitesReady, externalDependenciesCheck.isReady);
  
  // STEP 5: Determine RENDER READINESS (when to show content)
  const allDataReady = externalDependenciesCheck.isReady && internalDataCheck.isReady;
  const canRender = config.isIndependent ? internalDataCheck.isReady : allDataReady;
  
  debugLog(`🎯 [useEnsureTileDataBeforeRender] SUMMARY for ${tile?.name} (${tileType}):`, {
    shouldStartBuilding,
    canRender,
    tabPrerequisitesReady,
    externalDepsReady: externalDependenciesCheck.isReady,
    internalDataReady: internalDataCheck.isReady,
    isIndependent: config.isIndependent,
    externalMissing: externalDependenciesCheck.missingDependencies,
    internalMissing: internalDataCheck.missingData
  });
  
  // STEP 6: Call data building hooks with conditional enabling based on BUILD readiness
  const tableDataQuery = useEnsureTableTileData({
    interfaceId,
    tabId,
    tileId: (tileType === 'Table' && shouldStartBuilding) ? tileId : '',
    projectId,
    tableArguments: tabArgumentsQuery?.data?.tableArguments || {} as TableArguments,
    actions
  });

  const plotDataQuery = useEnsurePlotTileData({
    interfaceId,
    tabId,
    tileId: (tileType === 'Plot' && shouldStartBuilding) ? tileId : '',
    projectId,
    plotArguments: tabArgumentsQuery?.data?.plotArguments || {} as PlotArguments,
    actions
  });

  // STEP 7: Determine overall building status
  const isBuilding = (tabArgumentsQuery?.isLoading) ||
                    (tileType === 'Table' && tableDataQuery?.isLoading) || 
                    (tileType === 'Plot' && plotDataQuery?.isLoading) ||
                    externalDependenciesQuery.isLoading ||
                    internalDataQuery.isLoading ||
                    false;

  // STEP 8: Create render state with combined missing dependencies
  const allMissingItems = [
    ...externalDependenciesCheck.missingDependencies,
    ...internalDataCheck.missingData.map(data => `internal: ${data}`)
  ];

  const renderState: TileRenderState = {
    tileId: tile?.id || tileId,
    canRender,
    dependenciesReady: externalDependenciesCheck.isReady,
    isWaitingForDependencies: !config.isIndependent && !externalDependenciesCheck.isReady,
    missingDependencies: allMissingItems
  };

  return {
    // Building-related state
    config,
    tabArgumentsQuery,
    tableDataQuery: tileType === 'Table' ? tableDataQuery : null,
    plotDataQuery: tileType === 'Plot' ? plotDataQuery : null,
    shouldStartBuilding,
    isBuilding,
    
    // Rendering-related state (unified)
    renderState,
    canRender,
    internalDataReady: internalDataCheck.isReady,
    externalDependenciesReady: externalDependenciesCheck.isReady
  };
}