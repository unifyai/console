"use client";

import { useMemo } from "react";
import { usePatchSpecializedTileQuery } from "@/hooks/Query/useTilesQuery";
import { ContextActions, FieldsActions, LogsActions, ProjectsActions, GranularTileActions } from "@/types/evals/grid";
import { useEditorTile, EditorActions } from "../useEditorTile";
import { useTileUI } from "../useTileUI";
import { useTileMeta } from "../useTileMeta";
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";
import { usePatchSpecializedTileQueryOptimistic } from "@/hooks/Query/usePatchSpecializedTileQueryOptimistic";

/**
 * Properties of the EditorTile that will be synced with the server
 */
export type SyncedEditorProperties = 'file_type' | 'content' | 'file_name';

/**
 * Loading states for each property
 */
export type EditorLoadingStates = {
  [key in SyncedEditorProperties]: boolean;
} & {
  any: boolean;
};

/**
 * Error states for each property
 */
export type EditorErrorStates = {
  [key in SyncedEditorProperties]: Error | null;
} & {
  any: boolean;
};

/**
 * Return type for the useEditorTileSync hook
 */
export interface EditorTileSyncResult {
  editorTile: ReturnType<typeof useEditorTile>['editorTile'];
  editorTileActions: EditorActions | null;
  loading: EditorLoadingStates;
  error: EditorErrorStates;
  exists: boolean;
}

/**
 * Thin wrapper around useEditorTile that transparently keeps the
 * server in-sync (optimistic-update) for the critical editor fields.
 *
 * The API surface is similar to useEditorTile but with additional
 * loading and error state information.
 */
export function useEditorTileSync(
  tileId: string | null,
  tabId: string | null,
  granularTileActions?: GranularTileActions,
  projectsActions?: ProjectsActions,
  contextActions?: ContextActions,
  logsActions?: LogsActions,
  fieldsActions?: FieldsActions
): EditorTileSyncResult {
  // Get the original editor tile state and actions
  const { editorTile, editorTileActions, exists } = useEditorTile(tileId, tabId);

  // Get UI actions to update loading state
  const { meta } = useTileMeta(tileId, tabId);
  const { uiActions } = useTileUI(tileId, tabId);
  const tileName = meta?.name;

  // Get the store API reference - can be used to get state outside of React's render cycle
  const storeApi = useStoreApiContext();

  // Create individual mutation hooks for each property
  const fileTypeMutation = usePatchSpecializedTileQueryOptimistic<"Editor">();
  const contentMutation = usePatchSpecializedTileQuery<"Editor">();
  const fileNameMutation = usePatchSpecializedTileQuery<"Editor">();

  // Create a mapping for the mutations to use in the loading and error states
  const mutations = {
    file_type: fileTypeMutation,
    content: contentMutation,
    file_name: fileNameMutation,
  };

  // Individual wrapper functions for each property
  const wrapFileType = async (value: string | undefined) => {
    if (!editorTileActions || !granularTileActions) return;

    // Set UI states immediately before any operations
    if (uiActions) {
      uiActions.setLoading(true);
    }
    
    // 1) Update local state immediately
    editorTileActions.setFileType(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();

    // 2) Optimistic server update
    await fileTypeMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      tileType: "Editor",
      updateData: { file_type: value ?? null },
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router and set the loading state
      console.log("[wrapFileType] onSettled:", value);
      uiActions?.setLoading(false);
    });
  };

  const wrapContent = (value: string) => {
    if (!editorTileActions || !granularTileActions) return;
    
    // 1) Update local state immediately
    editorTileActions.setContent(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    contentMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Editor",
      updateData: { content: value ?? null },
      actions: granularTileActions
    });
  };

  const wrapFileName = (value: string | undefined) => {
    if (!editorTileActions || !granularTileActions) return;
    
    // 1) Update local state immediately
    editorTileActions.setFileName(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    fileNameMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Editor",
      updateData: { file_name: value ?? null },
      actions: granularTileActions
    });
  };

  // Create the enhanced actions object
  const syncedActions = useMemo(() => {
    if (!editorTileActions) return null;

    return {
      ...editorTileActions,
      // Use the specialized wrapper functions for each property
      setFileType: wrapFileType,
      setContent: wrapContent,
      setFileName: wrapFileName,
    } as EditorActions;
  }, [
    editorTileActions,
    tabId,
    tileName,
    granularTileActions,
  ]);

  if (!editorTileActions || !granularTileActions) {
    return {
      editorTile,
      editorTileActions: null,
      loading: {
        file_type: false,
        content: false,
        file_name: false,
        any: false
      },
      error: {
        file_type: null,
        content: null,
        file_name: null,
        any: false
      },
      exists: false
    };
  }

  // Prepare loading states
  const loading: EditorLoadingStates = {
    file_type: mutations.file_type.isPending,
    content: mutations.content.isPending,
    file_name: mutations.file_name.isPending,
    any: false
  };
  
  // Check if any property is loading
  loading.any = Object.values(mutations).some(m => m.isPending);

  // Prepare error states
  const error: EditorErrorStates = {
    file_type: mutations.file_type.error,
    content: mutations.content.error,
    file_name: mutations.file_name.error,
    any: false
  };
  
  // Check if any property has error
  error.any = Object.values(mutations).some(m => !!m.error);

  return {
    editorTile,
    editorTileActions: syncedActions,
    loading,
    error,
    exists
  };
} 