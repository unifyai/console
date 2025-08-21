import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import Interface from "../Interface/Interface";
import InterfaceSelector from "../Interface/InterfaceSelector";
import { StoreInitializer } from "@/contexts/providers/StoreInitializer";
import { buildInterfaceStateForStore, buildProjectStateForStore, buildGlobalStateForStore, buildTabStateForStore, buildTileStateForStore } from "@/contexts/utils/stateBuilderUtils";
import { IStoreState } from "@/contexts/store";

import type {
  ProjectsActions,
  ContextActions,
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  CodeActions,
  FileActions,
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  DevboxActions,
  InterfaceData,
  Context,
  TabData,
  TileData,
  FavouritesActions,
  Favourite
} from "@/types/interfaces/grid";
import { redirect } from "next/navigation";

/**
 * Debug flag for UI initial state logging
 * Set NEXT_PUBLIC_DEBUG_UI_INITIAL_STATE=true to enable detailed logging
 */
const DEBUG_UI_INITIAL_STATE = process.env.NEXT_PUBLIC_DEBUG_UI_INITIAL_STATE === 'true';

/**
 * Conditional debug logger for UI initial state
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_UI_INITIAL_STATE) {
    console.log(...args);
  }
};

type InterfaceWrapperActions = {
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
  fileActions: FileActions;
  favouritesActions: FavouritesActions;
};

export default async function Main({
  project,
  interface_,
  actions,
  initialFavourites,
}: {
  project: string | null;
  interface_: string | null;  // This is the interface name from query param
  actions: InterfaceWrapperActions;
  initialFavourites: Favourite[];
}) {

  debugLog("[Main.server] === PARAMETER DEBUG ===");
  debugLog("[Main.server] Received project:", project, typeof project);
  debugLog("[Main.server] Received interface_:", interface_, typeof interface_);
  debugLog("[Main.server] === END PARAMETER DEBUG ===");

  debugLog("[Main.server] Starting render with:", { project, interface_ });
  const qc = getQueryClient();

  /* Enhanced prefetch for projects and contexts */
  let projects: string[] = [];
  await qc.prefetchQuery({ 
    queryKey: ["projects"], 
    queryFn: actions.projectsActions.get 
  });
  projects = qc.getQueryData<string[]>(["projects"]) || [];
  debugLog("[Main.server] Loaded projects:", projects);

  // Get the current project if it was provided in the URL
  // If no project is specified, default to "Assistants" project if it exists
  let currentProject = projects.find(proj => proj == project) || null;
  
  if (!currentProject && !project) {
    // Check if "Assistants" project exists and use it as default
    const assistantsProject = projects.find(proj => proj === "Assistants");
    if (assistantsProject) {
      debugLog("[Main.server] No project specified, redirecting to Assistants project");
      // Redirect to Assistants project
      const { redirect } = await import('next/navigation');
      redirect('/interfaces?project=Assistants');
    } else {
      debugLog("[Main.server] No project specified and Assistants project doesn't exist");
      // We'll handle this case in the client component
    }
  }
  
  debugLog("[Main.server] Current project:", currentProject);

  // **ALWAYS INITIALIZE WITH MINIMAL GLOBAL STATE**
  debugLog("[Main.server] Building minimal global state for initialization");
  const minimalGlobalState = buildGlobalStateForStore(
    projects,
    null, // Always start with no project selected - will be updated via slice
    null, // Always start with no interface selected - will be updated via slice
    null  // Always start with no tab selected - will be updated via slice
  );
  debugLog("[Main.server] Minimal global state built:", { 
    projectCount: minimalGlobalState.projects?.length 
  });

  // Project contexts
  let contexts: Context[] = [];
  
  if (currentProject) {
    await qc.prefetchQuery({
      queryKey: ["contexts", currentProject],
      queryFn: () => actions.contextActions.get(currentProject),
    });
    
    // Get contexts from cache
    contexts = qc.getQueryData<Context[]>(["contexts", currentProject]) || [];
    debugLog("[Main.server] Loaded contexts for project:", currentProject, "contexts:", contexts.length);
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
    debugLog("[Main.server] Devbox status:", devbox ? "exists" : "not found");

    // If devbox is not found, create it
    if (!devbox) {
      await actions.devboxActions.create();
      debugLog("[Main.server] Created new devbox");
      }
    }
  } catch (error) {
    console.error("[Main.server] Error creating devbox:", error);
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
    debugLog("[Main.server] Loaded interfaces for project:", currentProject, "interfaces:", interfaces.map(i => i.name));
  }

  // **BUILD ALL STATE SLICES THAT WE NEED**
  let stateSlices: Partial<IStoreState>[] = [];

  // Global state slice (activeProjectId, activeInterfaceId, activeTabId)
  let globalStateSlice: Partial<IStoreState> = {};
  
  // Project state slice
  let projectStateSlice: Partial<IStoreState> = {};
  
  // Interface state slice  
  let interfaceStateSlice: Partial<IStoreState> = {};
  
  // Tab state slice
  let tabStateSlice: Partial<IStoreState> = {};
  
  // Tile state slice
  let tileStateSlice: Partial<IStoreState> = {};

  // Case 1: No project selected
  if (!currentProject) {
    debugLog("[Main.server] No project selected, no additional slices needed");
    // No additional slices needed
  }
  // Case 2: Project selected but no interface
  else if (currentProject && !interface_) {
    debugLog("[Main.server] Project selected but no interface");
    
    // Update global state to set active project
    globalStateSlice = { activeProjectId: currentProject };
    stateSlices.push(globalStateSlice);
    
    // Build project state slice
    const interfaceIds = interfaces.map(iface => iface.id).filter(Boolean) as string[];
    debugLog("[Main.server] Building project state slice, interfaceIds:", interfaceIds);
    projectStateSlice = buildProjectStateForStore(
      currentProject, 
      currentProject,
      contexts,
      interfaceIds,
      undefined
    );
    stateSlices.push(projectStateSlice);
    debugLog("[Main.server] Project state slice built");
  }
  // Case 3: Both project and interface selected
  else if (currentProject && interface_) {
    const currentInterface = interfaces.find(i => i.name === interface_) || null;
    debugLog("[Main.server] Validating interface:", interface_, "found:", !!currentInterface);
    
    if (!currentInterface) {
      debugLog("[Main.server] Interface not found, redirecting to remove interface param");
      redirect(`/interfaces?project=${encodeURIComponent(currentProject)}`);
    }
    
    debugLog("[Main.server] Valid interface found, building all state slices");
    
    // Build all state slices for full interface rendering
    const interfaceIds = interfaces.map(iface => iface.id).filter(Boolean) as string[];
    const activeInterfaceId = currentInterface.id;
    
    // Build project state slice
    debugLog("[Main.server] Building project state slice");
    projectStateSlice = buildProjectStateForStore(
      currentProject, 
      currentProject,
      contexts,
      interfaceIds,
      activeInterfaceId
    );
    stateSlices.push(projectStateSlice);
    debugLog("[Main.server] Project state slice built");

    // Get tabs for the interface
    let tabs: TabData[] = [];
    const interfaceId = currentInterface.id || "";
    
    if (interfaceId) {
      await qc.prefetchQuery({
        queryKey: ["tabs", interfaceId],
        queryFn: () => actions.tabActions.list(interfaceId, false)
      });
      
      tabs = qc.getQueryData<TabData[]>(["tabs", interfaceId]) || [];
      debugLog("[Main.server] Loaded tabs for interface:", interfaceId, "tabs:", tabs.map(t => t.name));
    }

    // Build interface state slice
    const activeTabId = currentInterface.active_tab_id || undefined;
    debugLog("[Main.server] Building interface state slice");
    interfaceStateSlice = buildInterfaceStateForStore(
      currentInterface, 
      activeTabId,
      tabs.map(tab => tab.id || '') || [],
      tabs.map(tab => tab.name || '') || []
    );
    stateSlices.push(interfaceStateSlice);
    debugLog("[Main.server] Interface state slice built");

    // Build tab and tile state slices
    if (tabs.length > 0) {
      debugLog("[Main.server] Building tab and tile state slices for", tabs.length, "tabs");
      const allTabData: TabData[] = [];
      const allTileData: TileData[] = [];
      const isActiveFlags: boolean[] = [];
      const tileIdsPerTab: string[][] = [];
      const tileNamesPerTab: string[][] = [];
      const tabIdsForTiles: string[] = [];

      for (const tab of tabs) {
        const tabId = tab.id || "";
        if (!tabId) continue;

        try {
          await qc.prefetchQuery({
            queryKey: ["tiles", tabId],
            queryFn: () => actions.tileActions.list(tabId, undefined, false)
          });
          const tabTiles = qc.getQueryData<TileData[]>(["tiles", tabId]) || [];
          debugLog("[Main.server] Loaded tiles for tab:", tab.name, "tiles:", tabTiles.map(t => `${t.name}(${t.type})`));
          
          allTabData.push(tab);

          if (tabId === currentInterface.active_tab_id) {
            isActiveFlags.push(true);
            debugLog("[Main.server] Tab", tab.name, "is active");
          } else {
            isActiveFlags.push(false);
          }

          tileIdsPerTab.push(tabTiles.map(tile => tile.id || ''));
          tileNamesPerTab.push(tabTiles.map(tile => tile.name || ''));
          
          tabTiles.forEach(tile => {
            allTileData.push(tile);
            tabIdsForTiles.push(tabId);
          });
          
        } catch (error) {
          console.warn(`[Main.server] Could not build state for tab ${tab.name}:`, error);
        }
      }

      if (allTabData.length > 0) {
        debugLog("[Main.server] Building tab state slice for", allTabData.length, "tabs");
        tabStateSlice = buildTabStateForStore(
          allTabData,
          isActiveFlags,
          Array(allTabData.length).fill(interfaceId),
          tileIdsPerTab,
          tileNamesPerTab
        );
        stateSlices.push(tabStateSlice);
        debugLog("[Main.server] Tab state slice built");
      }

      if (allTileData.length > 0) {
        debugLog("[Main.server] Building tile state slice for", allTileData.length, "tiles");
        tileStateSlice = buildTileStateForStore(
          allTileData,
          tabIdsForTiles
        );
        stateSlices.push(tileStateSlice);
        debugLog("[Main.server] Tile state slice built");
      }
    }

    // Update global state to set active project, interface, and tab
    globalStateSlice = { 
      activeProjectId: currentProject,
      activeInterfaceId: activeInterfaceId,
      activeTabId: (tabStateSlice as Partial<IStoreState>).activeTabId || null
    };
    stateSlices.unshift(globalStateSlice); // Add at beginning so it's applied first
    debugLog("[Main.server] Global state slice built:", globalStateSlice);
  }

  // **RENDER WITH CONSISTENT PATTERN**
  debugLog("[Main.server] Rendering with", stateSlices.length, "state slices");

  // Merge all state slices into the minimal global state for synchronous initialization
  const completeInitialState: Partial<IStoreState> = stateSlices.reduce(
    (acc, slice) => ({ ...acc, ...slice }), 
    minimalGlobalState
  );
  debugLog("[Main.server] Complete initial state built:", {
    activeProjectId: completeInitialState.activeProjectId,
    activeInterfaceId: completeInitialState.activeInterfaceId,
    activeTabId: completeInitialState.activeTabId,
    projectCount: completeInitialState.projects?.length,
    projectsById: Object.keys(completeInitialState.projectsById || {}),
    interfacesById: Object.keys(completeInitialState.interfacesById || {}),
    tabsById: Object.keys(completeInitialState.tabsById || {}),
    tilesById: Object.keys(completeInitialState.tilesById || {})
  });
  
  // Determine which component to render
  const shouldShowInterfaceSelector = currentProject && !interface_;
  const interfaceId = (currentProject && interface_) ? 
    (interfaces.find(i => i.name === interface_)?.id || "") : "";

  return (
    <StoreInitializer initialState={completeInitialState}>
      <HydrationBoundary state={dehydrate(qc)}>
        {shouldShowInterfaceSelector ? (
          <InterfaceSelector
            projectId={currentProject!}
            interfaceActions={actions.interfaceActions}
            tabActions={actions.tabActions}
            tileActions={actions.tileActions}
          />
        ) : (
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
            fileActions={actions.fileActions}
            favouritesActions={actions.favouritesActions}
            initialFavourites={initialFavourites}
          />
        )}
      </HydrationBoundary>
    </StoreInitializer>
  );
}
