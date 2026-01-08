import { describe, it, expect } from 'vitest';
import { createStore } from '@/contexts/store';

describe('tileSlice', () => {
  it('initTile creates a tile, initializes type-specific data, and attaches it to the parent tab', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {
      name: 'Interface 1',
      tabIds: [],
      tabNames: [],
    });
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });

    state.initTile('tab-1', 'tile-1', { name: 'Logs', type: 'Table' });

    const next = store.getState();
    const tile = next.tilesById['tile-1'];
    expect(tile).toBeDefined();
    expect(tile.name).toBe('Logs');
    expect(tile.type).toBe('Table');
    // Table tiles should have tableTile initialised
    expect(tile.tableTile).toBeTruthy();
    // Other type-specific structures are also initialised by default; we only
    // care that the Table-specific data exists, not that others are null.

    const tab = next.tabsById['tab-1'];
    expect(tab.tileIds).toContain('tile-1');
    expect(tab.tileNames).toContain('Logs');
  });

  it('setType clears old type-specific data and initializes new type data', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {
      name: 'Interface 1',
      tabIds: [],
      tabNames: [],
    });
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });

    state.initTile('tab-1', 'tile-1', { name: 'Logs', type: 'Table' });

    // Sanity check initial type-specific data
    let next = store.getState();
    const initialTableTile = next.tilesById['tile-1'].tableTile;
    const initialPlotTile = next.tilesById['tile-1'].plotTile;
    expect(initialTableTile).toBeTruthy();
    expect(initialPlotTile).toBeTruthy();

    // Change type to Plot
    state.setType('tile-1', 'Plot');
    next = store.getState();

    const tile = next.tilesById['tile-1'];
    expect(tile.type).toBe('Plot');
    // Table-specific data should have been cleared
    expect(tile.tableTile).toBeNull();
    // Plot-specific data should have been (re)initialised
    expect(tile.plotTile).toBeTruthy();
  });

  it('updateTile marks itemsNeedRecompute on tile and parent tab when data-affecting props change', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {
      name: 'Interface 1',
      tabIds: [],
      tabNames: [],
    });
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });
    // Provide tabId in initialState so updateTile can propagate recompute to the tab
    state.initTile('tab-1', 'tile-1', { name: 'Logs', type: 'Table', tabId: 'tab-1' });

    // Initially no recompute flags
    {
      const seeded = store.getState();
      expect(seeded.tilesById['tile-1'].itemsNeedRecompute).toBe(false);
      expect(seeded.tabsById['tab-1'].itemsNeedRecompute).toBe(false);
    }

    // Update a data-affecting property (filters)
    state.updateTile('tile-1', { filters: 'status = error' });

    const next = store.getState();
    expect(next.tilesById['tile-1'].itemsNeedRecompute).toBe(true);
    expect(next.tabsById['tab-1'].itemsNeedRecompute).toBe(true);
  });

  it('updateTile does not mark itemsNeedRecompute for non data-affecting props like locked', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {
      name: 'Interface 1',
      tabIds: [],
      tabNames: [],
    });
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });
    state.initTile('tab-1', 'tile-1', { name: 'Logs', type: 'Table', tabId: 'tab-1' });

    // Sanity check initial flags
    {
      const seeded = store.getState();
      expect(seeded.tilesById['tile-1'].itemsNeedRecompute).toBe(false);
      expect(seeded.tabsById['tab-1'].itemsNeedRecompute).toBe(false);
    }

    // Update a non data-affecting UI property
    state.updateTile('tile-1', { locked: true });

    const next = store.getState();
    expect(next.tilesById['tile-1'].itemsNeedRecompute).toBe(false);
    expect(next.tabsById['tab-1'].itemsNeedRecompute).toBe(false);
  });

  it('removeTile deletes the tile, updates the parent tab lists, and clears references in other tiles', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {
      name: 'Interface 1',
      tabIds: [],
      tabNames: [],
    });
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });

    // Mark this project/interface/tab as active so we can assert they remain valid
    state.setActiveProject('project-1');
    state.setActiveInterface('interface-1');
    state.setActiveTab('interface-1', 'tab-1');

    // Seed a table tile that other tiles will depend on by name
    state.initTile('tab-1', 'tile-table', {
      name: 'TableTile',
      type: 'Table',
      tabId: 'tab-1',
      tableTile: { tableType: 'logs' },
    } as any);

    // Seed a view tile that references the table tile via its table name
    state.initTile('tab-1', 'tile-view', {
      name: 'ViewTile',
      type: 'View',
      tabId: 'tab-1',
    } as any);
    state.updateTile('tile-view', { table: 'TableTile' } as any);

    // Seed a plot tile that references the table tile in its axes/group-by fields
    state.initTile('tab-1', 'tile-plot', {
      name: 'PlotTile',
      type: 'Plot',
      tabId: 'tab-1',
    } as any);
    state.updateTile('tile-plot', {
      plotTile: {
        xAxis: 'TableTile.value',
        yAxis: 'TableTile.other',
        plotGroupBy: 'TableTile.group',
      },
    } as any);

    // Sanity-check wiring before removal
    {
      const seeded = store.getState();
      expect(seeded.tilesById['tile-table']).toBeDefined();
      expect(seeded.tabsById['tab-1'].tileIds).toEqual(
        expect.arrayContaining(['tile-table', 'tile-view', 'tile-plot']),
      );
      expect(seeded.tabsById['tab-1'].tileNames).toEqual(
        expect.arrayContaining(['TableTile', 'ViewTile', 'PlotTile']),
      );
      expect(seeded.tilesById['tile-view'].table).toBe('TableTile');
      expect(seeded.tilesById['tile-plot'].plotTile?.xAxis).toBe('TableTile.value');
      expect(seeded.tilesById['tile-plot'].plotTile?.yAxis).toBe('TableTile.other');
      expect(seeded.tilesById['tile-plot'].plotTile?.plotGroupBy).toBe('TableTile.group');
    }

    // Act: remove the table tile from the tab
    state.removeTile('tab-1', 'tile-table');

    const next = store.getState();

    // The tile should be removed from tilesById
    expect(next.tilesById['tile-table']).toBeUndefined();

    // The parent tab should no longer reference the tile by id or name
    expect(next.tabsById['tab-1'].tileIds).not.toContain('tile-table');
    expect(next.tabsById['tab-1'].tileNames).not.toContain('TableTile');

    // Tiles that referenced the removed tile by name should have their references cleared
    expect(next.tilesById['tile-view'].table).toBeNull();
    expect(next.tilesById['tile-plot'].plotTile?.xAxis).toBeNull();
    expect(next.tilesById['tile-plot'].plotTile?.yAxis).toBeNull();
    expect(next.tilesById['tile-plot'].plotTile?.plotGroupBy).toBeNull();

    // Active project/interface/tab identifiers should remain valid
    expect(next.activeProjectId).toBe('project-1');
    expect(next.activeInterfaceId).toBe('interface-1');
    expect(next.activeTabId).toBe('tab-1');
  });

  it('pasteCopiedTile duplicates a tile and updates the tab', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {});
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });

    // Initialize a source tile with specific properties
    state.initTile('tab-1', 'tile-source', { 
      name: 'Source Tile', 
      type: 'Table',
      tabId: 'tab-1',
      filters: 'foo = bar'
    });

    // Perform paste
    state.pasteCopiedTile('tab-1', 'tile-source', 'tile-copy', { 
      name: 'Copied Tile' 
    });

    const next = store.getState();
    
    // Check new tile existence and properties
    const copiedTile = next.tilesById['tile-copy'];
    expect(copiedTile).toBeDefined();
    expect(copiedTile.name).toBe('Copied Tile');
    expect(copiedTile.type).toBe('Table');
    expect(copiedTile.filters).toBe('foo = bar'); // Should preserve properties
    expect(copiedTile.tabId).toBe('tab-1');

    // Check tab association
    const tab = next.tabsById['tab-1'];
    expect(tab.tileIds).toContain('tile-copy');
    expect(tab.tileNames).toContain('Copied Tile');
  });

  it('renameTile updates tile name and references in other tiles', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {});
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });

    // Create a table tile
    state.initTile('tab-1', 'tile-table', { 
      name: 'OldName', 
      type: 'Table',
      tabId: 'tab-1' 
    });

    // Create a plot tile that references OldName
    state.initTile('tab-1', 'tile-plot', { 
      name: 'Plot', 
      type: 'Plot',
      tabId: 'tab-1' 
    });
    state.updateTile('tile-plot', {
      plotTile: {
        xAxis: 'OldName.value'
      }
    } as any);

    // Rename the table tile
    state.renameTile('tab-1', 'tile-table', 'NewName');

    const next = store.getState();
    
    // Check tile name update
    expect(next.tilesById['tile-table'].name).toBe('NewName');
    
    // Check tab list update
    const tab = next.tabsById['tab-1'];
    expect(tab.tileNames).toContain('NewName');
    expect(tab.tileNames).not.toContain('OldName');

    // Check reference update in plot tile
    const plotTile = next.tilesById['tile-plot'];
    expect(plotTile.plotTile?.xAxis).toBe('NewName.value');
  });

  it('registerTileRefs tracks ref counts', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {});
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });
    state.initTile('tab-1', 'tile-1', { name: 'Tile 1' });

    // Initial state should be false
    expect(store.getState().hasTileRegisteredRefs('tile-1')).toBe(false);

    // Register
    store.getState().registerTileRefs('tile-1');
    expect(store.getState().hasTileRegisteredRefs('tile-1')).toBe(true);

    // Unregister
    store.getState().unregisterTileRefs('tile-1');
    expect(store.getState().hasTileRegisteredRefs('tile-1')).toBe(false);
  });
});
