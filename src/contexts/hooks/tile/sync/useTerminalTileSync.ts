'use client';

import { useMemo } from 'react';
import { usePatchSpecializedTileQuery } from '@/hooks/Interfaces/Query/useTilesQuery';
import {
  ContextActions,
  FieldsActions,
  LogsActions,
  ProjectsActions,
  GranularTileActions,
} from '@/types/interfaces/grid';
import { useTerminalTile, TerminalActions } from '../useTerminalTile';
import { useTileUI } from '../useTileUI';
import { useTileMeta } from '../useTileMeta';
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';

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
 * Properties of the TerminalTile that will be synced with the server
 */
export type SyncedTerminalProperties = 'shellType';

export type TerminalLoadingStates = {
  [key in SyncedTerminalProperties]: boolean;
} & { any: boolean };

export type TerminalErrorStates = {
  [key in SyncedTerminalProperties]: Error | null;
} & { any: boolean };

export interface TerminalTileSyncResult {
  terminalTile: ReturnType<typeof useTerminalTile>['terminalTile'];
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
  const { terminalTile, terminalTileActions, exists } = useTerminalTile(tileId, tabId);

  const { meta } = useTileMeta(tileId, tabId);
  const { uiActions } = useTileUI(tileId, tabId);
  const tileName = meta?.name;

  const storeApi = useStoreApiContext();

  // Only one property for terminal
  const shellTypeMutation = usePatchSpecializedTileQuery<'Terminal'>();

  const mutations = { shellType: shellTypeMutation };

  // wrapper
  const wrapShellType = async (value: string | null | undefined) => {
    if (!terminalTileActions || !granularTileActions) return;

    terminalTileActions.setShellType(value);

    if (!tileName || !tabId) return;

    shellTypeMutation.mutate({
      tabId: tabId,
      name: tileName,
      tileType: 'Terminal',
      updateData: { shellType: value ?? null },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalTileActions, tabId, tileName, granularTileActions]);

  if (!terminalTileActions || !granularTileActions) {
    return {
      terminalTile,
      terminalTileActions: null,
      loading: {
        shellType: false,
        any: false,
      },
      error: {
        shellType: null,
        any: false,
      },
      exists: false,
    };
  }

  // loading & error states
  const loading: TerminalLoadingStates = {
    shellType: mutations.shellType.isPending,
    any: false,
  };

  loading.any = Object.values(mutations).some((m) => m.isPending);

  const error: TerminalErrorStates = {
    shellType: mutations.shellType.error,
    any: false,
  };

  error.any = Object.values(mutations).some((m) => !!m.error);

  return {
    terminalTile,
    terminalTileActions: syncedActions,
    loading,
    error,
    exists,
  };
}
