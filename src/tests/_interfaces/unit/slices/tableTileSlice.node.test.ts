import { describe, it, expect } from 'vitest';
import { createStore } from '@/contexts/store';

describe('tableTileSlice', () => {
  it('initTableTile initializes table-specific data', () => {
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

    // Act
    state.initTableTile('tile-1', { limit: 50 });

    const next = store.getState();
    const tile = next.tilesById['tile-1'];
    expect(tile.tableTile).toBeDefined();
    expect(tile.tableTile?.limit).toBe(50);
  });

  it('updateTableTile updates data and sets itemsNeedRecompute for data-affecting props', () => {
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
    state.initTableTile('tile-1', { limit: 20, sorting: null });

    // Initial check
    expect(store.getState().tilesById['tile-1'].itemsNeedRecompute).toBeFalsy();

    // Act: update sorting (affects data)
    state.updateTableTile('tile-1', { sorting: 'timestamp@desc' });

    const next = store.getState();
    const tile = next.tilesById['tile-1'];
    expect(tile.tableTile?.sorting).toBe('timestamp@desc');
    expect(tile.itemsNeedRecompute).toBe(true);
    expect(next.tabsById['tab-1'].itemsNeedRecompute).toBe(true);
  });

  it('updateTableTile updates data but NOT itemsNeedRecompute for non-data-affecting props', () => {
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
    state.initTableTile('tile-1', { limit: 20 });

    const next = store.getState();
    // offset is not in TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS, so it shouldn't trigger recompute
    expect(next.tilesById['tile-1'].tableTile?.offset).toBe(0); // Default
    state.updateTableTile('tile-1', { offset: 10 });

    const next2 = store.getState();
    expect(next2.tilesById['tile-1'].tableTile?.offset).toBe(10);
    expect(next2.tilesById['tile-1'].itemsNeedRecompute).toBe(false);
  });

  it('manages infinite query keys', () => {
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
    state.initTableTile('tile-1', {});

    // Add key
    state.addInfiniteQueryKey('tile-1', 'key-1');
    let next = store.getState();
    expect(next.tilesById['tile-1'].tableTile?.infiniteQueryKeys).toContain('key-1');

    // Add duplicate (should not duplicate)
    state.addInfiniteQueryKey('tile-1', 'key-1');
    next = store.getState();
    expect(next.tilesById['tile-1'].tableTile?.infiniteQueryKeys).toHaveLength(1);

    // Add another
    state.addInfiniteQueryKey('tile-1', 'key-2');
    next = store.getState();
    expect(next.tilesById['tile-1'].tableTile?.infiniteQueryKeys).toHaveLength(2);

    // Remove
    state.removeInfiniteQueryKey('tile-1', 'key-1');
    next = store.getState();
    expect(next.tilesById['tile-1'].tableTile?.infiniteQueryKeys).not.toContain('key-1');
    expect(next.tilesById['tile-1'].tableTile?.infiniteQueryKeys).toContain('key-2');

    // Clear all
    state.clearAllInfiniteQueryKeys('tile-1');
    next = store.getState();
    expect(next.tilesById['tile-1'].tableTile?.infiniteQueryKeys).toHaveLength(0);
  });
});
