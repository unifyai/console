import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import Interface from "../Interface";
import InterfaceSelector from "../InterfaceSelector";
import { StoreInitializer } from "@/contexts/providers/StoreInitializer";
import { buildInterfaceStateForStore, buildProjectStateForStore, buildGlobalStateForStore, buildTabStateForStore, buildTileStateForStore } from "@/contexts/utils/stateBuilderUtils";

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
  TileData
} from "@/types/evals/grid";
import { redirect } from "next/navigation";

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
};

export default async function Main({
  project,
  interface_,
  actions,
}: {
  project: string | null;
  interface_: string | null;  // This is the interface name from query param
  actions: InterfaceWrapperActions;
}) {

  console.log("[InterfaceWrapper] Rendering...");
  const qc = getQueryClient();

  /* Enhanced prefetch for projects and contexts */
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

    // If devbox is not found, create it
    if (!devbox) {
      await actions.devboxActions.create();
      }
    }
  } catch (error) {
    console.error("[InterfaceWrapper] Error creating devbox:", error);
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

  // **NEW SIMPLIFIED LOGIC**
  
  // Case 1: No project selected - continue to Interface.tsx (shows DefaultProject)
  if (!currentProject) {
    console.log("[InterfaceWrapper] No project selected, continuing to Interface component");
    // Continue to Interface.tsx component (will show DefaultProject)
  }
  
  // Case 2: Project selected but no interface - always show InterfaceSelector
  else if (currentProject && !interface_) {
    console.log("[InterfaceWrapper] Project selected but no interface, showing InterfaceSelector");
    
    // Build minimal state for InterfaceSelector
    const globalStoreState = buildGlobalStateForStore(
      projects,
      currentProject,
      null,
    );

    const interfaceIds = interfaces.map(iface => iface.id).filter(Boolean) as string[];
    const projectState = buildProjectStateForStore(
      currentProject, 
      currentProject,
      contexts,
      interfaceIds,
      undefined
    );

    const initialState = {
      ...globalStoreState,
      ...projectState,
    };

    return (
      <StoreInitializer initialState={initialState}>
        <HydrationBoundary state={dehydrate(qc)}>
          <InterfaceSelector
            projectId={currentProject}
            interfaceActions={actions.interfaceActions}
            tabActions={actions.tabActions}
            tileActions={actions.tileActions}
          />
        </HydrationBoundary>
      </StoreInitializer>
    );
  }
  
  // Case 3: Both project and interface selected - validate interface exists
  else if (currentProject && interface_) {
    const currentInterface = interfaces.find(i => i.name === interface_) || null;
    
    if (!currentInterface) {
      console.log("[InterfaceWrapper] Interface not found, redirecting to remove interface param");
      // Interface doesn't exist, redirect to remove interface param (will show InterfaceSelector)
      redirect(`/interfaces?project=${encodeURIComponent(currentProject)}`);
    }
    
    console.log("[InterfaceWrapper] Valid interface found, continuing to Interface component");
    // Continue to Interface.tsx component with valid interface
  }

  // **EXISTING FLOW: Continue with normal rendering for Interface component**
  
  // Get the current interface 
  let currentInterface: InterfaceData | null = null;
  
  if (interface_) {
    // Find by name from query param
    currentInterface = interfaces.find(i => i.name === interface_) || null;
  }

  // Build common state
  const globalStoreState = buildGlobalStateForStore(
    projects,
    currentProject,
    currentInterface?.id || null,
  );

  // Build project state
  let projectState = {};
  if (currentProject) {
    const interfaceIds = interfaces.map(iface => iface.id).filter(Boolean) as string[];
    const activeInterfaceId = currentInterface ? currentInterface.id : undefined;
    
    projectState = buildProjectStateForStore(
      currentProject, 
      currentProject,
      contexts,
      interfaceIds,
      activeInterfaceId
    );
  }

  // Extract key interface properties needed for rendering
  let interfaceName = "";
  let interfaceId = "";
  let tabs: TabData[] = [];

  if (currentInterface) {
    interfaceName = currentInterface.name;
    interfaceId = currentInterface.id || "";

    // Only fetch tabs if we have a valid interfaceId
    if (interfaceId) {
      await qc.prefetchQuery({
        queryKey: ["tabs", interfaceId],
        queryFn: () => actions.tabActions.list(interfaceId, false)
      });
      
      // Get tabs from cache
      tabs = qc.getQueryData<TabData[]>(["tabs", interfaceId]) || [];
    }
  }

  // Build interface state for the current interface
  let currentInterfaceState = {};
  if (currentInterface) {
    // Use the active tab id from the interface if available
    const activeTabId = currentInterface.active_tab_id || undefined;

    currentInterfaceState = buildInterfaceStateForStore(
      currentInterface, 
      activeTabId,
      tabs.map(tab => tab.id || '') || [],
      tabs.map(tab => tab.name || '') || []
    );
  } else if (interface_) {
    currentInterfaceState = { activeInterfaceId: interface_ };
  }

  // Build tab and tile state for all tabs
  let tabState = {};
  let tileState = {};

  if (tabs.length > 0 && currentProject && currentInterface) {
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
        
        allTabData.push(tab);

        if (tabId === currentInterface.active_tab_id) {
          isActiveFlags.push(true);
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
        console.warn(`[InterfaceWrapper] Could not build state for tab ${tab.name}:`, error);
      }
    }

    if (allTabData.length > 0) {
      const builtTabState = buildTabStateForStore(
        allTabData,
        isActiveFlags,
        Array(allTabData.length).fill(interfaceId),
        tileIdsPerTab,
        tileNamesPerTab
      );
      Object.assign(tabState, builtTabState);
    }

    if (allTileData.length > 0) {
      const builtTileState = buildTileStateForStore(
        allTileData,
        tabIdsForTiles
      );
      Object.assign(tileState, builtTileState);
    }
  }
  
  // Merge states
  const initialState = {
    ...globalStoreState,
    ...projectState,
    ...currentInterfaceState,
    ...tabState,
    ...tileState,
  };

  console.log("[InterfaceWrapper] Built initial state");

  return (
    <StoreInitializer initialState={initialState}>
      <HydrationBoundary state={dehydrate(qc)}>
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
        />
      </HydrationBoundary>
    </StoreInitializer>
  );
}
