import { describe, it, expect } from 'vitest';
import {
  buildGlobalStateForStore,
  buildProjectStateForStore,
  buildInterfaceStateForStore,
  buildTabStateForStore,
  buildTileStateForStore,
  IServerStateData,
} from '@/contexts/utils/stateBuilderUtils';
import {
  Context,
  InterfaceData,
  TabData,
  TileData,
  TilePosition,
} from '@/types/interfaces/grid';

describe('stateBuilderUtils', () => {
  it('buildGlobalStateForStore builds a minimal but coherent global snapshot', () => {
    const result = buildGlobalStateForStore(
      ['project-1', 'project-2'],
      'project-1',
      'interface-1',
      'tab-1',
    );

    expect(result.projects).toEqual(['project-1', 'project-2']);
    expect(result.activeProjectId).toBe('project-1');
    expect(result.activeInterfaceId).toBe('interface-1');
    expect(result.activeTabId).toBe('tab-1');
  });

  it('buildProjectStateForStore builds single-project state with contexts and interfaceIds wired', () => {
    const contexts: Context[] = [
      { name: 'default', description: 'Default context' },
      { name: 'logs', description: 'Logs context' },
    ];
    const interfaceIds = ['interface-1', 'interface-2'];

    const state = buildProjectStateForStore(
      'project-1',
      'Project 1',
      contexts,
      interfaceIds,
      'interface-2',
    ) as IServerStateData;

    expect(state.activeProjectId).toBe('project-1');
    expect(state.projectsById).toBeDefined();
    const project = state.projectsById!['project-1'];

    expect(project.id).toBe('project-1');
    expect(project.name).toBe('Project 1');
    expect(project.contexts).toEqual(contexts);
    expect(project.interfaceIds).toEqual(interfaceIds);
    // activeInterfaceId should honour the override argument
    expect(project.activeInterfaceId).toBe('interface-2');

    // Context helper maps should be populated
    expect(state.projectContexts).toEqual({
      'project-1': ['default', 'logs'],
    });
    expect(state.projectDefaultContext).toEqual({
      'project-1': null,
    });
  });

  it('buildProjectStateForStore builds multi-project state and sets activeProjectId to first project', () => {
    const contexts: Context[][] = [
      [{ name: 'default', description: 'Default' }],
      [{ name: 'logs', description: 'Logs' }],
    ];
    const interfaceIds: string[][] = [
      ['interface-1'],
      ['interface-2'],
    ];

    const state = buildProjectStateForStore(
      ['project-1', 'project-2'],
      ['Project 1', 'Project 2'],
      contexts,
      interfaceIds,
      ['interface-1', 'interface-2'],
    ) as IServerStateData;

    expect(state.projectsById).toBeDefined();
    expect(Object.keys(state.projectsById!)).toEqual(['project-1', 'project-2']);
    expect(state.activeProjectId).toBe('project-1');

    expect(state.projectsById!['project-1'].contexts).toEqual(contexts[0]);
    expect(state.projectsById!['project-2'].contexts).toEqual(contexts[1]);
    expect(state.projectsById!['project-1'].interfaceIds).toEqual(interfaceIds[0]);
    expect(state.projectsById!['project-2'].interfaceIds).toEqual(interfaceIds[1]);
  });

  it('buildProjectStateForStore returns empty state when projectId is null', () => {
    const state = buildProjectStateForStore(
      null as unknown as string,
      null as unknown as string,
      [] as Context[],
      [] as string[],
    ) as IServerStateData;

    expect(state).toEqual({});
  });

  it('buildInterfaceStateForStore builds single-interface state and sets activeInterfaceId', () => {
    const iface: InterfaceData = {
      id: 'interface-1',
      name: 'Interface 1',
      project_id: 'project-1',
    };

    const state = buildInterfaceStateForStore(
      iface,
      'tab-1',
      ['tab-1'],
      ['Tab 1'],
    );

    expect(state.activeInterfaceId).toBe('interface-1');
    expect(state.interfacesById).toBeDefined();
    const stored = state.interfacesById!['interface-1'];

    expect(stored.id).toBe('interface-1');
    expect(stored.name).toBe('Interface 1');
    expect(stored.projectId).toBe('project-1');
    expect(stored.activeTabId).toBe('tab-1');
    expect(stored.tabIds).toEqual(['tab-1']);
    expect(stored.tabNames).toEqual(['Tab 1']);
  });

  it('buildInterfaceStateForStore returns empty state when interfaceData is missing id', () => {
    const empty = buildInterfaceStateForStore(
      { id: undefined, name: 'No Id' } as unknown as InterfaceData,
    );

    expect(empty).toEqual({});
  });

  it('buildTabStateForStore builds single-tab state, wires interfaceId and tiles and sets activeTabId', () => {
    const tab: TabData = {
      id: 'tab-1',
      name: 'Tab 1',
      interface_id: 'interface-1',
      visible: true,
      active: false,
      order: 0,
      context: 'default',
      color: '#ffffff',
    };

    const state = buildTabStateForStore(
      tab,
      true,
      'interface-1',
      ['tile-1'],
      ['Tile 1'],
    );

    expect(state.tabsById).toBeDefined();
    const stored = state.tabsById!['tab-1'];

    expect(stored.id).toBe('tab-1');
    expect(stored.name).toBe('Tab 1');
    expect(stored.interfaceId).toBe('interface-1');
    expect(stored.tileIds).toEqual(['tile-1']);
    expect(stored.tileNames).toEqual(['Tile 1']);
    expect(stored.globalContext).toBe('default');
    expect(stored.itemsNeedRecompute).toBe(false);

    // When isActive is true, activeTabId should be set
    expect(state.activeTabId).toBe('tab-1');
  });

  it('buildTabStateForStore returns empty state when tabData has no id', () => {
    const state = buildTabStateForStore(
      { id: undefined, name: 'No Id' } as unknown as TabData,
      true,
    );

    expect(state).toEqual({});
  });

  it('buildTileStateForStore builds single tile state and wires tabId', () => {
    const position: TilePosition = { x: 0, y: 0, width: 4, height: 4 };

    const tile: TileData = {
      id: 'tile-1',
      name: 'Table Tile',
      position,
      type: 'Table',
      tab_id: 'tab-1',
      visible: true,
      locked: false,
      table: 'logs',
      table_tile: {
        table_type: 'logs',
        page_number: '0',
      },
    };

    const state = buildTileStateForStore(tile, 'tab-1');

    expect(state.tilesById).toBeDefined();
    const stored = state.tilesById!['tile-1'];

    expect(stored.id).toBe('tile-1');
    expect(stored.name).toBe('Table Tile');
    expect(stored.type).toBe('Table');
    expect(stored.position).toEqual(position);
    expect(stored.tabId).toBe('tab-1');
    // TableTile data should be built from table_tile
    expect(stored.tableTile).toBeTruthy();
    expect(stored.tableTile?.table_type).toBe('logs');
  });

  it('buildTileStateForStore returns empty state when tileData has no id', () => {
    const state = buildTileStateForStore(
      { id: undefined, name: 'No Id' } as unknown as TileData,
      'tab-1',
    );

    expect(state).toEqual({});
  });
});


