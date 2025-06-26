"use client";

import { useQueryClient } from "@tanstack/react-query";
import { 
  TileData, 
  TableDataItem, 
  PlotDataItem,
  LogsActions, 
  FieldsActions,
  ProjectsActions,
  ContextActions,
  Context
} from "@/types/evals/grid";
import { 
  LogFieldsResponseProps, 
  TableArguments, 
  PlotArguments 
} from "@/types/evals/logs";
import { buildTabArguments } from '@/utils/arguments/buildTabArguments';
import { fetchAndBuildTableDataItem } from '@/utils/data/buildTableDataItem';
import { buildPlotDataItem } from '@/utils/data/buildPlotDataItem';
import { fetchOrBuildFields, fetchOrBuildProjectsAndContexts } from '@/utils/data/buildServerData';
import { buildAvailableFieldsForTile } from '@/utils/arguments/buildTableArguments';
import { StoreApi } from "zustand";
import { IStoreState } from "@/contexts/store";

/**
 * Common dependencies needed for optimistic updates
 */
export type OptimisticUpdateDependencies = {
  queryClient: ReturnType<typeof useQueryClient>;
  projectId: string;
  tabId: string;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
  fieldsActions: FieldsActions;
  logsActions: LogsActions;
};

/**
 * Options for optimistic updates
 */
export type OptimisticUpdateOptions = {
  refetchProjects?: boolean;
  refetchContexts?: boolean;
  refetchFields?: boolean;
  updateCache?: boolean;
};

/**
 * Result of fetching projects, contexts, and fields
 */
export type ProjectContextFieldsResult = {
  projects: string[];
  contexts: Context[];
  fieldsArray: LogFieldsResponseProps[];
};

/**
 * Fetch or build projects, contexts, and fields for a set of tiles
 * This is shared logic used across multiple optimistic hooks
 */
export async function fetchProjectsContextsFields(
  dependencies: OptimisticUpdateDependencies,
  tableTiles: TileData[],
  options: OptimisticUpdateOptions
): Promise<ProjectContextFieldsResult> {
  const { queryClient, projectId, projectsActions, contextActions, fieldsActions } = dependencies;
  const { refetchProjects = false, refetchContexts = false, refetchFields = true } = options;

  // Build or fetch projects and contexts
  const { projects, contexts } = await fetchOrBuildProjectsAndContexts(
    queryClient,
    projectId,
    refetchProjects,
    refetchContexts,
    projectsActions,
    contextActions
  );

  // Build or fetch fields for all table tiles
  const fieldsArray: LogFieldsResponseProps[] = await fetchOrBuildFields(
    queryClient,
    tableTiles,
    projectId,
    refetchFields,
    fieldsActions
  );

  return {
    projects,
    contexts,
    fieldsArray,
  };
}

/**
 * Update tab arguments for a set of tiles
 * This is shared logic used across multiple optimistic hooks
 */
export async function updateTabArguments(
  dependencies: OptimisticUpdateDependencies,
  tiles: TileData[],
  fieldsArray: LogFieldsResponseProps[],
  options: OptimisticUpdateOptions
): Promise<{ tableArguments: TableArguments; plotArguments: PlotArguments }> {
  const { queryClient, tabId } = dependencies;
  const { updateCache = true } = options;

  // Get existing table and plot arguments from cache
  const existingTableArgs = queryClient.getQueryData(["tableArguments", tabId]) as TableArguments || {};
  const existingPlotArgs = queryClient.getQueryData(["plotArguments", tabId]) as PlotArguments || {};

  const tableTiles = tiles.filter(tile => tile.type === "Table");
  const plotTiles = tiles.filter(tile => tile.type === "Plot");

  // Build arguments for all tiles
  let tableArguments: TableArguments = existingTableArgs;
  let plotArguments: PlotArguments = existingPlotArgs;

  if (tableTiles.length > 0 || plotTiles.length > 0) {
    const { tableArguments: newTableArguments, plotArguments: newPlotArguments } = 
      buildTabArguments(tiles, fieldsArray, existingTableArgs, existingPlotArgs);

    tableArguments = newTableArguments;
    plotArguments = newPlotArguments;

    // Store the built arguments in the cache
    if (updateCache) {
      queryClient.setQueryData(["tableArguments", tabId], tableArguments);
      queryClient.setQueryData(["plotArguments", tabId], plotArguments);
    }
  } else if (updateCache) {
    // Initialize empty arguments if no tiles
    queryClient.setQueryData(["tableArguments", tabId], {});
    queryClient.setQueryData(["plotArguments", tabId], {});
  }

  return { tableArguments, plotArguments };
}

