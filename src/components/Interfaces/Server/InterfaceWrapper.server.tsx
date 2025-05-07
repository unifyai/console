import { Suspense } from "react";
import { getQueryClient } from "@/components/Providers/QueryProvider";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import Interface from "../Interface";
import TabWrapper from "./TabWrapper.server";
import { StoreInitializer } from "@/contexts/providers/StoreInitializer";
import { buildInterfaceStateForStore, buildProjectStateForStore } from "@/contexts/utils/stateBuilderUtils";

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
  Context
} from "@/types/evals/grid";

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
  tab,
  actions,
}: {
  project: string | null;
  tab?: string;
  actions: InterfaceWrapperActions;
}) {
  const qc = getQueryClient();

  /* Lightweight prefetch for projects and contexts */
  await qc.prefetchQuery({ 
    queryKey: ["projects"], 
    queryFn: actions.projectsActions.get 
  });
  
  // Project contexts
  let contexts: Context[] = [];
  
  if (project) {
    await qc.prefetchQuery({
      queryKey: ["contexts", project],
      queryFn: () => actions.contextActions.get(project),
    });
    
    // Get contexts from cache
    contexts = qc.getQueryData<Context[]>(["contexts", project]) || [];
  }

  /* Current interface meta */
  const interfaceName = "interface";
  let interfaceData: InterfaceData | null = null;
  
  if (project) {
    await qc.prefetchQuery({
      queryKey: ["interface", project, interfaceName, false],
      queryFn: () => actions.interfaceActions.getByName(project, interfaceName, false)
    });
    
    // Get interface data from cache
    interfaceData = qc.getQueryData<InterfaceData>(["interface", project, interfaceName, false]) || null;
  }
  
  // Build project state
  let projectState = {};
  if (project) {
    projectState = buildProjectStateForStore(
      project, 
      project, // Use project ID as name for now
      contexts,
      interfaceData ? [interfaceData.id || interfaceName] : [interfaceName],
      interfaceData?.id || interfaceName
    );
  }
  
  // Build interface state
  const interfaceState = interfaceData ? 
    buildInterfaceStateForStore(interfaceData, interfaceData.active_tab_id) : 
    { activeInterfaceId: interfaceName };
  
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
          interfaceId={interfaceData?.id || interfaceName}
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
          <Suspense fallback={<SkeletonLoader />}>
            <TabWrapper
              project={project}
              interfaceName={interfaceData?.id || interfaceName}
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
        </Interface>
      </HydrationBoundary>
    </StoreInitializer>
  );
}
