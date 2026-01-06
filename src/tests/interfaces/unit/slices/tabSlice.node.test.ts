import { describe, it, expect } from 'vitest';
import { createStore } from '@/contexts/store';

describe('tabSlice', () => {
  it('initTab creates a tab and wires it into the parent interface tabIds/tabNames', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {
      name: 'Interface 1',
      tabIds: [],
      tabNames: [],
    });

    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });

    const next = store.getState();
    const tab = next.tabsById['tab-1'];
    expect(tab).toBeDefined();
    expect(tab.name).toBe('Tab 1');

    const iface = next.interfacesById['interface-1'];
    expect(iface.tabIds).toContain('tab-1');
    expect(iface.tabNames).toContain('Tab 1');
  });

  it('setActiveTab updates global activeTabId, interface.activeTabId and per-tab active flags', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {
      name: 'Interface 1',
      tabIds: [],
      tabNames: [],
    });

    state.initTab('interface-1', 'tab-1', { name: 'Tab 1', active: false });
    state.initTab('interface-1', 'tab-2', { name: 'Tab 2', active: false });

    state.setActiveTab('interface-1', 'tab-2');

    const next = store.getState();

    // Global active tab
    expect(next.activeTabId).toBe('tab-2');

    // Interface active tab
    expect(next.interfacesById['interface-1'].activeTabId).toBe('tab-2');

    // Per-tab active flags: only tab-2 should be active
    expect(next.tabsById['tab-2'].active).toBe(true);
    expect(next.tabsById['tab-1'].active).toBe(false);
  });

  it('addTab creates a new active tab via sliceUtils.addTab and updates interface wiring', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {
      name: 'Interface 1',
      tabIds: [],
      tabNames: [],
    });

    // Seed an existing active tab
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1', active: true });

    // addTab relies on initialState.id being set
    state.addTab('interface-1', 'Tab 2', { id: 'tab-2' } as any);

    const next = store.getState();

    // New tab exists and is active
    const newTab = next.tabsById['tab-2'];
    expect(newTab).toBeDefined();
    expect(newTab.active).toBe(true);

    // Old tab should be inactive
    expect(next.tabsById['tab-1'].active).toBe(false);

    // Interface wiring: tabIds/tabNames and activeTabId should include the new tab
    const iface = next.interfacesById['interface-1'];
    expect(iface.tabIds).toContain('tab-2');
    expect(iface.tabNames).toContain('Tab 2');
    expect(iface.activeTabId).toBe('tab-2');

    // Global activeTabId should be updated as well
    expect(next.activeTabId).toBe('tab-2');
  });

  it('renameTab updates the tab name and keeps interface.tabNames in sync', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', {
      name: 'Interface 1',
      tabIds: [],
      tabNames: [],
    });

    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });

    // Sanity check initial wiring
    {
      const seeded = store.getState();
      expect(seeded.tabsById['tab-1'].name).toBe('Tab 1');
      expect(seeded.interfacesById['interface-1'].tabNames).toEqual(['Tab 1']);
    }

    // Rename the tab by name
    state.renameTab('interface-1', 'Tab 1', 'Renamed Tab');

    const next = store.getState();

    // Tab object name updated
    expect(next.tabsById['tab-1'].name).toBe('Renamed Tab');

    // Interface tabNames array updated in place
    expect(next.interfacesById['interface-1'].tabNames).toEqual(['Renamed Tab']);

    // tabIds remain unchanged
    expect(next.interfacesById['interface-1'].tabIds).toEqual(['tab-1']);
  });
});


