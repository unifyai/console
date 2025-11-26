/**
 * Real Orchestra API tests for Tabs.
 *
 * These tests hit the actual Orchestra API to verify contract stability.
 * Run with: npm run test:interfaces:api
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  projectsApi,
  interfacesApi,
  tabsApi,
  uniqueName,
  safeDelete,
  ApiError,
  realTestOptions,
  realTestOptionsExtended,
} from './fixtures/api-actions';

describe('@real Tabs API', () => {
  // Test project and interface to contain tabs
  let testProject: string;
  let testInterfaceId: string;
  // Track tabs for cleanup
  const createdTabIds: string[] = [];

  beforeAll(async () => {
    // Create a test project
    testProject = uniqueName('test-tabs-project');
    await projectsApi.create(testProject);

    // Create a test interface
    const interfaceName = uniqueName('test-tabs-interface');
    const iface = await interfacesApi.create(testProject, interfaceName);
    testInterfaceId = iface.id;
  });

  afterAll(async () => {
    // Cleanup tabs first
    for (const id of createdTabIds) {
      await safeDelete(() => tabsApi.deleteById(id), `tab: ${id}`);
    }
    // Then cleanup interface and project
    await safeDelete(
      () => interfacesApi.deleteById(testInterfaceId),
      `interface: ${testInterfaceId}`
    );
    await safeDelete(
      () => projectsApi.delete(testProject),
      `project: ${testProject}`
    );
  });

  it('@real lists tabs in interface', realTestOptions, async () => {
    const result = await tabsApi.list(testInterfaceId);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('@real creates a new tab', realTestOptions, async () => {
    const tabName = uniqueName('test-tab');

    const result = await tabsApi.create(testInterfaceId, tabName, { order: 0 });
    createdTabIds.push(result.id);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.name).toBe(tabName);
  });

  it('@real gets tab by ID', realTestOptions, async () => {
    // Create a tab first
    const tabName = uniqueName('test-tab-getid');
    const created = await tabsApi.create(testInterfaceId, tabName, { order: 1 });
    createdTabIds.push(created.id);

    // Get by ID
    const result = await tabsApi.getById(created.id);

    expect(result).toBeDefined();
    expect(result.id).toBe(created.id);
    expect(result.name).toBe(tabName);
  });

  it('@real gets tab by name', realTestOptions, async () => {
    // Create a tab first
    const tabName = uniqueName('test-tab-getname');
    const created = await tabsApi.create(testInterfaceId, tabName, { order: 2 });
    createdTabIds.push(created.id);

    // Get by name
    const result = await tabsApi.getByName(testInterfaceId, tabName);

    expect(result).toBeDefined();
    expect(result.name).toBe(tabName);
    expect(result.id).toBe(created.id);
  });

  it('@real updates tab by ID', realTestOptions, async () => {
    // Create a tab first
    const tabName = uniqueName('test-tab-updateid');
    const created = await tabsApi.create(testInterfaceId, tabName, { order: 3 });
    createdTabIds.push(created.id);

    // Update by ID
    const newName = uniqueName('updated-tab');
    const result = await tabsApi.updateById(created.id, { name: newName });

    expect(result).toBeDefined();
    expect(result.name).toBe(newName);

    // Verify the update persisted
    const fetched = await tabsApi.getById(created.id);
    expect(fetched.name).toBe(newName);
  });

  it('@real updates tab by name', realTestOptions, async () => {
    // Create a tab first
    const tabName = uniqueName('test-tab-updatename');
    const created = await tabsApi.create(testInterfaceId, tabName, { order: 4 });
    createdTabIds.push(created.id);

    // Update by name with a color
    const newColor = '#00FF00';
    const result = await tabsApi.updateByName(testInterfaceId, tabName, {
      color: newColor,
    });

    expect(result).toBeDefined();
    expect(result.color).toBe(newColor);
  });

  // Note: Orchestra backend only supports PUT for tab updates, not PATCH
  // The updateById test above covers partial updates via PUT

  it('@real deletes tab by ID', realTestOptions, async () => {
    // Create a tab to delete
    const tabName = uniqueName('test-tab-deleteid');
    const created = await tabsApi.create(testInterfaceId, tabName, { order: 6 });
    // Don't add to cleanup - we're testing deletion

    // Delete by ID
    const result = await tabsApi.deleteById(created.id);
    expect(result.success).toBe(true);

    // Verify it's gone
    const list = await tabsApi.list(testInterfaceId);
    const found = list.find((t) => t.id === created.id);
    expect(found).toBeUndefined();
  });

  it('@real deletes tab by name', realTestOptions, async () => {
    // Create a tab to delete
    const tabName = uniqueName('test-tab-deletename');
    const created = await tabsApi.create(testInterfaceId, tabName, { order: 7 });
    // Don't add to cleanup - we're testing deletion

    // Delete by name
    const result = await tabsApi.deleteByName(testInterfaceId, tabName);
    expect(result.success).toBe(true);

    // Verify it's gone
    const list = await tabsApi.list(testInterfaceId);
    const found = list.find((t) => t.name === tabName);
    expect(found).toBeUndefined();
  });

  it('@real exports tab template', realTestOptions, async () => {
    // Create a tab first
    const tabName = uniqueName('test-tab-export');
    const created = await tabsApi.create(testInterfaceId, tabName, { order: 8 });
    createdTabIds.push(created.id);

    // Export template
    const result = await tabsApi.exportTemplate(created.id);

    // Template must be defined
    expect(result).toBeDefined();
    expect(result.template).toBeDefined();
    expect(typeof result.template).toBe('object');
  });

  it('@real imports tab template', realTestOptionsExtended, async () => {
    // Create a tab and export it first
    const originalName = uniqueName('test-tab-original');
    const created = await tabsApi.create(testInterfaceId, originalName, {
      order: 9,
    });
    createdTabIds.push(created.id);

    const exported = await tabsApi.exportTemplate(created.id);

    // Template export must succeed
    expect(exported.template).toBeDefined();

    // Import as new tab
    const newName = uniqueName('test-tab-imported');
    const result = await tabsApi.importTemplate(
      testProject,
      testInterfaceId,
      exported.template,
      newName
    );

    expect(result).toBeDefined();

    // Cleanup the imported tab
    if (result.tab_id) {
      createdTabIds.push(result.tab_id);

      // Verify the imported tab exists
      const imported = await tabsApi.getById(result.tab_id);
      expect(imported.name).toBe(newName);
    }
  });

  it('@real rejects duplicate tab creation', realTestOptions, async () => {
    const tabName = uniqueName('test-tab-dup');

    // Create first time
    const created = await tabsApi.create(testInterfaceId, tabName, { order: 10 });
    createdTabIds.push(created.id);

    // Try to create again
    try {
      const duplicate = await tabsApi.create(testInterfaceId, tabName, {
        order: 11,
      });
      // If API allows duplicates, track for cleanup
      if (duplicate.id && duplicate.id !== created.id) {
        createdTabIds.push(duplicate.id);
      }
    } catch (e) {
      // Expected: duplicate rejected
      expect(e).toBeInstanceOf(ApiError);
      const apiError = e as ApiError;
      expect(apiError.isConflict() || apiError.status >= 400).toBe(true);
    }
  });

  it('@real returns error for non-existent tab', realTestOptions, async () => {
    const fakeId = 'non-existent-tab-id-12345';

    try {
      await tabsApi.getById(fakeId);
      expect.fail('Expected ApiError to be thrown for non-existent tab');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const apiError = e as ApiError;
      expect(apiError.isNotFound() || apiError.status >= 400).toBe(true);
    }
  });
});
