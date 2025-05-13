import { Suspense } from "react";
import { getQueryClient } from '@/lib/react-query/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import Interface from "../Interface";
import TabWrapper from "./TabWrapper.server";
import { StoreInitializer } from "@/contexts/providers/StoreInitializer";
import { buildInterfaceStateForStore, buildProjectStateForStore, buildTabStateForStore } from "@/contexts/utils/stateBuilderUtils";

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
  TabData
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

  // Redirect if we have a project and interfaces but no interface in the URL
  if (!interface_ && currentProject && currentInterface && currentInterface.name) {
    redirect(`/interfaces?project=${encodeURIComponent(currentProject)}&interface=${encodeURIComponent(currentInterface.name)}`);
  }

  // Extract key interface properties needed for rendering
  let interfaceName = ""; // The name to use in query params
  let interfaceId = ""; // The UUID to use for API calls

  if (currentInterface) {
    interfaceName = currentInterface.name;
    interfaceId = currentInterface.id || "";
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

    // Prefetch tabs using the query client - use interfaceId for API calls
    await qc.prefetchQuery({
      queryKey: ["tabs", currentInterface.id],
      queryFn: () => actions.tabActions.list(currentInterface.id!, false)
    });

    // Fetch the tabs and set them
    const tabs = qc.getQueryData<TabData[]>(["tabs", currentInterface.id]) || [];

    // Extract the active tab id if available otherwise use the tab which matches with the tab prop
    const activeTabId = tabs.find(tab_ => tab_.name === tab)?.id || currentInterface.active_tab_id ||undefined;

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
  
  // Merge states
  const initialState = {
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
        >
          {currentInterface && (
            <Suspense fallback={<SkeletonLoader />}>
              <TabWrapper
                project={currentProject}
                interfaceId={interfaceId}
                interfaceName={interfaceName}
                tab={tab}
                actions={{
                  tabActions: actions.tabActions,
                  tileActions: actions.tileActions,
                  logsActions: actions.logsActions,
                  fieldsActions: actions.fieldsActions,
                  derivedEntryActions: actions.derivedEntryActions,
                  contextActions: actions.contextActions,
                  codeActions: actions.codeActions
                }}
              />
            </Suspense>
          )}
        </Interface>
      </HydrationBoundary>
    </StoreInitializer>
  );
}
