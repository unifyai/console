import { Suspense } from "react";
import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { StoreInitializer } from "@/contexts/providers/StoreInitializer";
import { StoreSliceUpdater } from "@/contexts/providers/StoreSliceUpdater";
import { buildInterfaceStateForStore, buildProjectStateForStore, buildGlobalStateForStore, buildTabStateForStore, buildTileStateForStore } from "@/contexts/utils/stateBuilderUtils";
import { redirect } from "next/navigation";
import { getRedirectUrl } from "@/utils/redirects/getRedirectUrl";
import { buildFilterExpression } from "@/utils/evals/filters";
import { buildPlotDataItem } from "@/utils/data/buildPlotDataItem";
import { buildTableDataItem, getGroupSortingObject, getSortingObject } from "@/utils/data/buildTableDataItem";
import { processContext } from "@/utils/evals/columnOperations";
import { buildTabArguments } from '@/utils/arguments/buildTabArguments';
import { IStoreState } from "@/contexts/store";
import { ExpandProvider } from "@/contexts/ExpandContext";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";

// Import client components
import Interface from "../Interface";
import Tab from "../Tab";
import TileCard from "../TileCard";
import Tile from "../Tile";
import LogsTable from "../Table/Table";
import LogsPlot from "../Details/Plot/Plot";
import Selection from "../Details/Selection/Selection";
import Editor from "../Details/Editor/Editor";

import type {
  ProjectsActions,
  ContextActions,
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  CodeActions,
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  DevboxActions,
  InterfaceData,
  Context,
  TabData,
  TileData
} from "@/types/evals/grid";
import { LogFieldsResponseProps, LogsResponseProps, TableArguments, PlotArguments } from "@/types/evals/logs";

type InterfaceServerComponentActions = {
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  codeActions: CodeActions;
  devboxActions: DevboxActions;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
};