/**
 * Build optimistic table data item
 * This is shared logic used across multiple optimistic hooks
 */
export async function buildOptimisticTableDataItem(
  dependencies: OptimisticUpdateDependencies,
  tile: TileData,
  fieldsArray: LogFieldsResponseProps[],
  tableArguments?: TableArguments,
  options: OptimisticUpdateOptions = {}
): Promise<TableDataItem> {
  const { queryClient, projectId, tabId, logsActions } = dependencies;
  const { updateCache = true } = options;

  // Check cache first
  const cachedTableDataItem = queryClient.getQueryData(["tableDataItem", tile.id]) as TableDataItem | undefined;
  if (cachedTableDataItem && !updateCache) {
    return cachedTableDataItem;
  }

  // Get fields for this specific tile's context
  const fields = fieldsArray.find(f => 
    // Match the context used to fetch this field
    true // For now, use the first field. This logic might need refinement
  ) || fieldsArray[0] || {} as LogFieldsResponseProps;

  // Build table data item using existing utility
  const tableDataItem = await fetchAndBuildTableDataItem(
    tile,
    fields,
    projectId,
    logsActions
  );

  // Update available fields in the tableArguments (if we have tableArguments for this tile)
  if (tableArguments && tableArguments[tile.name!]) {
    tableArguments[tile.name!].available_fields = buildAvailableFieldsForTile(
      tile.column_context ?? "",
      fields,
      tableDataItem.entriesProperties,
      tableDataItem.paramsProperties
    );

    // Update the cache with available fields
    if (updateCache) {
      queryClient.setQueryData(["tableArguments", tabId], tableArguments);
    }
  }

  // Update cache
  if (updateCache) {
    queryClient.setQueryData(["tableDataItem", tile.id], tableDataItem);
  }

  return tableDataItem;
}

/**
 * Build optimistic plot data item
 * This is shared logic used across multiple optimistic hooks
 */
export async function buildOptimisticPlotDataItem(
  dependencies: OptimisticUpdateDependencies,
  tile: TileData,
  tableTiles: TileData[],
  plotArguments: PlotArguments,
  fieldsArray: LogFieldsResponseProps[],
  options: OptimisticUpdateOptions = {}
): Promise<PlotDataItem> {
  const { queryClient, projectId, logsActions } = dependencies;
  const { updateCache = true } = options;

  // Check cache first
  const cachedPlotDataItem = queryClient.getQueryData(["plotDataItem", tile.id]) as PlotDataItem | undefined;
  if (cachedPlotDataItem && !updateCache) {
    return cachedPlotDataItem;
  }

  // Build plot data item using existing utility
  const plotDataItem = await buildPlotDataItem(
    tile,
    tableTiles,
    plotArguments,
    fieldsArray,
    projectId,
    logsActions
  );

  // Update cache
  if (updateCache) {
    queryClient.setQueryData(["plotDataItem", tile.id], plotDataItem);
  }

  return plotDataItem;
}

/**
 * Update store state with fresh data
 * This is shared logic used across multiple optimistic hooks
 */
export function updateStoreWithFreshData(
  storeApi: StoreApi<IStoreState>,
  projectId: string,
  projects: string[],
  contexts: Context[],
  options: OptimisticUpdateOptions
): void {
  const { refetchProjects = false, refetchContexts = false } = options;

  if (!refetchProjects && !refetchContexts) return;

  const state = storeApi.getState();
  const projectData = state.projectsById[projectId];

  let newState = { ...state };

  if (refetchProjects) {
    newState.projects = projects;
  }

  if (refetchContexts) {
    newState.projectsById = {
      ...state.projectsById,
      [projectId]: {
        ...projectData,
        contexts: contexts
      }
    };
  }

  storeApi.setState(newState);
} 