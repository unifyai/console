import { describe, it, expect } from 'vitest';
import { createStore } from '@/contexts/store';

describe('interfaceSlice', () => {
  it('initInterface creates an interface and attaches it to the parent project', () => {
    const store = createStore();
    const state = store.getState();

    // No project => initInterface should be a no-op
    state.initInterface('missing-project', 'interface-x', { name: 'Should Not Exist' });
    expect(store.getState().interfacesById['interface-x']).toBeUndefined();

    // Seed a project and then initInterface
    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', { name: 'Interface 1' });

    const next = store.getState();
    expect(next.interfacesById['interface-1']).toBeDefined();
    expect(next.interfacesById['interface-1'].name).toBe('Interface 1');

    const project = next.projectsById['project-1'];
    expect(project).toBeDefined();
    expect(project.interfaceIds).toContain('interface-1');
  });

  it('removeInterface cascades tabs and tiles and removes interface from project', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', { name: 'Interface 1' });
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });
    state.initTile('tab-1', 'tile-1', { name: 'Tile 1', type: 'Table' });

    // Set actives
    store.setState({
      activeInterfaceId: 'interface-1',
      activeTabId: 'tab-1',
    });

    // Sanity check
    {
      const seeded = store.getState();
      expect(seeded.interfacesById['interface-1']).toBeDefined();
      expect(seeded.tabsById['tab-1']).toBeDefined();
      expect(seeded.tilesById['tile-1']).toBeDefined();
      expect(seeded.projectsById['project-1'].interfaceIds).toContain('interface-1');
    }

    // Act
    state.removeInterface('project-1', 'interface-1');

    const next = store.getState();

    // Interface removed
    expect(next.interfacesById['interface-1']).toBeUndefined();

    // Tabs/tiles cascaded
    expect(next.tabsById['tab-1']).toBeUndefined();
    expect(next.tilesById['tile-1']).toBeUndefined();

    // Project interfaceIds updated
    expect(next.projectsById['project-1'].interfaceIds).not.toContain('interface-1');

    // Active IDs cleared
    expect(next.activeInterfaceId).toBeNull();
    expect(next.activeTabId).toBeNull();
  });

  it('setActiveInterface clears activeTabId when changing active interface', () => {
    const store = createStore();
    const state = store.getState();

    store.setState({
      activeInterfaceId: 'interface-1',
      activeTabId: 'tab-1',
    });

    state.setActiveInterface('interface-2');

    const next = store.getState();
    expect(next.activeInterfaceId).toBe('interface-2');
    expect(next.activeTabId).toBeNull();
  });

  it('updateInterface updates existing interface properties', () => {
    const store = createStore();
    const state = store.getState();

    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', { name: 'Old Name' });

    store.getState().updateInterface('interface-1', { name: 'New Name' });

    const next = store.getState();
    expect(next.interfacesById['interface-1'].name).toBe('New Name');
  });
});


