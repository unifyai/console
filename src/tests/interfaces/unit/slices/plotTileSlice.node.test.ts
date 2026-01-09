import { describe, it, expect } from 'vitest';
import { createStore } from '@/contexts/store';

describe('plotTileSlice', () => {
  it('initPlotTile initializes plot-specific data', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', { name: 'Interface 1', tabIds: [], tabNames: [] });
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });
    state.initTile('tab-1', 'plot-1', { name: 'My Plot', type: 'Plot' });

    // Act
    state.initPlotTile('plot-1', { xAxis: 'col1' });

    const next = store.getState();
    const tile = next.tilesById['plot-1'];
    expect(tile.plotTile).toBeDefined();
    expect(tile.plotTile?.xAxis).toBe('col1');
    expect(tile.type).toBe('Plot');
  });

  it('updatePlotTile updates data and sets itemsNeedRecompute for data-affecting props', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', { name: 'Interface 1', tabIds: [], tabNames: [] });
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });
    state.initTile('tab-1', 'plot-1', { name: 'My Plot', type: 'Plot', tabId: 'tab-1' });
    state.initPlotTile('plot-1', { xAxis: 'col1' });

    // Initial check
    expect(store.getState().tilesById['plot-1'].itemsNeedRecompute).toBeFalsy();

    // Act
    state.updatePlotTile('plot-1', { yAxis: 'col2' });

    const next = store.getState();
    const tile = next.tilesById['plot-1'];
    expect(tile.plotTile?.yAxis).toBe('col2');
    expect(tile.itemsNeedRecompute).toBe(true);
    expect(next.tabsById['tab-1'].itemsNeedRecompute).toBe(true);
  });

  it('updatePlotTile ignores updates if values are unchanged', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', { name: 'Interface 1', tabIds: [], tabNames: [] });
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });
    state.initTile('tab-1', 'plot-1', { name: 'My Plot', type: 'Plot', tabId: 'tab-1' });
    state.initPlotTile('plot-1', { xAxis: 'col1' });

    // Force recompute flag to false manually if it was true (though it starts false)
    // (Not easily accessible via public API, so we rely on checking if it STAYS false)
    
    // Act: update with same value
    state.updatePlotTile('plot-1', { xAxis: 'col1' });

    const next = store.getState();
    // Should not have triggered recompute because nothing changed
    expect(next.tilesById['plot-1'].itemsNeedRecompute).toBeFalsy();
  });
});

