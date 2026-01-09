/**
 * Real Orchestra API tests for Tiles.
 *
 * These tests hit the actual Orchestra API to verify contract stability.
 * Run with: npm run test:interfaces:api
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  projectsApi,
  interfacesApi,
  tabsApi,
  tilesApi,
  uniqueName,
  safeDelete,
  ApiError,
  realTestOptions,
  realTestOptionsExtended,
  TilePosition,
} from './fixtures/api-actions';

describe('@real Tiles API', () => {
  // Test project, interface, and tab to contain tiles
  let testProject: string;
  let testInterfaceId: string;
  let testTabId: string;
  // Track tiles for cleanup
  const createdTileIds: string[] = [];

  const defaultPosition: TilePosition = { x: 0, y: 0, width: 4, height: 4 };

  beforeAll(async () => {
    // Create a test project
    testProject = uniqueName('test-tiles-project');
    await projectsApi.create(testProject);

    // Create a test interface
    const interfaceName = uniqueName('test-tiles-interface');
    const iface = await interfacesApi.create(testProject, interfaceName);
    testInterfaceId = iface.id;

    // Create a test tab
    const tabName = uniqueName('test-tiles-tab');
    const tab = await tabsApi.create(testInterfaceId, tabName, { order: 0 });
    testTabId = tab.id;
  });

  afterAll(async () => {
    // Cleanup tiles first
    for (const id of createdTileIds) {
      await safeDelete(() => tilesApi.deleteById(id), `tile: ${id}`);
    }
    // Then cleanup tab, interface, and project
    await safeDelete(() => tabsApi.deleteById(testTabId), `tab: ${testTabId}`);
    await safeDelete(
      () => interfacesApi.deleteById(testInterfaceId),
      `interface: ${testInterfaceId}`
    );
    await safeDelete(
      () => projectsApi.delete(testProject),
      `project: ${testProject}`
    );
  });

  it('@real lists tiles in tab', realTestOptions, async () => {
    const result = await tilesApi.list(testTabId);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('@real lists tiles by type', realTestOptions, async () => {
    // Create a Table tile first
    const tileName = uniqueName('test-tile-type');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    createdTileIds.push(created.id);

    // List by type
    const result = await tilesApi.list(testTabId, 'Table');

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Should include our created tile
    const found = result.find((t) => t.id === created.id);
    expect(found).toBeDefined();
  });

  it('@real creates a new tile', realTestOptions, async () => {
    const tileName = uniqueName('test-tile');

    const result = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    createdTileIds.push(result.id);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.name).toBe(tileName);
  });

  it('@real gets tile by ID', realTestOptions, async () => {
    // Create a tile first
    const tileName = uniqueName('test-tile-getid');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    createdTileIds.push(created.id);

    // Get by ID
    const result = await tilesApi.getById(created.id);

    expect(result).toBeDefined();
    expect(result.id).toBe(created.id);
    expect(result.name).toBe(tileName);
  });

  it('@real gets tile by name', realTestOptions, async () => {
    // Create a tile first
    const tileName = uniqueName('test-tile-getname');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    createdTileIds.push(created.id);

    // Get by name
    const result = await tilesApi.getByName(testTabId, tileName);

    expect(result).toBeDefined();
    expect(result.name).toBe(tileName);
    expect(result.id).toBe(created.id);
  });

  it('@real updates tile by ID', realTestOptions, async () => {
    // Create a tile first
    const tileName = uniqueName('test-tile-updateid');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    createdTileIds.push(created.id);

    // Update by ID
    const newName = uniqueName('updated-tile');
    const result = await tilesApi.updateById(created.id, { name: newName });

    expect(result).toBeDefined();
    expect(result.name).toBe(newName);

    // Verify the update persisted
    const fetched = await tilesApi.getById(created.id);
    expect(fetched.name).toBe(newName);
  });

  it('@real updates tile by name', realTestOptions, async () => {
    // Create a tile first
    const tileName = uniqueName('test-tile-updatename');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    createdTileIds.push(created.id);

    // Update by name - toggle visibility
    const result = await tilesApi.updateByName(testTabId, tileName, {
      visible: false,
    });

    expect(result).toBeDefined();
    expect(result.visible).toBe(false);
  });

  it('@real patches tile by ID', realTestOptions, async () => {
    // Create a tile first
    const tileName = uniqueName('test-tile-patchid');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    createdTileIds.push(created.id);

    // Patch by ID - update position
    const newPosition: TilePosition = { x: 2, y: 2, width: 6, height: 6 };
    const result = await tilesApi.patchById(created.id, {
      position: newPosition,
    });

    expect(result).toBeDefined();

    // Verify the patch applied
    const fetched = await tilesApi.getById(created.id);
    expect(fetched.position).toEqual(newPosition);
  });

  it('@real patches specialized tile (Table)', realTestOptions, async () => {
    // Create a Table tile first
    const tileName = uniqueName('test-tile-table');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    createdTileIds.push(created.id);

    // Patch specialized Table data
    const result = await tilesApi.patchSpecialized(created.id, 'Table', {
      tableType: 'logs',
      limit: 50,
    });

    expect(result).toBeDefined();
    // Specialized patch succeeded (no error thrown)
  });

  it('@real patches specialized tile (Plot)', realTestOptions, async () => {
    // Create a Plot tile first
    const tileName = uniqueName('test-tile-plot');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Plot',
    });
    createdTileIds.push(created.id);

    // Patch specialized Plot data
    const result = await tilesApi.patchSpecialized(created.id, 'Plot', {
      plotType: 'scatter',
      xAxis: 'time',
    });

    expect(result).toBeDefined();
    // Specialized patch succeeded (no error thrown)
  });

  it('@real deletes tile by ID', realTestOptions, async () => {
    // Create a tile to delete
    const tileName = uniqueName('test-tile-deleteid');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    // Don't add to cleanup - we're testing deletion

    // Delete by ID
    const result = await tilesApi.deleteById(created.id);
    expect(result.success).toBe(true);

    // Verify it's gone
    const list = await tilesApi.list(testTabId);
    const found = list.find((t) => t.id === created.id);
    expect(found).toBeUndefined();
  });

  it('@real deletes tile by name', realTestOptions, async () => {
    // Create a tile to delete
    const tileName = uniqueName('test-tile-deletename');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    // Don't add to cleanup - we're testing deletion

    // Delete by name
    const result = await tilesApi.deleteByName(testTabId, tileName);
    expect(result.success).toBe(true);

    // Verify it's gone
    const list = await tilesApi.list(testTabId);
    const found = list.find((t) => t.name === tileName);
    expect(found).toBeUndefined();
  });

  it('@real exports tile template', realTestOptions, async () => {
    // Create a tile first
    const tileName = uniqueName('test-tile-export');
    const created = await tilesApi.create(testTabId, tileName, defaultPosition, {
      type: 'Table',
    });
    createdTileIds.push(created.id);

    // Export template
    const result = await tilesApi.exportTemplate(created.id);

    // Template must be defined
    expect(result).toBeDefined();
    expect(result.template).toBeDefined();
    expect(typeof result.template).toBe('object');
  });

  it('@real imports tile template', realTestOptionsExtended, async () => {
    // Create a tile and export it first
    const originalName = uniqueName('test-tile-original');
    const created = await tilesApi.create(
      testTabId,
      originalName,
      defaultPosition,
      { type: 'Table' }
    );
    createdTileIds.push(created.id);

    const exported = await tilesApi.exportTemplate(created.id);

    // Template export must succeed
    expect(exported.template).toBeDefined();

    // Import as new tile
    const newName = uniqueName('test-tile-imported');
    const result = await tilesApi.importTemplate(
      testProject,
      testTabId,
      exported.template,
      newName
    );

    expect(result).toBeDefined();

    // Cleanup the imported tile
    if (result.tileId) {
      createdTileIds.push(result.tileId);

      // Verify the imported tile exists
      const imported = await tilesApi.getById(result.tileId);
      expect(imported.name).toBe(newName);
    }
  });

  it('@real returns error for non-existent tile', realTestOptions, async () => {
    const fakeId = 'non-existent-tile-id-12345';

    try {
      await tilesApi.getById(fakeId);
      expect.fail('Expected ApiError to be thrown for non-existent tile');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const apiError = e as ApiError;
      expect(apiError.isNotFound() || apiError.status >= 400).toBe(true);
    }
  });
});
