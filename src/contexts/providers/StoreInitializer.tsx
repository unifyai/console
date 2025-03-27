"use client";

import { StoreProvider } from "@/contexts/providers/StoreProvider";
import StoreUpdater from "@/contexts/providers/StoreUpdater";
import Interface from "../../components/Interfaces/Interface";
import { OPERATIONS } from '@/contexts/utils/asyncUtils';
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useEffect, useRef } from "react";
import { IStoreState } from "@/contexts/store";
import { ProjectsActions, LogsActions, DerivedEntryActions, FieldsActions, ContextActions, TabActions, CodeActions } from "@/types/evals/grid";
import { useShallow } from 'zustand/react/shallow';

// Component that initializes the store with server data
export function StoreInitializer({ 
  initialState,
  projectsActions, 
  logsActions, 
  derivedEntryActions, 
  fieldsActions, 
  contextActions, 
  tabActions,
  codeActions
}: { 
  initialState: Partial<IStoreState>;
  projectsActions: ProjectsActions;
  logsActions: LogsActions;
  derivedEntryActions: DerivedEntryActions;
  fieldsActions: FieldsActions;
  contextActions: ContextActions;
  tabActions: TabActions;
  codeActions: CodeActions;
}) {
  return (
    <StoreProvider initialState={initialState}>
      <StoreInitializerContent
        initialState={initialState}
        projectsActions={projectsActions}
        logsActions={logsActions}
        derivedEntryActions={derivedEntryActions}
        fieldsActions={fieldsActions}
        contextActions={contextActions}
        tabActions={tabActions}
        codeActions={codeActions}
      />
    </StoreProvider>
  );
}

// Content component with access to the store
function StoreInitializerContent({
  initialState,
  projectsActions, 
  logsActions, 
  derivedEntryActions, 
  fieldsActions, 
  contextActions, 
  tabActions,
  codeActions
}: {
  initialState: Partial<IStoreState>;
  projectsActions: ProjectsActions;
  logsActions: LogsActions;
  derivedEntryActions: DerivedEntryActions;
  fieldsActions: FieldsActions;
  contextActions: ContextActions;
  tabActions: TabActions;
  codeActions: CodeActions;
}) {
  // Use a more selective selector to avoid re-renders on operations changes
  // Only select the specific store actions we need, not the entire state
  const activeInterfaceId = useStoreContext(
    useShallow(state => state.activeInterfaceId)
  );
  
  // // Use a ref to track if we've initialized already
  // const initializedRef = useRef(false);
  
  // // Mark server-rendered data as successfully loaded
  // useEffect(() => {
  //   // Only run initialization once
  //   if (initializedRef.current) return;
  //   initializedRef.current = true;
    
  //   const initialLoadOpId = OPERATIONS.INITIAL_LOAD(Date.now());
  //   storeActions.trackOperation(initialLoadOpId, 'success');
    
  //   // Clean up stale operations periodically
  //   const cleanupInterval = setInterval(() => {
  //     storeActions.cleanupStaleOperations();
  //   }, 5 * 60 * 1000); // Every 5 minutes
    
  //   return () => {
  //     clearInterval(cleanupInterval);
  //     storeActions.cleanupOperation(initialLoadOpId);
  //   };
  // }, [storeActions.trackOperation, storeActions.cleanupOperation, storeActions.cleanupStaleOperations]);

  const interfaceId = activeInterfaceId ?? "interface";
  
  return (
    <>
      <StoreUpdater initialState={initialState} />
      <Interface
        interfaceId={interfaceId}
        projectsActions={projectsActions}
        tabActions={tabActions}
        logsActions={logsActions}
        fieldsActions={fieldsActions}
        derivedEntryActions={derivedEntryActions}
        contextActions={contextActions}
        codeActions={codeActions}
      />
    </>
  );
} 