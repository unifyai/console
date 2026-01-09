'use client';

import { useCallback, useMemo } from 'react';
import { usePatchSpecializedTileQuery } from '@/hooks/Interfaces/Query/useTilesQuery';
import {
  ContextActions,
  FieldsActions,
  LogsActions,
  ProjectsActions,
  GranularTileActions,
} from '@/types/interfaces/grid';
import { useEditorTile, EditorActions } from '../useEditorTile';
import { useTileUI } from '../useTileUI';
import { useTileMeta } from '../useTileMeta';
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { usePatchSpecializedTileQueryOptimistic } from '@/hooks/Interfaces/Query/usePatchSpecializedTileQueryOptimistic';

/**
 * Debug flag for state syncing logging
 * Set NEXT_PUBLIC_DEBUG_STATE_SYNCING=true to enable detailed state synchronization logs
 */
const DEBUG_STATE_SYNCING = process.env.NEXT_PUBLIC_DEBUG_STATE_SYNCING === 'true';

/**
 * Conditional debug logger for state syncing
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_STATE_SYNCING) {
    console.log(...args);
  }
};

/**
 * Properties of the EditorTile that will be synced with the server
 */
export type SyncedEditorProperties = 'fileType' | 'content' | 'fileName';

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
  const fileTypeMutation = usePatchSpecializedTileQuery<'Editor'>();
  const contentMutation = usePatchSpecializedTileQuery<'Editor'>();
  const fileNameMutation = usePatchSpecializedTileQuery<'Editor'>();

  // Create a mapping for the mutations to use in the loading and error states
  const mutations = {
    fileType: fileTypeMutation,
    content: contentMutation,
    fileName: fileNameMutation,
  };

  // Individual wrapper functions for each property
  const wrapFileType = useCallback(
    async (value: string | undefined) => {
      if (!editorTileActions || !granularTileActions) return;

      // Set UI states immediately before any operations
      if (uiActions) {
        uiActions.setLoading(true);
      }

      // 1) Update local state immediately
      editorTileActions.setFileType(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // 2) Optimistic server update
      await fileTypeMutation
        .mutateAsync({
          tabId: tabId,
          name: tileName,
          tileType: 'Editor',
          updateData: { fileType: value ?? null },
          actions: granularTileActions,
        })
        .then(() => {
          // 3. Refresh the router and set the loading state
          debugLog('[wrapFileType] onSettled:', value);
          uiActions?.setLoading(false);
        });
    },
    [editorTileActions, granularTileActions, uiActions, tileName, tabId, fileTypeMutation]
  );

  const wrapContent = useCallback(
    (value: string) => {
      if (!editorTileActions || !granularTileActions) return;

      // 1) Update local state immediately
      editorTileActions.setContent(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // 2) Optimistic server update
      contentMutation.mutate({
        tabId: tabId,
        name: tileName,
        tileType: 'Editor',
        updateData: { content: value ?? null },
        actions: granularTileActions,
      });
    },
    [editorTileActions, granularTileActions, tileName, tabId, contentMutation]
  );

  const wrapFileName = useCallback(
    (value: string | undefined) => {
      if (!editorTileActions || !granularTileActions) return;

      // 1) Update local state immediately
      editorTileActions.setFileName(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // 2) Optimistic server update
      fileNameMutation.mutate({
        tabId: tabId,
        name: tileName,
        tileType: 'Editor',
        updateData: { fileName: value ?? null },
        actions: granularTileActions,
      });
    },
    [editorTileActions, granularTileActions, tileName, tabId, fileNameMutation]
  );

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
  }, [editorTileActions, wrapFileType, wrapContent, wrapFileName]);

  if (!editorTileActions || !granularTileActions) {
    return {
      editorTile,
      editorTileActions: null,
      loading: {
        fileType: false,
        content: false,
        fileName: false,
        any: false,
      },
      error: {
        fileType: null,
        content: null,
        fileName: null,
        any: false,
      },
      exists: false,
    };
  }

  // Prepare loading states
  const loading: EditorLoadingStates = {
    fileType: mutations.fileType.isPending,
    content: mutations.content.isPending,
    fileName: mutations.fileName.isPending,
    any: false,
  };

  // Check if any property is loading
  loading.any = Object.values(mutations).some((m) => m.isPending);

  // Prepare error states
  const error: EditorErrorStates = {
    fileType: mutations.fileType.error,
    content: mutations.content.error,
    fileName: mutations.fileName.error,
    any: false,
  };

  // Check if any property has error
  error.any = Object.values(mutations).some((m) => !!m.error);

  return {
    editorTile,
    editorTileActions: syncedActions,
    loading,
    error,
    exists,
  };
}
