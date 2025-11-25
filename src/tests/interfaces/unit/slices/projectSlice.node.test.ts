import { describe, it, expect } from 'vitest';
import { createStore, IStoreState } from '@/contexts/store';

const createTestStore = (initialState?: Partial<IStoreState>) =>
  createStore(initialState);

describe('projectSlice', () => {
  it('initProject creates a project and adds it to the projects list without duplicates', () => {
    const store = createTestStore();
    const state = store.getState();

    expect(state.projectsById).toEqual({});
    expect(state.projects).toEqual([]);

    state.initProject('project-1', { name: 'Project 1' });
    state.initProject('project-1', { name: 'Project 1 (ignored)' });

    const nextState = store.getState();
    expect(Object.keys(nextState.projectsById)).toEqual(['project-1']);
    expect(nextState.projectsById['project-1'].name).toBe('Project 1');
    expect(nextState.projects).toEqual(['project-1']);
  });

  it('setActiveProject updates activeProjectId and resets interface/tab when switching project', () => {
    const store = createTestStore();
    const state = store.getState();

    // Seed two projects
    state.initProject('project-1', { name: 'Project 1' });
    state.initProject('project-2', { name: 'Project 2' });

    // Set initial active state
    state.setActiveProject('project-1');
    // Simulate some active interface/tab
    store.setState({
      activeInterfaceId: 'interface-1',
      activeTabId: 'tab-1',
    });

    // Switch to a different project
    state.setActiveProject('project-2');

    const nextState = store.getState();
    expect(nextState.activeProjectId).toBe('project-2');
    // Switching to a different project should clear active interface/tab
    expect(nextState.activeInterfaceId).toBeNull();
    expect(nextState.activeTabId).toBeNull();
  });

  it('removeProject cascades removal of interfaces, tabs, tiles and clears active IDs', () => {
    const store = createTestStore();
    const state = store.getState();

    // Seed project, interface, tab, and tile via slice actions
    state.initProject('project-1', { name: 'Project 1' });
    state.initInterface('project-1', 'interface-1', { name: 'Interface 1' });
    state.initTab('interface-1', 'tab-1', { name: 'Tab 1' });
    state.initTile('tab-1', 'tile-1', { name: 'Tile 1', type: 'Table' });

    // Set actives to the seeded entities
    store.setState({
      activeProjectId: 'project-1',
      activeInterfaceId: 'interface-1',
      activeTabId: 'tab-1',
    });

    // Sanity check seed
    {
      const seeded = store.getState();
      expect(seeded.projectsById['project-1']).toBeDefined();
      expect(seeded.interfacesById['interface-1']).toBeDefined();
      expect(seeded.tabsById['tab-1']).toBeDefined();
      expect(seeded.tilesById['tile-1']).toBeDefined();
    }

    // Act: remove the project
    state.removeProject('project-1');

    const nextState = store.getState();

    // Project removed
    expect(nextState.projectsById['project-1']).toBeUndefined();
    expect(nextState.projects).not.toContain('project-1');

    // Interfaces/tabs/tiles cascaded
    expect(nextState.interfacesById['interface-1']).toBeUndefined();
    expect(nextState.tabsById['tab-1']).toBeUndefined();
    expect(nextState.tilesById['tile-1']).toBeUndefined();

    // Active IDs cleared
    expect(nextState.activeProjectId).toBeNull();
    expect(nextState.activeInterfaceId).toBeNull();
    expect(nextState.activeTabId).toBeNull();
  });
});


