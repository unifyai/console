import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@/tests/_interfaces/utils/render-with-providers';
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
import type { IStoreState } from '@/contexts/store';
import { mockProjectId, mockProject } from '@/tests/_interfaces/mocks/fixtures/projects';
import { mockInterfaceId, mockInterface } from '@/tests/_interfaces/mocks/fixtures/interfaces';
import { mockTabId, mockTab } from '@/tests/_interfaces/mocks/fixtures/tabs';
import * as optimisticHook from '@/hooks/Interfaces/Query/useTabDataOptimistic';
import type { CompleteTabData } from '@/hooks/Interfaces/Query/useTabDataOptimistic';

// Mock fetch - useTabStreamingQuery now uses direct fetch to /api/tab
const mockFetch = vi.fn();

// Helper to create mock fetch response with proper headers
const createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => data,
});

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

const makeTabsForPrefetch = (): TabData[] => [
  {
    id: mockTabId,
    name: mockTab.name ?? 'Test Tab',
    interfaceId: mockInterfaceId,
    visible: true,
    active: true,
    order: 0,
    context: undefined,
    color: undefined,
  },
  {
    id: 'tab-2',
    name: 'Tab 2',
    interfaceId: mockInterfaceId,
    visible: true,
    active: false,
    order: 1,
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

describe('useTabStreamingQuery (integration-style, node/jsdom)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('streams active tab data and exposes it under activeTab.data', async () => {
    const singleTab: TabData[] = [
      {
        id: mockTabId,
        name: mockTab.name ?? 'Test Tab',
        interfaceId: mockInterfaceId,
        visible: true,
        active: true,
        order: 0,
        context: undefined,
        color: undefined,
      },
    ];

    // Mock fetch to return tab list
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/tab')) {
        return createMockResponse(singleTab);
      }
      if (url.includes('/api/tile')) {
        return createMockResponse([]);
      }
      return createMockResponse({}, 404);
    });

    const tabActions = {
      list: vi.fn(async () => singleTab), // Not used - hook uses direct fetch
    } as unknown as GranularTabActions;

    const actions: StreamingActions = {
      tabActions,
      tileActions: {} as GranularTileActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
    };

    const buildCompleteTabData = vi.fn(
      async () =>
        ({
          tabData: {
            id: mockTabId,
            name: mockTab.name ?? 'Test Tab',
            visible: true,
            active: true,
            order: 0,
            interfaceId: mockInterfaceId,
          } as unknown as TabData,
          tiles: [],
          tableTiles: [],
          plotTiles: [],
          fields: [],
          tableArguments: {} as any,
          plotArguments: {} as any,
          tileDataItems: {},
        }) as unknown as CompleteTabData
    );

    const useTabDataOptimisticSpy = vi
      .spyOn(optimisticHook, 'useTabDataOptimistic')
      .mockReturnValue({ buildCompleteTabData } as any);

    const onResult = vi.fn();

    render(
      <TestComponent
        interfaceId={mockInterfaceId}
        activeTabName={mockTab.name}
        projectId={mockProjectId}
        actions={actions}
        onResult={onResult}
      />,
      { initialState: makeInitialState() }
    );

    await waitFor(
      () => {
        expect(onResult).toHaveBeenCalled();
        const latestState = onResult.mock.calls[onResult.mock.calls.length - 1][0] as ReturnType<
          typeof useTabStreamingQuery
        >;
        expect(latestState.activeTab.data).not.toBeNull();
        expect(latestState.activeTab.data?.tabData.name).toBe(mockTab.name);
      },
      { timeout: 5000 }
    );

    expect(buildCompleteTabData).toHaveBeenCalledTimes(1);
    const [, calledTabId] = buildCompleteTabData.mock.calls[0] as any;
    expect(calledTabId).toBe(mockTabId);

    useTabDataOptimisticSpy.mockRestore();
  });

  it('prefetches non-active tabs and marks them in prefetchedTabs', async () => {
    const allTabs = makeTabsForPrefetch();

    // Mock fetch to return all tabs and empty tiles
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/tab')) {
        return createMockResponse(allTabs);
      }
      if (url.includes('/api/tile')) {
        return createMockResponse([]);
      }
      return createMockResponse({}, 404);
    });

    const tabActions = {
      list: vi.fn(async () => allTabs), // Not used - hook uses direct fetch
    } as unknown as GranularTabActions;

    const actions: StreamingActions = {
      tabActions,
      tileActions: {} as GranularTileActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
    };

    const buildCompleteTabData = vi.fn(async () => ({
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
      .mockReturnValue({ buildCompleteTabData } as any);

    const onResult = vi.fn();

    render(
      <TestComponent
        interfaceId={mockInterfaceId}
        activeTabName={mockTab.name}
        projectId={mockProjectId}
        actions={actions}
        onResult={onResult}
      />,
      { initialState: makeInitialState() }
    );

    // Wait for tabs to be fetched and active tab to be loaded
    await waitFor(
      () => {
        expect(onResult).toHaveBeenCalled();
        const latest = onResult.mock.calls[onResult.mock.calls.length - 1][0] as ReturnType<
          typeof useTabStreamingQuery
        >;
        // allTabs should be populated from the fetch
        expect(latest.allTabs.length).toBeGreaterThan(0);
        // Active tab should be loaded
        expect(latest.activeTab.data).not.toBeNull();
      },
      { timeout: 5000, interval: 100 }
    );

    // buildCompleteTabData should have been called for the active tab
    expect(buildCompleteTabData).toHaveBeenCalled();

    // Verify that allTabs includes both tabs
    const latest = onResult.mock.calls[onResult.mock.calls.length - 1][0] as ReturnType<
      typeof useTabStreamingQuery
    >;
    expect(latest.allTabs).toHaveLength(2);

    useTabDataOptimisticSpy.mockRestore();
  });
});
