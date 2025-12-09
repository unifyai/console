import React, { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@/tests/interfaces/utils/render-with-providers';
import { useTabSync } from '@/contexts/hooks/tab/sync';
import type {
  GranularTabActions,
  GranularTileActions,
} from '@/types/interfaces/grid';

// Mocks for useTab to provide tab data/actions
const initTileMock = vi.fn();
const removeTileMock = vi.fn();
const getTileNameMock = vi.fn();
const getReferencedTileIdsByNameMock = vi.fn(() => []);
const getReferencedPlotTileIdsByNameMock = vi.fn(() => ({ xAxis: [], yAxis: [], plotGroupBy: [] }));

vi.mock('@/contexts/hooks/tab/useTab', () => ({
  useTab: vi.fn(() => ({
    data: {
      globalContext: null,
    },
    actions: {
      data: {
        initTile: initTileMock,
        removeTile: removeTileMock,
        getTileName: getTileNameMock,
        getReferencedTileIdsByName: getReferencedTileIdsByNameMock,
        getReferencedPlotTileIdsByName: getReferencedPlotTileIdsByNameMock,
        getTileIds: vi.fn(() => []),
        getTileNames: vi.fn(() => []),
        getPartialTile: vi.fn(),
        removeContextFromTab: vi.fn(),
      },
      ui: {
        setPending: vi.fn(),
      },
    },
  })),
}));

// Mocks for tile mutations
const createTileMutateAsync = vi.fn(async () => ({}));
const patchTileMutate = vi.fn();
const deleteTileMutate = vi.fn();

vi.mock('@/hooks/Interfaces/Query/useTilesQuery', () => ({
  useCreateTileQuery: () => ({
    mutate: createTileMutateAsync, // wrapInitTile uses .mutate()
    mutateAsync: createTileMutateAsync, // wrapDuplicateTile uses .mutateAsync()
  }),
  useUpdateTileQuery: () => ({
    mutate: vi.fn(),
  }),
  usePatchTileQuery: () => ({
    mutate: patchTileMutate,
  }),
  useDeleteTileQuery: () => ({
    mutate: deleteTileMutate,
  }),
}));

vi.mock('@/hooks/Interfaces/Query/useTabRouterRefresh', () => ({
  useTabRouterRefresh: () => vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

function TabSyncTest({
  onReady,
  tabActions,
  tileActions,
}: {
  onReady: (actions: ReturnType<typeof useTabSync>['actions']) => void;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
}) {
  const result = useTabSync('tab-1', 'iface-1', tabActions, tileActions);

  useEffect(() => {
    if (result.actions) {
      onReady(result.actions);
    }
  }, [result.actions, onReady]);

  return null;
}

describe('useTabSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wrapInitTile generates a UUID, calls initTile locally, and creates tile on server', async () => {
    const tabActions = {} as GranularTabActions;
    const tileActions = {} as GranularTileActions;
    const onReady = vi.fn();

    render(
      <TabSyncTest
        onReady={onReady}
        tabActions={tabActions}
        tileActions={tileActions}
      />,
    );

    let actions: NonNullable<ReturnType<typeof useTabSync>['actions']>;

    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
      actions = onReady.mock.calls[0][0];
    });

    const tileName = 'New Tile';
    await actions!.data!.initTile(tileName, {});

    // Local initTile called with generated id and name
    expect(initTileMock).toHaveBeenCalledTimes(1);
    const [calledName, initialState] = initTileMock.mock.calls[0];
    expect(calledName).toBe(tileName);
    expect(initialState.id).toEqual(expect.any(String));
    expect(initialState.name).toBe(tileName);

    // Server create tile called with same id
    expect(createTileMutateAsync).toHaveBeenCalledTimes(1);
    const payload = createTileMutateAsync.mock.calls[0][0];
    expect(payload.tile_id).toBe(initialState.id);
    expect(payload.tab_id).toBe('tab-1');
    expect(payload.actions).toBe(tileActions);
  });
});


