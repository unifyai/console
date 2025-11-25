import React, { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@/tests/interfaces/utils/render-with-providers';
import { useTabDataOptimistic, type CompleteTabData } from '@/hooks/Interfaces/Query/useTabDataOptimistic';
import type {
  GranularTabActions,
  GranularTileActions,
  FieldsActions,
  LogsActions,
  ProjectsActions,
  ContextActions,
  TabData,
  TileData,
} from '@/types/interfaces/grid';
import type { IStoreState } from '@/contexts/store';
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

type TabDataActions = {
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

const makeTiles = (): TileData[] => [
  {
    id: 'tile-table',
    tab_id: mockTabId,
    name: 'Logs Table',
    type: 'Table',
    position: { x: 0, y: 0, width: 8, height: 8 },
    minW: 4,
    minH: 4,
    visible: true,
    locked: false,
    moved: false,
    static: false,
    color: undefined,
    context: 'default',
    table: 'logs',
    auto_update: 'true',
    freeze: null,
    filters: null,
    common_filter: null,
    metric: null,
    column_context: null,
    grouping: null,
    table_tile: {
      table_type: 'logs',
      limit: 20,
      offset: 0,
      group_limit: 20,
      group_offset: 0,
      page_number: '0',
    },
    plot_tile: undefined,
    view_tile: undefined,
    editor_tile: undefined,
    terminal_tile: undefined,
  },
  {
    id: 'tile-plot',
    tab_id: mockTabId,
    name: 'Logs Plot',
    type: 'Plot',
    position: { x: 8, y: 0, width: 8, height: 8 },
    minW: 4,
    minH: 4,
    visible: true,
    locked: false,
    moved: false,
    static: false,
    color: undefined,
    context: 'default',
    table: 'logs',
    auto_update: 'true',
    freeze: null,
    filters: null,
    common_filter: null,
    metric: null,
    column_context: null,
    grouping: null,
    table_tile: undefined,
    plot_tile: {
      plot_type: 'histogram',
    },
    view_tile: undefined,
    editor_tile: undefined,
    terminal_tile: undefined,
  },
];

function TestComponent({
  interfaceId,
  tabId,
  tabName,
  projectId,
  actions,
  onComplete,
}: {
  interfaceId: string;
  tabId: string;
  tabName: string;
  projectId: string;
  actions: TabDataActions;
  onComplete: (data: CompleteTabData) => void;
}) {
  const { buildCompleteTabData } = useTabDataOptimistic();

  useEffect(() => {
    (async () => {
      const data = await buildCompleteTabData(interfaceId, tabId, tabName, projectId, actions, {
        // Use lightweight path to avoid heavy per-tile processing;
        // we still exercise tile listing and partitioning logic.
        skipTileData: true,
      });
      onComplete(data);
    })();
  }, [buildCompleteTabData, interfaceId, tabId, tabName, projectId, actions, onComplete]);

  return null;
}

describe('useTabDataOptimistic (lightweight integration, skipTileData)', () => {
  it('assembles a coherent CompleteTabData snapshot with tiles, tableTiles, and plotTiles', async () => {
    const tiles = makeTiles();

    const tileActions = {
      list: vi.fn(async () => tiles),
    } as unknown as GranularTileActions;

    const actions: TabDataActions = {
      tabActions: {} as GranularTabActions,
      tileActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
    };

    const onComplete = vi.fn();

    render(
      <TestComponent
        interfaceId={mockInterfaceId}
        tabId={mockTabId}
        tabName={mockTab.name}
        projectId={mockProjectId}
        actions={actions}
        onComplete={onComplete}
      />,
      { initialState: makeInitialState() },
    );

    expect(tileActions.list).toHaveBeenCalledTimes(1);

    // Wait for buildCompleteTabData to resolve and call onComplete
    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const result = onComplete.mock.calls[0][0] as CompleteTabData;

    // Tab-level data
    expect(result.tabData.id).toBe(mockTabId);
    expect(result.tabData.name).toBe(mockTab.name);

    // Tiles and partitioning
    expect(result.tiles).toHaveLength(tiles.length);
    expect(result.tableTiles).toHaveLength(1);
    expect(result.plotTiles).toHaveLength(1);
    expect(result.tableTiles[0].type).toBe('Table');
    expect(result.plotTiles[0].type).toBe('Plot');

    // Lightweight mode placeholders
    expect(result.fields).toEqual([]);
    expect(result.tableArguments).toEqual({});
    expect(result.plotArguments).toEqual({});
    expect(result.tileDataItems).toEqual({});
  });
});




