/**
 * Real Orchestra API tests for Interfaces.
 *
 * These tests hit the actual Orchestra API to verify contract stability.
 * Run with: npm run test:interfaces:api
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  projectsApi,
  interfacesApi,
  uniqueName,
  safeDelete,
  ApiError,
  realTestOptions,
  realTestOptionsExtended,
} from './fixtures/api-actions';

describe('@real Interfaces API', () => {
  // Test project to contain interfaces
  let testProject: string;
  // Track interfaces for cleanup
  const createdInterfaceIds: string[] = [];

  beforeAll(async () => {
    // Create a test project
    testProject = uniqueName('test-iface-project');
    await projectsApi.create(testProject);
  });

  afterAll(async () => {
    // Cleanup interfaces first
    for (const id of createdInterfaceIds) {
      await safeDelete(() => interfacesApi.deleteById(id), `interface: ${id}`);
    }
    // Then cleanup project
    await safeDelete(() => projectsApi.delete(testProject), `project: ${testProject}`);
  });

  it('@real lists interfaces in project', realTestOptions, async () => {
    const result = await interfacesApi.list(testProject);

    // Orchestra returns array directly
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('@real creates a new interface', realTestOptions, async () => {
    const interfaceName = uniqueName('test-interface');

    const result = await interfacesApi.create(testProject, interfaceName);
    createdInterfaceIds.push(result.id);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.name).toBe(interfaceName);
  });

  it('@real gets interface by ID', realTestOptions, async () => {
    // Create an interface first
    const interfaceName = uniqueName('test-interface-getid');
    const created = await interfacesApi.create(testProject, interfaceName);
    createdInterfaceIds.push(created.id);

    // Get by ID
    const result = await interfacesApi.getById(created.id);

    expect(result).toBeDefined();
    expect(result.id).toBe(created.id);
    expect(result.name).toBe(interfaceName);
  });

  it('@real gets interface by name', realTestOptions, async () => {
    // Create an interface first
    const interfaceName = uniqueName('test-interface-getname');
    const created = await interfacesApi.create(testProject, interfaceName);
    createdInterfaceIds.push(created.id);

    // Get by name
    const result = await interfacesApi.getByName(testProject, interfaceName);

    expect(result).toBeDefined();
    expect(result.name).toBe(interfaceName);
    expect(result.id).toBe(created.id);
  });

  it('@real updates interface by ID', realTestOptions, async () => {
    // Create an interface first
    const interfaceName = uniqueName('test-interface-updateid');
    const created = await interfacesApi.create(testProject, interfaceName);
    createdInterfaceIds.push(created.id);

    // Update by ID
    const newName = uniqueName('updated-interface');
    const result = await interfacesApi.updateById(created.id, { name: newName });

    expect(result).toBeDefined();
    expect(result.name).toBe(newName);

    // Verify the update persisted
    const fetched = await interfacesApi.getById(created.id);
    expect(fetched.name).toBe(newName);
  });

  it('@real updates interface by name', realTestOptions, async () => {
    // Create an interface first
    const interfaceName = uniqueName('test-interface-updatename');
    const created = await interfacesApi.create(testProject, interfaceName);
    createdInterfaceIds.push(created.id);

    // Update by name with a color
    const newColor = '#FF0000';
    const result = await interfacesApi.updateByName(testProject, interfaceName, {
      color: newColor,
    });

    expect(result).toBeDefined();
    // Verify the color was updated
    expect(result.color).toBe(newColor);
  });

  it('@real deletes interface by ID', realTestOptions, async () => {
    // Create an interface to delete
    const interfaceName = uniqueName('test-interface-deleteid');
    const created = await interfacesApi.create(testProject, interfaceName);
    // Don't add to cleanup - we're testing deletion

    // Delete by ID
    const result = await interfacesApi.deleteById(created.id);
    expect(result.success).toBe(true);

    // Verify it's gone
    const list = await interfacesApi.list(testProject);
    const found = list.find((i) => i.id === created.id);
    expect(found).toBeUndefined();
  });

  it('@real deletes interface by name', realTestOptions, async () => {
    // Create an interface to delete
    const interfaceName = uniqueName('test-interface-deletename');
    const created = await interfacesApi.create(testProject, interfaceName);
    // Don't add to cleanup - we're testing deletion

    // Delete by name
    const result = await interfacesApi.deleteByName(testProject, interfaceName);
    expect(result.success).toBe(true);

    // Verify it's gone
    const list = await interfacesApi.list(testProject);
    const found = list.find((i) => i.name === interfaceName);
    expect(found).toBeUndefined();
  });

  it('@real creates interface checkpoint', realTestOptions, async () => {
    // Create an interface first
    const interfaceName = uniqueName('test-interface-checkpoint');
    const created = await interfacesApi.create(testProject, interfaceName);
    createdInterfaceIds.push(created.id);

    // Create checkpoint
    const description = 'Test checkpoint description';
    const result = await interfacesApi.createCheckpoint(created.id, description);

    expect(result).toBeDefined();
    // Checkpoint should have been created successfully (no ApiError thrown)
  });

  it('@real gets interface checkpoint', realTestOptions, async () => {
    // Create an interface and checkpoint first
    const interfaceName = uniqueName('test-interface-getcheckpoint');
    const created = await interfacesApi.create(testProject, interfaceName);
    createdInterfaceIds.push(created.id);

    const checkpointDesc = 'Checkpoint to retrieve';
    await interfacesApi.createCheckpoint(created.id, checkpointDesc);

    // Get checkpoint
    const result = await interfacesApi.getCheckpoint(created.id);

    expect(result).toBeDefined();
  });

  it('@real exports interface template', realTestOptions, async () => {
    // Create an interface first
    const interfaceName = uniqueName('test-interface-export');
    const created = await interfacesApi.create(testProject, interfaceName);
    createdInterfaceIds.push(created.id);

    // Export template
    const result = await interfacesApi.exportTemplate(created.id);

    // Template must be defined - fail explicitly if not
    expect(result).toBeDefined();
    expect(result.template).toBeDefined();
    expect(typeof result.template).toBe('object');
  });

  it('@real imports interface template', realTestOptionsExtended, async () => {
    // Create an interface and export it first
    const originalName = uniqueName('test-interface-original');
    const created = await interfacesApi.create(testProject, originalName);
    createdInterfaceIds.push(created.id);

    const exported = await interfacesApi.exportTemplate(created.id);

    // Template export must succeed for import test to be valid
    expect(exported.template).toBeDefined();

    // Import as new interface
    const newName = uniqueName('test-interface-imported');
    const result = await interfacesApi.importTemplate(testProject, exported.template, newName);

    expect(result).toBeDefined();

    // Cleanup the imported interface
    if (result.interfaceId) {
      createdInterfaceIds.push(result.interfaceId);

      // Verify the imported interface exists
      const imported = await interfacesApi.getById(result.interfaceId);
      expect(imported.name).toBe(newName);
    }
  });

  it('@real returns error for non-existent interface', realTestOptions, async () => {
    const fakeId = 'non-existent-interface-id-12345';

    try {
      await interfacesApi.getById(fakeId);
      expect.fail('Expected ApiError to be thrown for non-existent interface');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const apiError = e as ApiError;
      expect(apiError.isNotFound() || apiError.status >= 400).toBe(true);
    }
  });

  it('@real returns camelCase response properties for interface list', realTestOptions, async () => {
    const result = await interfacesApi.list(testProject);

    // Verify we get camelCase, not snake_case
    expect(Array.isArray(result)).toBe(true);

    // If there are interfaces, check their properties are camelCase
    if (result.length > 0) {
      const iface = result[0];
      // Should have camelCase keys
      expect(iface).toHaveProperty('id');
      expect(iface).toHaveProperty('name');
      // Should NOT have snake_case keys
      expect(iface).not.toHaveProperty('project_id');
      expect(iface).not.toHaveProperty('created_at');
      expect(iface).not.toHaveProperty('updated_at');
    }
  });

  it('@real returns camelCase response properties for interface create', realTestOptions, async () => {
    const interfaceName = uniqueName('test-interface-casing');

    const result = await interfacesApi.create(testProject, interfaceName);
    createdInterfaceIds.push(result.id);

    // Should have camelCase keys
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('name');
    // Should NOT have snake_case keys
    expect(result).not.toHaveProperty('project_id');
    expect(result).not.toHaveProperty('project_name');
    expect(result).not.toHaveProperty('created_at');
    expect(result).not.toHaveProperty('updated_at');
  });

  it('@real returns camelCase response properties for interface get', realTestOptions, async () => {
    const interfaceName = uniqueName('test-interface-casing-get');
    const created = await interfacesApi.create(testProject, interfaceName);
    createdInterfaceIds.push(created.id);

    const result = await interfacesApi.getById(created.id);

    // Should have camelCase keys
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('name');
    // Should NOT have snake_case keys
    expect(result).not.toHaveProperty('project_id');
    expect(result).not.toHaveProperty('project_name');
    expect(result).not.toHaveProperty('created_at');
    expect(result).not.toHaveProperty('updated_at');
  });
});
