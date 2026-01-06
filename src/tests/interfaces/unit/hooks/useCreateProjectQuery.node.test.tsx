import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCreateProjectQuery } from '@/hooks/Interfaces/Query/useCreateProjectQuery';
import { 
  GranularInterfaceActions, 
  GranularTabActions, 
  GranularTileActions 
} from '@/types/interfaces/grid';
import { createQueryWrapper } from '@/tests/interfaces/utils/render-with-providers';

describe('useCreateProjectQuery', () => {
  const mockInterfaceActions = {
    create: vi.fn(),
  } as unknown as GranularInterfaceActions;

  const mockTabActions = {
    create: vi.fn(),
  } as unknown as GranularTabActions;

  const mockTileActions = {
    create: vi.fn(),
  } as unknown as GranularTileActions;

  const mockActions = {
    interfaceActions: mockInterfaceActions,
    tabActions: mockTabActions,
    tileActions: mockTileActions,
  };

  it('creates project resources in order: Interface -> Tab -> Tiles', async () => {
    // Mocks
    (mockInterfaceActions.create as any).mockResolvedValue({ id: 'i1', project_id: 'p1', name: 'I1' });
    (mockTabActions.create as any).mockResolvedValue({ id: 't1', interface_id: 'i1', name: 'Tab 1' });
    (mockTileActions.create as any).mockResolvedValue({ id: 'tile1', tab_id: 't1', name: 'Tile 1' });

    const { result } = renderHook(() => useCreateProjectQuery(), {
      wrapper: createQueryWrapper(),
    });

    // Invoke mutation
    const input = {
      interface: { project_id: 'p1', name: 'I1', tabIds: [], tabNames: [] },
      tab: { name: 'Tab 1', visible: true, active: true, order: 0, context: 'default', tileIds: [], tileNames: [] },
      tiles: [
        { 
          id: 'tile1', 
          name: 'Tile 1', 
          type: 'Table', 
          position: { x: 0, y: 0, w: 1, h: 1 }, 
          tab_id: 't1' 
        } as any
      ],
      actions: mockActions
    };

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify Interface Creation
    expect(mockInterfaceActions.create).toHaveBeenCalledWith('p1', 'I1', undefined);

    // Verify Tab Creation (using ID from interface)
    expect(mockTabActions.create).toHaveBeenCalledWith('i1', 'Tab 1', expect.objectContaining({
        context: 'default'
    }));

    // Verify Tile Creation (using ID from tab)
    expect(mockTileActions.create).toHaveBeenCalledWith(
      't1', 
      'Tile 1', 
      expect.anything(), 
      expect.anything(),
      undefined,
      'Table'
    );
  });

  it('handles error during creation', async () => {
    (mockInterfaceActions.create as any).mockRejectedValue(new Error('API Failed'));

    const { result } = renderHook(() => useCreateProjectQuery(), {
        wrapper: createQueryWrapper(),
    });

    const input = {
        interface: { project_id: 'p1', name: 'I1', tabIds: [], tabNames: [] },
        tab: { name: 'Tab 1', visible: true, active: true, order: 0, context: 'default', tileIds: [], tileNames: [] },
        actions: mockActions
    };
  
    result.current.mutate(input);
  
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});

