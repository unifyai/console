import React, { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@/tests/interfaces/utils/render-with-providers';
import { useQueryClient } from '@tanstack/react-query';
import type { IStoreState } from '@/contexts/store';
import { useTabStreamingQuery } from '@/hooks/Interfaces/Query/useTabStreamingQuery';
import type {
  GranularTabActions,
  GranularTileActions,
  FieldsActions,
  LogsActions,
  ProjectsActions,
  ContextActions,
  TabData,
} from '@/types/interfaces/grid';
import type { CompleteTabData } from '@/hooks/Interfaces/Query/useTabDataOptimistic';
import {
  mockProjectId,
  mockProject,
} from '@/tests/interfaces/mocks/fixtures/projects';
import {
  mockInterfaceId,
  mockInterface,
} from '@/tests/interfaces/mocks/fixtures/interfaces';
import {
  mockTabId,
  mockTab,
} from '@/tests/interfaces/mocks/fixtures/tabs';
import * as optimisticHook from '@/hooks/Interfaces/Query/useTabDataOptimistic';

type StreamingActions = {
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  fieldsActions: FieldsActions;
  logsActions: LogsActions;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
};

const makeInitialState = (): Partial<IStoreState> => ({
  projects: [mockProjectId],
  activeProjectId: mockProjectId,
  activeInterfaceId: mockInterfaceId,
  activeTabId: mockTabId,
  projectsById: { [mockProjectId]: mockProject },
  interfacesById: { [mockInterfaceId]: { ...mockInterface } },
  tabsById: { [mockTabId]: { ...mockTab } },
});

const makeTabList = (): TabData[] => [
  {
    id: mockTabId,
    name: mockTab.name,
    interface_id: mockInterfaceId,
    visible: true,
    active: true,
    order: 0,
    context: undefined,
    color: undefined,
  },
];

function TestComponent({
  interfaceId,
  activeTabName,
  projectId,
  actions,
  onResult,
}: {
  interfaceId: string;
  activeTabName: string | null;
  projectId: string | null;
  actions: StreamingActions;
  onResult: (state: ReturnType<typeof useTabStreamingQuery>) => void;
}) {
  const state = useTabStreamingQuery(interfaceId, activeTabName, projectId, actions);
  onResult(state);
  return null;
}

describe('useTabStreamingQuery', () => {
  it('streams active tab data using buildCompleteTabData and exposes it under activeTab.data', async () => {
    const tabActions = {
      list: vi.fn(async () => makeTabList()),
    } as unknown as GranularTabActions;

    const actions: StreamingActions = {
      tabActions,
      tileActions: {} as GranularTileActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
    };

    const buildCompleteTabData = vi.fn<[], Promise<CompleteTabData>>(
      async () =>
        ({
          tabData: {
            id: mockTabId,
            name: mockTab.name,
            visible: true,
            active: true,
            order: 0,
            interface_id: mockInterfaceId,
          } as unknown as TabData,
          tiles: [],
          tableTiles: [],
          plotTiles: [],
          fields: [],
          tableArguments: {} as any,
          plotArguments: {} as any,
          tileDataItems: {},
        } satisfies CompleteTabData),
    );

    // Spy on useTabDataOptimistic to return our stubbed buildCompleteTabData
    const useTabDataOptimisticSpy = vi
      .spyOn(optimisticHook, 'useTabDataOptimistic')
      .mockReturnValue({ buildCompleteTabData });

    const onResult = vi.fn();

    render(
      <TestComponent
        interfaceId={mockInterfaceId}
        activeTabName={mockTab.name}
        projectId={mockProjectId}
        actions={actions}
        onResult={onResult}
      />,
      { initialState: makeInitialState() },
    );

    await waitFor(() => {
      // React Query should have resolved the active tab query at least once
      expect(onResult).toHaveBeenCalled();
      const latestState = onResult.mock.calls[onResult.mock.calls.length - 1][0] as ReturnType<
        typeof useTabStreamingQuery
      >;
      expect(latestState.activeTab.data).not.toBeNull();
      expect(latestState.activeTab.data?.tabData.name).toBe(mockTab.name);
    });

    expect(buildCompleteTabData).toHaveBeenCalledTimes(1);
    // Assert that buildCompleteTabData was invoked with the correct tab id
    const [, calledTabId] = buildCompleteTabData.mock.calls[0];
    expect(calledTabId).toBe(mockTabId);

    useTabDataOptimisticSpy.mockRestore();
  });

  it('prefetches non-active tabs and marks them in prefetchedTabs', async () => {
    const allTabs: TabData[] = [
      {
        id: mockTabId,
        name: mockTab.name,
        interface_id: mockInterfaceId,
        visible: true,
        active: true,
        order: 0,
        context: undefined,
        color: undefined,
      },
      {
        id: 'tab-2',
        name: 'Tab 2',
        interface_id: mockInterfaceId,
        visible: true,
        active: false,
        order: 1,
        context: undefined,
        color: undefined,
      },
    ];

    const tabActions = {
      list: vi.fn(async () => allTabs),
    } as unknown as GranularTabActions;

    const actions: StreamingActions = {
      tabActions,
      tileActions: {} as GranularTileActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
    };

    const buildCompleteTabData = vi.fn<[], Promise<CompleteTabData>>(async () => ({
      tabData: allTabs[1] as any,
      tiles: [],
      tableTiles: [],
      plotTiles: [],
      fields: [],
      tableArguments: {} as any,
      plotArguments: {} as any,
      tileDataItems: {},
    }));

    const useTabDataOptimisticSpy = vi
      .spyOn(optimisticHook, 'useTabDataOptimistic')
      .mockReturnValue({ buildCompleteTabData });

    const onResult = vi.fn();

    render(
      <TestComponent
        interfaceId={mockInterfaceId}
        activeTabName={mockTab.name}
        projectId={mockProjectId}
        actions={actions}
        onResult={onResult}
      />,
      { initialState: makeInitialState() },
    );

    await waitFor(() => {
      expect(onResult).toHaveBeenCalled();
      const latest = onResult.mock.calls[onResult.mock.calls.length - 1][0] as ReturnType<
        typeof useTabStreamingQuery
      >;
      // Eventually, the non-active tab's name should be in prefetchedTabs
      expect(latest.prefetchedTabs.has('Tab 2')).toBe(true);
    });

    expect(buildCompleteTabData).toHaveBeenCalled();

    useTabDataOptimisticSpy.mockRestore();
  });

  it('switchTab returns true when tab data is cached and false otherwise', async () => {
    const tabActions = {
      list: vi.fn(async () => makeTabList()),
    } as unknown as GranularTabActions;

    const actions: StreamingActions = {
      tabActions,
      tileActions: {
        list: vi.fn(async () => [])
      } as unknown as GranularTileActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
    };

    function SwitchTabTest({ onResult }: { onResult: (cold: boolean, warm: boolean) => void }) {
      const queryClient = useQueryClient();
      const state = useTabStreamingQuery(mockInterfaceId, mockTab.name, mockProjectId, actions);

      useEffect(() => {
        // Cold switch: no cached data yet
        const cold = state.switchTab('Tab 2');

        // Seed cache for Tab 2 and try again
        queryClient.setQueryData(['tabCompleteData', mockInterfaceId, 'Tab 2', mockProjectId], {
          tabData: {
            id: 'tab-2',
            name: 'Tab 2',
          } as TabData,
          tiles: [],
          tableTiles: [],
          plotTiles: [],
          fields: [],
          tableArguments: {} as any,
          plotArguments: {} as any,
          tileDataItems: {},
        } as CompleteTabData);

        const warm = state.switchTab('Tab 2');
        onResult(cold, warm);
      }, [state, queryClient]);

      return null;
    }

    const onResult = vi.fn();

    render(<SwitchTabTest onResult={onResult} />, {
      initialState: makeInitialState(),
    });

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(1);
      const [cold, warm] = onResult.mock.calls[0] as [boolean, boolean];
      expect(cold).toBe(false);
      expect(warm).toBe(true);
    });
  });

  it('handles race conditions: ignores slow response from previous tab when switching to new tab', async () => {
    // Real timers logic
    const slowTabData = { ...mockTab, id: 'slow-tab-id', name: 'Slow Tab', interface_id: mockInterfaceId };
    const fastTabData = { ...mockTab, id: 'fast-tab-id', name: 'Fast Tab', interface_id: mockInterfaceId };

    const tabActions = {
      list: vi.fn(async () => [slowTabData, fastTabData]),
      getByName: vi.fn(async (projectId, interfaceId, name) => (name === 'Slow Tab' ? slowTabData : fastTabData)),
    } as unknown as GranularTabActions;

    const actions: StreamingActions = {
      tabActions,
      tileActions: {
        list: vi.fn(async () => []) // Ensure list is mocked to prevent crash
      } as unknown as GranularTileActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
    };

    // Mock buildCompleteTabData to simulate real delays
    const buildCompleteTabData = vi.fn<[string], Promise<CompleteTabData>>(
      async (tabId) => {
        if (tabId === 'slow-tab-id') {
          // Sleep 200ms for the slow tab
          await new Promise((resolve) => setTimeout(resolve, 200));
          return {
            tabData: { id: tabId, name: 'Slow Tab', interface_id: mockInterfaceId } as TabData,
            tiles: [], tableTiles: [], plotTiles: [], fields: [], tableArguments: {} as any, plotArguments: {} as any, tileDataItems: {},
          };
        }
        // Fast tab returns almost immediately (50ms)
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          tabData: { id: tabId, name: 'Fast Tab', interface_id: mockInterfaceId } as TabData,
          tiles: [], tableTiles: [], plotTiles: [], fields: [], tableArguments: {} as any, plotArguments: {} as any, tileDataItems: {},
        };
      }
    );

    const useTabDataOptimisticSpy = vi
      .spyOn(optimisticHook, 'useTabDataOptimistic')
      .mockReturnValue({ buildCompleteTabData });

    const onResult = vi.fn();

    function RaceConditionTest() {
      const [activeTabName, setActiveTabName] = React.useState('Slow Tab');
      const state = useTabStreamingQuery(mockInterfaceId, activeTabName, mockProjectId, actions);
      
      // Switch tabs after 20ms (so Slow Tab has started but not finished)
      useEffect(() => {
        const t = setTimeout(() => setActiveTabName('Fast Tab'), 20);
        return () => clearTimeout(t);
      }, []);

      useEffect(() => {
        onResult(state);
      }, [state, onResult]);

      return null;
    }

    const baseState = makeInitialState();
    const slowTab = slowTabData as any;
    const fastTab = fastTabData as any;
    baseState.tabsById = {
      ...(baseState.tabsById || {}),
      [slowTab.id]: slowTab,
      [fastTab.id]: fastTab,
    };
    baseState.interfacesById = {
      ...(baseState.interfacesById || {}),
      [mockInterfaceId]: {
        ...(baseState.interfacesById?.[mockInterfaceId] || {}),
        tabIds: [
          ...(baseState.interfacesById?.[mockInterfaceId]?.tabIds || []),
          slowTab.id,
          fastTab.id,
        ],
        tabNames: [
          ...(baseState.interfacesById?.[mockInterfaceId]?.tabNames || []),
          slowTab.name,
          fastTab.name,
        ],
        activeTabId: slowTab.id,
      },
    };
    baseState.activeTabId = slowTab.id;

    render(<RaceConditionTest />, {
      initialState: baseState,
    });

    // Wait until we see Fast Tab
    await waitFor(() => {
      const latest = onResult.mock.calls[onResult.mock.calls.length - 1][0];
      expect(latest.activeTab.data?.tabData.name).toBe('Fast Tab');
    }, { timeout: 1000 });

    // Wait well past the slow tab finish time (200ms)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify we are still on Fast Tab
    const finalState = onResult.mock.calls[onResult.mock.calls.length - 1][0];
    expect(finalState.activeTab.data?.tabData.name).toBe('Fast Tab');

    useTabDataOptimisticSpy.mockRestore();
  });

  it('respects concurrency limit for prefetching', async () => {
    const tabs = Array.from({ length: 5 }, (_, i) => ({
      id: `tab-${i}`,
      name: `Tab ${i}`,
      interface_id: mockInterfaceId,
      visible: true,
      active: false,
    } as TabData));
    // Make one active
    tabs[0].active = true;

    const tabActions = {
      list: vi.fn(async () => tabs),
    } as unknown as GranularTabActions;

    const actions: StreamingActions = {
      tabActions,
      tileActions: {} as GranularTileActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
    };

    let activeRequests = 0;
    let maxConcurrent = 0;

    const buildCompleteTabData = vi.fn<[string, string, string], Promise<CompleteTabData>>(
      async (interfaceId, tabId, tabName) => {
        // Only count non-active tab prefetches (Tabs 1-4)
        if (tabName !== 'Tab 0') {
            activeRequests++;
            maxConcurrent = Math.max(maxConcurrent, activeRequests);
            // Simulate slow network
            await new Promise((resolve) => setTimeout(resolve, 50));
            activeRequests--;
        }
        
        return {
          tabData: tabs.find(t => t.id === tabId)!,
          tiles: [], tableTiles: [], plotTiles: [], fields: [], tableArguments: {} as any, plotArguments: {} as any, tileDataItems: {},
        } as CompleteTabData;
      }
    );

    const useTabDataOptimisticSpy = vi
      .spyOn(optimisticHook, 'useTabDataOptimistic')
      .mockReturnValue({ buildCompleteTabData });

    const onResult = vi.fn();

    render(
      <TestComponent
        interfaceId={mockInterfaceId}
        activeTabName="Tab 0"
        projectId={mockProjectId}
        actions={actions}
        onResult={onResult}
      />,
      { initialState: makeInitialState() },
    );

    await waitFor(() => {
        // Wait for all prefetches to complete
        const latest = onResult.mock.calls[onResult.mock.calls.length - 1][0] as ReturnType<typeof useTabStreamingQuery>;
        expect(latest.prefetchedTabs.size).toBe(4); // 4 non-active tabs
    }, { timeout: 2000 });

    // The hook defines MAX_CONCURRENT_PREFETCH = 3
    expect(maxConcurrent).toBeLessThanOrEqual(3);
    expect(maxConcurrent).toBeGreaterThan(0);

    useTabDataOptimisticSpy.mockRestore();
  });
});
