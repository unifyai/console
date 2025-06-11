"use client";

import { useMemo } from "react";
import { usePatchSpecializedTileQuery } from "@/hooks/Query/useTilesQuery";
import {
  ContextActions,
  FieldsActions,
  LogsActions,
  ProjectsActions,
  GranularTileActions,
} from "@/types/evals/grid";
import {
  useTerminalTile,
  TerminalActions,
} from "../useTerminalTile";
import { useTileUI } from "../useTileUI";
import { useTileMeta } from "../useTileMeta";
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";

/**
 * Properties of the TerminalTile that will be synced with the server
 */
export type SyncedTerminalProperties = "shell_type";

export type TerminalLoadingStates = {
  [key in SyncedTerminalProperties]: boolean;
} & { any: boolean };

export type TerminalErrorStates = {
  [key in SyncedTerminalProperties]: Error | null;
} & { any: boolean };

export interface TerminalTileSyncResult {
  terminalTile: ReturnType<typeof useTerminalTile>["terminalTile"];
  terminalTileActions: TerminalActions | null;
  loading: TerminalLoadingStates;
  error: TerminalErrorStates;
  exists: boolean;
}

export function useTerminalTileSync(
  tileId: string | null,
  tabId: string | null,
  granularTileActions?: GranularTileActions,
  projectsActions?: ProjectsActions,
  contextActions?: ContextActions,
  logsActions?: LogsActions,
  fieldsActions?: FieldsActions
): TerminalTileSyncResult {
  const { terminalTile, terminalTileActions, exists } = useTerminalTile(
    tileId,
    tabId
  );

  const { meta } = useTileMeta(tileId, tabId);
  const { uiActions } = useTileUI(tileId, tabId);
  const tileName = meta?.name;

  const storeApi = useStoreApiContext();

  // Only one property for terminal
  const shellTypeMutation = usePatchSpecializedTileQuery<"Terminal">();

  const mutations = { shell_type: shellTypeMutation };

  // wrapper
  const wrapShellType = async (value: string | null | undefined) => {
    if (!terminalTileActions || !granularTileActions) return;

    terminalTileActions.setShellType(value);

    if (!tileName || !tabId) return;

    shellTypeMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Terminal",
      updateData: { shell_type: value ?? null },
      actions: granularTileActions,
    });
  };

  // enhanced actions
  const syncedActions = useMemo(() => {
    if (!terminalTileActions) return null;
    return {
      ...terminalTileActions,
      setShellType: wrapShellType,
    } as TerminalActions;
  }, [terminalTileActions, tabId, tileName, granularTileActions]);

  if (!terminalTileActions || !granularTileActions) {
    return {
      terminalTile,
      terminalTileActions: null,
      loading: {
        shell_type: false,
        any: false,
      },    
      error: {
        shell_type: null,
        any: false,
      },
      exists: false,
    };
  }

  // loading & error states
  const loading: TerminalLoadingStates = {
    shell_type: mutations.shell_type.isPending,
    any: false,
  };

  loading.any = Object.values(mutations).some(m => m.isPending);

  const error: TerminalErrorStates = {
    shell_type: mutations.shell_type.error,
    any: false,
  };

  error.any = Object.values(mutations).some(m => !!m.error);

  return {
    terminalTile,
    terminalTileActions: syncedActions,
    loading,
    error,
    exists,
  };
} 