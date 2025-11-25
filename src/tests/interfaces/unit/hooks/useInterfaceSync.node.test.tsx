import React, { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@/tests/interfaces/utils/render-with-providers';
import { useInterfaceSync } from '@/contexts/hooks/interface/sync';
import type {
  GranularInterfaceActions,
  GranularTabActions,
} from '@/types/interfaces/grid';

// Mock useInterface to provide local data/ui actions
const addTabMock = vi.fn();
const removeTabMock = vi.fn();
const renameTabMock = vi.fn();
const setActiveTabMock = vi.fn();

vi.mock('@/contexts/hooks/interface/useInterface', () => ({
  useInterface: vi.fn(() => ({
    actions: {
      data: {
        addTab: addTabMock,
        removeTab: removeTabMock,
        renameTab: renameTabMock,
      },
      ui: {
        setActiveTab: setActiveTabMock,
      },
    },
  })),
}));

// Mock mutation hooks
const createTabMutateAsync = vi.fn(async () => ({}));
const updateInterfaceMutateAsync = vi.fn(async () => ({}));
const updateTabMutate = vi.fn();
const deleteTabMutate = vi.fn();

vi.mock('@/hooks/Interfaces/Query/useInterfacesQuery', () => ({
  useUpdateInterfaceUnifiedQuery: () => ({
    mutateAsync: updateInterfaceMutateAsync,
  }),
}));

vi.mock('@/hooks/Interfaces/Query/useTabsQuery', () => ({
  useCreateTabQuery: () => ({
    mutateAsync: createTabMutateAsync,
  }),
  useUpdateTabQuery: () => ({
    mutate: updateTabMutate,
  }),
  useUpdateTabByIdQuery: () => ({
    mutateAsync: vi.fn(),
  }),
  useDeleteTabQuery: () => ({
    mutate: deleteTabMutate,
  }),
}));

// Mock store API and getTabId helper for wrapSetActiveTab
const getStateMock = vi.fn(() => ({}));

vi.mock('@/contexts/providers/StoreProvider', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useStoreApiContext: () => ({
      getState: getStateMock,
    }),
  };
});

vi.mock('@/contexts/selectors/tab', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    getTabId: vi.fn(() => 'tab-1'),
  };
});

function InterfaceSyncTest({
  onReady,
  interfaceActions,
  tabActions,
}: {
  onReady: (actions: ReturnType<typeof useInterfaceSync>['actions']) => void;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
}) {
  const result = useInterfaceSync('iface-1', 'project-1', interfaceActions, tabActions);

  useEffect(() => {
    if (result.actions) {
      onReady(result.actions);
    }
  }, [result.actions, onReady]);

  return null;
}

describe('useInterfaceSync', () => {
  const originalConsoleError = console.error;

  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      const [message] = args;
      if (typeof message === 'string' && message.startsWith('Failed to create tab')) {
        // Swallow expected error logs from the failure-path test to keep output clean
        return;
      }
      // Forward any other errors to the original console.error
      originalConsoleError(...(args as Parameters<typeof console.error>));
    });
  });

  afterAll(() => {
    (console.error as any).mockRestore?.();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wrapAddTab updates local state, creates tab on server, and updates interface active_tab_id', async () => {
    const interfaceActions = {} as GranularInterfaceActions;
    const tabActions = {} as GranularTabActions;
    const onReady = vi.fn();

    render(
      <InterfaceSyncTest
        onReady={onReady}
        interfaceActions={interfaceActions}
        tabActions={tabActions}
      />,
    );

    let actions: NonNullable<ReturnType<typeof useInterfaceSync>['actions']>;

    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
      actions = onReady.mock.calls[0][0];
    });

    const newTabName = 'New Tab';
    await actions!.data!.addTab(newTabName);

    // Local state updated with generated UUID and active flags
    expect(addTabMock).toHaveBeenCalledTimes(1);
    const addTabArgs = addTabMock.mock.calls[0];
    expect(addTabArgs[0]).toBe(newTabName);
    const addedTab = addTabArgs[1];
    expect(addedTab.id).toEqual(expect.any(String));
    expect(addedTab.name).toBe(newTabName);

    // Server create mutation called with same tab_id
    expect(createTabMutateAsync).toHaveBeenCalledTimes(1);
    const createPayload = createTabMutateAsync.mock.calls[0][0];
    expect(createPayload.tab_id).toBe(addedTab.id);
    expect(createPayload.interface_id).toBe('iface-1');

    // Interface active_tab_id is updated on server
    expect(updateInterfaceMutateAsync).toHaveBeenCalledTimes(1);
    const updatePayload = updateInterfaceMutateAsync.mock.calls[0][0];
    expect(updatePayload.interfaceId).toBe('iface-1');
    expect(updatePayload.data.active_tab_id).toBe(addedTab.id);
  });

  it('wrapAddTab rolls back local state when server creation fails', async () => {
    const interfaceActions = {} as GranularInterfaceActions;
    const tabActions = {} as GranularTabActions;
    const onReady = vi.fn();

    createTabMutateAsync.mockRejectedValueOnce(new Error('create failed'));

    render(
      <InterfaceSyncTest
        onReady={onReady}
        interfaceActions={interfaceActions}
        tabActions={tabActions}
      />,
    );

    let actions: NonNullable<ReturnType<typeof useInterfaceSync>['actions']>;

    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
      actions = onReady.mock.calls[0][0];
    });

    const newTabName = 'New Tab';
    await actions!.data!.addTab(newTabName);

    // addTab called once optimistically
    expect(addTabMock).toHaveBeenCalledTimes(1);

    // On failure, removeTab should be called to roll back
    expect(removeTabMock).toHaveBeenCalledWith(newTabName);

    // No interface update when create fails
    expect(updateInterfaceMutateAsync).not.toHaveBeenCalled();
  });
});


