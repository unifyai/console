import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSaveTabWithTilesQuery } from '@/hooks/Interfaces/Query/useSaveTabWithTilesQuery';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GranularTabActions, GranularTileActions } from '@/types/interfaces/grid';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe('useSaveTabWithTilesQuery', () => {
  const mockTabActions = {
    checkpointById: vi.fn(),
    checkpointByName: vi.fn(),
  } as unknown as GranularTabActions;

  const mockTileActions = {
    checkpointById: vi.fn(),
  } as unknown as GranularTileActions;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully creates checkpoints for tab (by id) and all tiles', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useSaveTabWithTilesQuery(mockTabActions, mockTileActions),
      { wrapper }
    );

    (mockTabActions.checkpointById as any).mockResolvedValue({ id: 'chk-tab' });
    (mockTileActions.checkpointById as any).mockResolvedValue({ id: 'chk-tile' });

    const response = await result.current.mutateAsync({
      tab_id: 'tab-1',
      tile_ids: ['tile-1', 'tile-2'],
    });

    expect(mockTabActions.checkpointById).toHaveBeenCalledWith('tab-1', expect.any(String));
    expect(mockTileActions.checkpointById).toHaveBeenCalledWith('tile-1', expect.any(String));
    expect(mockTileActions.checkpointById).toHaveBeenCalledWith('tile-2', expect.any(String));
    expect(response.success).toBe(true);
  });

  it('successfully creates checkpoints for tab (by name) and all tiles', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useSaveTabWithTilesQuery(mockTabActions, mockTileActions),
      { wrapper }
    );

    (mockTabActions.checkpointByName as any).mockResolvedValue({ id: 'chk-tab' });
    (mockTileActions.checkpointById as any).mockResolvedValue({ id: 'chk-tile' });

    await result.current.mutateAsync({
      interface_id: 'int-1',
      tab_name: 'MyTab',
      tile_ids: ['tile-1'],
    });

    expect(mockTabActions.checkpointByName).toHaveBeenCalledWith(
      'int-1',
      'MyTab',
      expect.any(String)
    );
    expect(mockTileActions.checkpointById).toHaveBeenCalledWith('tile-1', expect.any(String));
  });

  it('throws error if parameters are missing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useSaveTabWithTilesQuery(mockTabActions, mockTileActions),
      { wrapper }
    );

    await expect(
      result.current.mutateAsync({
        tile_ids: ['tile-1'],
        // Missing tab_id AND (interface_id + tab_name)
      } as any)
    ).rejects.toThrow('Missing required parameters');
  });

  it('throws error if some tiles fail', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useSaveTabWithTilesQuery(mockTabActions, mockTileActions),
      { wrapper }
    );

    (mockTabActions.checkpointById as any).mockResolvedValue({ id: 'chk-tab' });
    (mockTileActions.checkpointById as any).mockImplementation(async (id: string) => {
      if (id === 'fail-tile') throw new Error('Failed');
      return { id: `chk-${id}` };
    });

    // Implementation throws if any tiles fail
    await expect(result.current.mutateAsync({
      tab_id: 'tab-1',
      tile_ids: ['good-tile', 'fail-tile'],
    })).rejects.toThrow('Failed to save 1 tile(s)');
  });

  it('fails completely if tab checkpoint fails', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useSaveTabWithTilesQuery(mockTabActions, mockTileActions),
      { wrapper }
    );

    (mockTabActions.checkpointById as any).mockRejectedValue(new Error('Tab Error'));

    await expect(
      result.current.mutateAsync({
        tab_id: 'tab-1',
        tile_ids: ['tile-1'],
      })
    ).rejects.toThrow('Failed to create tab checkpoint');
    
    // Should not attempt tiles if tab fails (based on implementation reading)
    expect(mockTileActions.checkpointById).not.toHaveBeenCalled();
  });
});

