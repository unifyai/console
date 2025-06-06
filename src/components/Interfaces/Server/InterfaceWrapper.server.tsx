import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import Interface from "../Interface";
import TabWrapper from "./TabWrapper.server";
import { StoreInitializer } from "@/contexts/providers/StoreInitializer";
import { buildInterfaceStateForStore, buildProjectStateForStore, buildGlobalStateForStore } from "@/contexts/utils/stateBuilderUtils";
import { getRedirectUrl } from "@/utils/redirects/getRedirectUrl";

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
  FileActions
} from "@/types/evals/grid";
import { redirect } from "next/navigation";
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { Suspense } from 'react';

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

export default async function InterfaceWrapper({
  project,
  interface_,
  tab,
  actions,
}: {
  project: string | null;
  interface_: string | null;  // This is the interface name from query param
  tab?: string;  // This is the tab name from query param
  actions: InterfaceWrapperActions;
}) {

  console.log("[InterfaceWrapper] Rendering...");
  const qc = getQueryClient();

  /* Lightweight prefetch for projects and contexts */
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

  // Get the current interface 
  // NOTE: interface_ from query params is the NAME, not the ID
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
  // and return a URL that includes both interface and tab parameters when appropriate
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
    console.log("[InterfaceWrapper] Redirecting to:", redirectUrl);
    redirect(redirectUrl);
  }

  // If we reach here, no redirect is needed - continue with normal rendering

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
  
  // Merge states
  const initialState = {
    ...globalStoreState,
    ...projectState,
    ...interfaceState
  };

  // Use a single StoreInitializer at the top level
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
        >
          {currentInterface && (
            // <Suspense fallback={
            //   <div className="w-full h-full flex items-center justify-center">
            //       <SkeletonLoader />
            //   </div>
            // }>
              <TabWrapper
                project={currentProject}
                interfaceId={interfaceId}
                interfaceName={interfaceName}
                tab={tab}
                actions={{
                  projectsActions: actions.projectsActions,
                  interfaceActions: actions.interfaceActions,
                  tabActions: actions.tabActions,
                  tileActions: actions.tileActions,
                  logsActions: actions.logsActions,
                  fieldsActions: actions.fieldsActions,
                  derivedEntryActions: actions.derivedEntryActions,
                  contextActions: actions.contextActions,
                  codeActions: actions.codeActions,
                  fileActions: actions.fileActions,
                }}
              />
            // </Suspense>
          )}
        </Interface>
      </HydrationBoundary>
    </StoreInitializer>
  );
}
