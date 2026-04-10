import { describe, it, expect } from 'vitest';
import { createStore } from '@/contexts/store';

describe('contextsSlice', () => {
  it('setContextOptimistic updates specific scope contexts and syncs with other slices', () => {
    const store = createStore();
    const state = store.getState();

    // Initialize hierarchy properly so write-through works
    state.initProject('proj-1', { name: 'Project 1' });
    state.initInterface('proj-1', 'iface-1', { name: 'Interface 1', tabIds: [], tabNames: [] });
    state.initTab('iface-1', 'tab-1', { name: 'Tab 1' });
    state.initTile('tab-1', 'tile-1', { name: 'Tile 1', type: 'Table', tabId: 'tab-1' });

    // Act: Set Tab Context
    state.setContextOptimistic('tab', 'tab-1', 'ctx-A');

    const next = store.getState();
    expect(next.tabContexts['tab-1']).toBe('ctx-A');
    // Check write-through to tab slice
    expect(next.tabsById['tab-1'].globalContext).toBe('ctx-A');

    // Act: Set Tile Context
    state.setContextOptimistic('tile', 'tile-1', 'ctx-B');

    const next2 = store.getState();
    expect(next2.tileContexts['tile-1']).toBe('ctx-B');
    // Check write-through to tile slice
    expect(next2.tilesById['tile-1'].context).toBe('ctx-B');
  });

  it('renameProjectContext updates all occurrences of the context name', () => {
    const store = createStore();
    const state = store.getState();

    // Setup hierarchy
    state.initProject('proj-1', { name: 'P1' });
    state.initInterface('proj-1', 'iface-1', { name: 'I1', tabIds: [], tabNames: [] });
    state.initTab('iface-1', 'tab-1', { name: 'T1', globalContext: 'old-ctx' });
    state.initTile('tab-1', 'tile-1', {
      name: 'Tile 1',
      type: 'Table',
      context: 'old-ctx',
      tabId: 'tab-1',
    });

    // Note: initTab automatically adds tab to interface, so we don't need to manually populate tabIds in initInterface
    // BUT if we provided them manually in initInterface, we might have duplicates or inconsistencies if not careful.
    // Standard init flow: initProject -> initInterface -> initTab.

    // Set initial context maps
    state.setProjectContexts('proj-1', ['old-ctx', 'other']);
    state.setContextOptimistic('tab', 'tab-1', 'old-ctx');
    state.setContextOptimistic('tile', 'tile-1', 'old-ctx');
    state.setContextOptimistic('interface', 'iface-1', 'old-ctx');

    // Act
    state.renameProjectContext('proj-1', 'old-ctx', 'new-ctx');

    const next = store.getState();
    // Project contexts list
    expect(next.projectContexts['proj-1']).toContain('new-ctx');
    expect(next.projectContexts['proj-1']).not.toContain('old-ctx');

    // Context maps
    expect(next.interfaceContexts['iface-1']).toBe('new-ctx');
    expect(next.tabContexts['tab-1']).toBe('new-ctx');
    expect(next.tileContexts['tile-1']).toBe('new-ctx');

    // Slices
    expect(next.tabsById['tab-1'].globalContext).toBe('new-ctx');
    expect(next.tilesById['tile-1'].context).toBe('new-ctx');
  });

  it('deleteProjectContext removes the context from all maps and slices', () => {
    const store = createStore();
    const state = store.getState();

    // Setup
    state.initProject('proj-1', { name: 'P1' });
    state.initInterface('proj-1', 'iface-1', { name: 'I1', tabIds: [], tabNames: [] });
    state.initTab('iface-1', 'tab-1', { name: 'T1', globalContext: 'ctx-A' });
    state.initTile('tab-1', 'tile-1', {
      name: 'Tile 1',
      type: 'Table',
      context: 'ctx-A',
      tabId: 'tab-1',
    });

    state.setProjectContexts('proj-1', ['ctx-A', 'ctx-B']);
    state.setContextOptimistic('tab', 'tab-1', 'ctx-A');
    state.setContextOptimistic('tile', 'tile-1', 'ctx-A');

    // Act
    state.deleteProjectContext('proj-1', 'ctx-A');

    const next = store.getState();
    // Project contexts list
    expect(next.projectContexts['proj-1']).toEqual(['ctx-B']);

    // Context maps should be nullified
    expect(next.tabContexts['tab-1']).toBeNull();
    expect(next.tileContexts['tile-1']).toBeNull();

    // Slices should be cleared
    expect(next.tabsById['tab-1'].globalContext).toBeUndefined();
    expect(next.tilesById['tile-1'].context).toBeUndefined();
  });

  it('getEffectiveContext resolves context from tile -> tab -> interface', () => {
    const store = createStore();
    const state = store.getState();

    state.setContextOptimistic('interface', 'iface-1', 'ctx-I');
    state.setContextOptimistic('tab', 'tab-1', 'ctx-T');
    state.setContextOptimistic('tile', 'tile-1', 'ctx-t');
    state.setContextOptimistic('tile', 'tile-empty', ''); // empty string becomes null in setContextOptimistic

    // 1. Tile specific overrides everything
    expect(state.getEffectiveContext('tile-1', 'tab-1', 'iface-1')).toBe('ctx-t');

    // 2. Tab context fallback
    // For tile-empty, if we didn't set it explicitly to something, it should fallback.
    // Let's check behavior if tile has NO context set.
    expect(state.getEffectiveContext('tile-none', 'tab-1', 'iface-1')).toBe('ctx-T');

    // 3. Interface fallback
    expect(state.getEffectiveContext(null, 'tab-none', 'iface-1')).toBe('ctx-I');
  });
});