export default async function InterfaceServerComponent({
  project,
  interface_,
  tab,
  actions,
}: {
  project: string | null;
  interface_: string | null;
  tab?: string;
  actions: InterfaceServerComponentActions;
}) {
  console.log("InterfaceServerComponent rendering...");
  const qc = getQueryClient();

  /* Step 1: Interface Level - Fetch projects, contexts, interfaces */
  
  // Lightweight prefetch for projects and contexts
  let projects: string[] = [];
  await qc.prefetchQuery({ 
    queryKey: ["projects"], 
    queryFn: actions.projectsActions.get 
  });
  projects = qc.getQueryData<string[]>(["projects"]) || [];

  // Get the current project if it was provided in the URL
  const currentProject = projects.find(proj => proj == project) || null;

  // Project contexts
  let contexts: Context[] = [];
  
  if (currentProject) {
    await qc.prefetchQuery({
      queryKey: ["contexts", currentProject],
      queryFn: () => actions.contextActions.get(currentProject),
    });
    
    // Get contexts from cache
    contexts = qc.getQueryData<Context[]>(["contexts", currentProject]) || [];
  }

  // Get or create devbox
  let devbox = null;
  try {
    if (currentProject) {
      await qc.prefetchQuery({
        queryKey: ["devbox"],
      queryFn: () => actions.devboxActions.get(),
    });
    devbox = qc.getQueryData(["devbox"]) || null;
    console.log("[InterfaceServerComponent] Devbox:", devbox);

    // If devbox is not found, create it
    if (!devbox) {
      console.log("[InterfaceServerComponent] Creating devbox");
      devbox = await actions.devboxActions.create();
      console.log("[InterfaceServerComponent] Devbox created:", devbox);
      }
    }
  } catch (error) {
    console.error("[InterfaceServerComponent] Error creating devbox:", error);
  }

  // Get interfaces
  let interfaces: InterfaceData[] = [];
  if (currentProject) {
    await qc.prefetchQuery({
      queryKey: ["interfaces", currentProject, false],
      queryFn: () => actions.interfaceActions.list(currentProject, false),
    });

    // Get interfaces from cache
    interfaces = qc.getQueryData<InterfaceData[]>(["interfaces", currentProject, false]) || [];
  }

  // Get the current interface (interface_ from query params is the NAME, not the ID)
  let currentInterface: InterfaceData | null = null;
  
  if (interface_) {
    // Find by name from query param
    currentInterface = interfaces.find(i => i.name === interface_) || null;
  } else if (interfaces.length > 0) {
    // Default to first interface if none specified
    currentInterface = interfaces[0];
  }

  // Extract key interface properties needed for rendering
  let interfaceName = ""; // The name to use in query params
  let interfaceId = ""; // The UUID to use for API calls
  let tabs: TabData[] = [];

  if (currentInterface) {
    interfaceName = currentInterface.name;
    interfaceId = currentInterface.id || "";

    // Only fetch tabs if we have a valid interfaceId
    if (interfaceId) {
      // Prefetch tabs using the query client - use interfaceId for API calls
      await qc.prefetchQuery({
        queryKey: ["tabs", interfaceId],
        queryFn: () => actions.tabActions.list(interfaceId, false)
      });
      
      // Get tabs from cache
      tabs = qc.getQueryData<TabData[]>(["tabs", interfaceId]) || [];
    }
  }

  // Check if we need to redirect - the utility will create interface/tab if needed
  const redirectUrl = await getRedirectUrl({
    project,
    interface_,
    tab,
    interfaces,
    currentInterface,
    tabs,
    interfaceActions: actions.interfaceActions,
    tabActions: actions.tabActions
  });

  if (redirectUrl) {
    console.log("Redirecting to:", redirectUrl);
    redirect(redirectUrl);
  }

  // Build project state
  let projectState = {};
  if (currentProject) {
    // Create a list of all interface IDs from the fetched interfaces
    const interfaceIds = interfaces.map(iface => iface.id).filter(Boolean) as string[];
    
    // If there's a current interface, set it as the active one
    const activeInterfaceId = currentInterface ? currentInterface.id : undefined;
    
    projectState = buildProjectStateForStore(
      currentProject, 
      currentProject, // Use currentProject ID as name for now
      contexts,
      interfaceIds, // Use all interface IDs
      activeInterfaceId
    );
  }
  
  // Build interface state
  let interfaceState = {};
  if (currentInterface) {
    // Extract the active tab id if available otherwise use the tab which matches with the tab prop
    const activeTabId = tabs.find(tab_ => tab_.name === tab)?.id || currentInterface.active_tab_id || undefined;

    if (activeTabId && currentInterface.active_tab_id !== activeTabId) {
      // Update the active tab id
      await actions.interfaceActions.update({
        interface_id: interfaceId,
        data: { active_tab_id: activeTabId }
      });
    }

    interfaceState = buildInterfaceStateForStore(
      currentInterface, 
      activeTabId,
      tabs.map(tab => tab.id || '') || [],
      tabs.map(tab => tab.name || '') || []
    );
  } else if (interface_) {
    // If we have an interface name but no data yet
    interfaceState = { activeInterfaceId: interface_ };
  }

  const globalStoreState = buildGlobalStateForStore(
    projects,
    currentProject,
    interfaceId,
  );
  
  // Merge states for interface level
  const initialState = {
    ...globalStoreState,
    ...projectState,
    ...interfaceState
  };

  /* Step 2: Tab Level - Find active tab and fetch tiles */
  
  // Handle case where no project is selected yet
  if (!project) {
    return (
      <StoreInitializer initialState={initialState}>
        <HydrationBoundary state={dehydrate(qc)}>
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <SkeletonLoader />
              </div>
            }
          >
            <Interface
              interfaceId={interfaceId}
              projectsActions={actions.projectsActions}
              interfaceActions={actions.interfaceActions}
              tabActions={actions.tabActions}
              tileActions={actions.tileActions}
              logsActions={actions.logsActions}
              fieldsActions={actions.fieldsActions}
              derivedEntryActions={actions.derivedEntryActions}
              contextActions={actions.contextActions}
              codeActions={actions.codeActions}
            >
              <div className="flex items-center justify-center h-full">Please select a project</div>
            </Interface>
          </Suspense>
        </HydrationBoundary>
      </StoreInitializer>
    );
  }

  // Handle case where no interface is provided
  if (!interfaceId) {
    return (
      <StoreInitializer initialState={initialState}>
        <HydrationBoundary state={dehydrate(qc)}>
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <SkeletonLoader />
              </div>
            }
          >
            <Interface
              interfaceId={interfaceId}
              projectsActions={actions.projectsActions}
              interfaceActions={actions.interfaceActions}
              tabActions={actions.tabActions}
              tileActions={actions.tileActions}
              logsActions={actions.logsActions}
              fieldsActions={actions.fieldsActions}
              derivedEntryActions={actions.derivedEntryActions}
              contextActions={actions.contextActions}
              codeActions={actions.codeActions}
            >
              <div className="flex items-center justify-center h-full">Please select an interface</div>
            </Interface>
          </Suspense>
        </HydrationBoundary>
      </StoreInitializer>
    );
  }

  // Find the current tab based on various scenarios
  let activeTab: TabData | null = null;
  
  // First check if a specific tab was requested in the URL
  if (tab) {
    activeTab = tabs.find(t => t.name === tab) || null;
  } 
  
  // If no tab was found or specified, try to find an active tab
  if (!activeTab) {
    activeTab = tabs.find(t => t.active) || null;
  }
  
  // If still no tab found, use the first tab if available
  if (!activeTab && tabs.length > 0) {
    activeTab = tabs[0];
  }
  
  // If no active tab could be found, show a message
  if (!activeTab) {
    return (
      <StoreInitializer initialState={initialState}>
        <HydrationBoundary state={dehydrate(qc)}>
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <SkeletonLoader />
              </div>
            }
          >
            <Interface
              interfaceId={interfaceId}
              projectsActions={actions.projectsActions}
              interfaceActions={actions.interfaceActions}
              tabActions={actions.tabActions}
              tileActions={actions.tileActions}
              logsActions={actions.logsActions}
              fieldsActions={actions.fieldsActions}
              derivedEntryActions={actions.derivedEntryActions}
              contextActions={actions.contextActions}
              codeActions={actions.codeActions}
            >
              <div className="flex items-center justify-center h-full">No tabs found</div>
            </Interface>
          </Suspense>
        </HydrationBoundary>
      </StoreInitializer>
    );
  }

  // Prefetch tiles for the active tab - use tabId for API calls
  const tabId = activeTab.id || "";
  
  if (tabId) {
    await qc.prefetchQuery({
      queryKey: ["tiles", tabId],
      queryFn: () => actions.tileActions.list(tabId, undefined, false)
    });
  }

  // Get the tiles from the query cache
  const tiles = qc.getQueryData<TileData[]>(["tiles", tabId]) || [];

  // Filter to get table and plot tiles
  const tableTiles = tiles.filter(t => t.type === "Table");
  const plotTiles = tiles.filter(t => t.type === "Plot");

  // Get fields
  await Promise.all(
    tableTiles.map(tile =>
      qc.prefetchQuery({
        queryKey: ["fields", project, tile.context ?? null],
        queryFn: () => actions.fieldsActions.get(project as string, tile.context ?? null),
      })
    )
  );
  const fields: LogFieldsResponseProps[] = tableTiles.map(tile =>
    qc.getQueryData(["fields", project, tile.context ?? null]) as LogFieldsResponseProps
  );

  // Get existing arguments from cache
  let tableArguments = qc.getQueryData<TableArguments>(["tableArguments", tabId]) || {};
  let plotArguments = qc.getQueryData<PlotArguments>(["plotArguments", tabId]) || {};
  
  // Build arguments for all tiles
  if (tableTiles.length > 0 || plotTiles.length > 0) {
    const { tableArguments: newTableArguments, plotArguments: newPlotArguments } = 
      buildTabArguments(tiles, fields, tableArguments, plotArguments);

    // Store the built arguments in the cache
    qc.setQueryData(["tableArguments", tabId], newTableArguments);
    qc.setQueryData(["plotArguments", tabId], newPlotArguments);
    
  } else {
    // Initialize empty arguments if no tiles
    qc.setQueryData(["tableArguments", tabId], {});
    qc.setQueryData(["plotArguments", tabId], {});
  }

  // Build tab state explicitly - we only need to build the tab state here
  const tabState: Partial<IStoreState> = {};
  if (activeTab) {
    const builtTabState = buildTabStateForStore(
      activeTab,
      true, // isActive
      interfaceId, // Use interfaceId for the store
      tiles.map(tile => tile.id || ''),
      tiles.map(tile => tile.name || '')
    );
    Object.assign(tabState, builtTabState);
  }

  // Build tile state explicitly - we only need to build the tile state here
  const tileState: Partial<IStoreState> = {};
  if (tiles.length > 0) {
    const builtTileState = buildTileStateForStore(
      tiles,
      tabId
    );
    Object.assign(tileState, builtTileState);
  }

  // Create tab slice - only include tab-specific state
  const tabSlice: Partial<IStoreState> = {
    // Only include tab state, activeTabId is fine since it's part of tab's domain
    activeTabId: activeTab.id || null,
    ...tabState,
    ...tileState,
  };

  /* Step 3: Tile Level - Prepare tiles data */
  
  // Prefetch data for each tile based on its type
  await Promise.all(tiles.map(async (tile) => {
    const tileId = tile.id || "";
    const tileName = tile.name;
    
    if (tile.type === "Table") {
      // Get pre-built tableArguments from cache instead of building them here
      const tableArguments = qc.getQueryData<TableArguments>(["tableArguments", tabId]) || {} as TableArguments;

      // Build filter expression
      const filterExpression = buildFilterExpression(
        tile.filters,
        tile.common_filter,
        tile.column_context,
        tile.freeze,
        fields.find(_ => true) || {} // Use the first fields object or empty object
      );

      // Handle sorting
      const sortingObject = tile.table_tile?.sorting ? getSortingObject(tile) : "";
      const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null;

      // Handle grouping
      const groupingExpression = tile.grouping || null;

      // Handle group sorting
      const groupSortingObject = tile.table_tile?.group_sorting && tile.grouping ? 
        getGroupSortingObject(tile) : "";
      const groupSortingExpression = groupSortingObject ? JSON.stringify(groupSortingObject) : null;

      // Prefetch logs data
      const limit = 20;
      const offset = tile.table_tile?.page_number ? parseInt(tile.table_tile.page_number) * limit : 0;
      
      await qc.prefetchQuery({
        queryKey: ["logs", project, tile.context, tile.column_context, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, limit, offset],
        queryFn: () => actions.logsActions.get(
          project as string,
          tile.context ?? null,
          tile.column_context ?? null,
          filterExpression,
          sortingExpression,
          groupingExpression,
          groupSortingExpression,
          null,
          null,
          null,
          limit,
          offset,
          groupingExpression ? 0 : null,
          null,
          Date.now().toString()
        )
      });
      
      // Get logs data from cache
      const logsData = qc.getQueryData<LogsResponseProps>(["logs", project, tile.context, tile.column_context, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, limit, offset]) || { params: {}, logs: [], count: 0, groups: [] };

      // Get fields from cache for this table
      const tileFields = qc.getQueryData<LogFieldsResponseProps>(["fields", project, tile.context]) || {} as LogFieldsResponseProps;

      // Build table data item
      const tableDataItem = await buildTableDataItem(tile, tileFields, logsData, project as string, actions.logsActions);

      // Update available fields in the tableArguments (if we have tableArguments for this tile)
      if (tableArguments[tileName]) {
        tableArguments[tileName].available_fields = Object.fromEntries(
          Object.entries(tileFields)
            .filter((([field, attributes]) => 
              tableDataItem.entriesProperties.map(property => tile.column_context ? processContext("merge", tile.column_context, property) : property)
              .concat(tableDataItem.paramsProperties.map(property => tile.column_context ? processContext("merge", tile.column_context, property) : property))
              .includes(field))
            )
        );
        
        // Update the cache with available fields
        qc.setQueryData(["tableArguments", tabId], tableArguments);
      }

      // Prefetch the table data item
      await qc.prefetchQuery({
        queryKey: ["tableDataItem", tileId],
        queryFn: () => Promise.resolve(tableDataItem)
      });
    } 
    else if (tile.type === "Plot") {
      // Get pre-built plotArguments from cache - all processing is done earlier
      const plotArguments = qc.getQueryData<PlotArguments>(["plotArguments", tabId]) || {};

      // Build plot data item
      const plotDataItem = await buildPlotDataItem(
        tile,
        tableTiles,
        plotArguments,
        fields,
        project as string,
        actions.logsActions
      );

      // Prefetch the plot data item
      await qc.prefetchQuery({
        queryKey: ["plotDataItem", tileId],
        queryFn: () => Promise.resolve(plotDataItem)
      });
    }
    else if (tile.type === "Editor") {
      // Prefetch editor content if available
      await qc.prefetchQuery({
        queryKey: ["editor", tileId],
        queryFn: () => ({
          filePath: tile.editor_tile?.file_path || "main.txt",
          fileType: tile.editor_tile?.file_type || "txt",
          content: tile.editor_tile?.content || "",
        }),
      });
    }
    // For View/Selection types, we don't need to prefetch anything specific
  }));

  // Render tile content based on type
  const renderTileContent = (tile: TileData) => {
    const tileId = tile.id || "";
    
    switch (tile.type) {
      case "Table":
        return (
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <SkeletonLoader />
              </div>
            }
          >
            <LogsTable 
              tileId={tileId}
              tabId={tabId}
              interfaceId={interfaceId}
              projectId={project as string}
              tileActions={actions.tileActions}
              logsActions={actions.logsActions}
              fieldsActions={actions.fieldsActions}
              derivedEntryActions={actions.derivedEntryActions}
              contextActions={actions.contextActions}
              projectsActions={actions.projectsActions}
            />
          </Suspense>
        );
      case "Plot":
        return (
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <SkeletonLoader />
              </div>
            }
          >
            <LogsPlot 
              tileId={tileId}
              tabId={tabId}
              interfaceId={interfaceId}
              projectId={project as string}
              tileActions={actions.tileActions}
              logsActions={actions.logsActions}
              fieldsActions={actions.fieldsActions}
              projectsActions={actions.projectsActions}
              contextActions={actions.contextActions}
            />
          </Suspense>
        );
      case "View":
        return (
          <div className="w-full overflow-auto">
            <ExpandProvider>
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <SkeletonLoader />
                </div>
              }>
                <Selection
                  tileId={tileId}
                  tabId={tabId}
                  projectId={project as string}
                  logsActions={actions.logsActions}
                />
              </Suspense>
            </ExpandProvider>
          </div>
        );
      case "Editor":
        return (
          <div className="w-full h-full overflow-y-auto">
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <SkeletonLoader />
                </div>
              }
            >
              <Editor
                tileId={tileId}
                tabId={tabId}
                interfaceId={interfaceId}
                projectId={project as string}
                codeActions={actions.codeActions}
                tileActions={actions.tileActions}
                projectsActions={actions.projectsActions}
                contextActions={actions.contextActions}
                fieldsActions={actions.fieldsActions}
                logsActions={actions.logsActions}
              />
            </Suspense>
          </div>
        );
      default:
        return <div>Unknown tile type: {tile.type}</div>;
    }
  };

  // Final render, combining all levels
  return (
    <StoreInitializer initialState={initialState}>
      {/* Update the store with tab and tile state */}
      <StoreSliceUpdater slice={tabSlice} />
      
      <HydrationBoundary state={dehydrate(qc)}>
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <SkeletonLoader />
          </div>
        }>
          <Interface
            interfaceId={interfaceId}
            projectsActions={actions.projectsActions}
            interfaceActions={actions.interfaceActions}
            tabActions={actions.tabActions}
            tileActions={actions.tileActions}
            logsActions={actions.logsActions}
            fieldsActions={actions.fieldsActions}
            derivedEntryActions={actions.derivedEntryActions}
            contextActions={actions.contextActions}
            codeActions={actions.codeActions}
          >
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center">
                  <SkeletonLoader />
              </div>
            }>
              <Tab
                tabId={tabId}
                interfaceId={interfaceId}
                projectId={project}
                projectsActions={actions.projectsActions}
                tabActions={actions.tabActions}
                tileActions={actions.tileActions}
                logsActions={actions.logsActions}
                fieldsActions={actions.fieldsActions}
                derivedEntryActions={actions.derivedEntryActions}
                contextActions={actions.contextActions}
                codeActions={actions.codeActions}
              >
                {tiles.map(tile => (
                  <Suspense key={tile.id} fallback={<SkeletonLoader />}>
                    <TileCard
                      tileId={tile.id || ""}
                      tabId={tabId}
                      interfaceId={interfaceId}
                      projectId={project as string}
                      projectsActions={actions.projectsActions}
                      tileActions={actions.tileActions}
                      logsActions={actions.logsActions}
                      fieldsActions={actions.fieldsActions}
                      derivedEntryActions={actions.derivedEntryActions}
                      contextActions={actions.contextActions}
                      codeActions={actions.codeActions}
                    >
                      <Suspense fallback={<SkeletonLoader />}>
                        <Tile
                          tileId={tile.id || ""}
                          tabId={tabId}
                          interfaceId={interfaceId}
                          projectId={project as string}
                          projectsActions={actions.projectsActions}
                          tileActions={actions.tileActions}
                          logsActions={actions.logsActions}
                          fieldsActions={actions.fieldsActions}
                          derivedEntryActions={actions.derivedEntryActions}
                          contextActions={actions.contextActions}
                          codeActions={actions.codeActions}
                          tableContent={tile.type === "Table" ? renderTileContent(tile) : undefined}
                          plotContent={tile.type === "Plot" ? renderTileContent(tile) : undefined}
                          viewContent={tile.type === "View" ? renderTileContent(tile) : undefined}
                          editorContent={tile.type === "Editor" ? renderTileContent(tile) : undefined}
                        />
                      </Suspense>
                    </TileCard>
                  </Suspense>
                ))}
              </Tab>
            </Suspense>
        </Interface>
        </Suspense>
      </HydrationBoundary>
    </StoreInitializer>
  );
} 