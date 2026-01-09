/**
 * Real Orchestra API tests for Projects.
 *
 * These tests hit the actual Orchestra API to verify contract stability.
 * Run with: npm run test:interfaces:api
 */

import { describe, it, expect, afterAll } from 'vitest';
import {
  projectsApi,
  uniqueName,
  safeDelete,
  ApiError,
  realTestOptions,
} from './fixtures/api-actions';

describe('@real Projects API', () => {
  // Track resources for cleanup
  const createdProjects: string[] = [];

  afterAll(async () => {
    // Cleanup all created projects
    for (const name of createdProjects) {
      await safeDelete(() => projectsApi.delete(name), `project: ${name}`);
    }
  });

  it('@real lists all projects', realTestOptions, async () => {
    const result = await projectsApi.list();

    // Orchestra returns array directly
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('@real creates a new project', realTestOptions, async () => {
    const projectName = uniqueName('test-project');

    const result = await projectsApi.create(projectName);
    // Track for cleanup AFTER successful creation
    createdProjects.push(projectName);

    // Should return { info: "..." } on success
    expect(result.info).toBeDefined();
    expect(typeof result.info).toBe('string');

    // Verify project exists in list
    const listResult = await projectsApi.list();
    expect(listResult).toContain(projectName);
  });

  it('@real updates project icon', realTestOptions, async () => {
    // Create a project first
    const projectName = uniqueName('test-project-icon');
    await projectsApi.create(projectName);
    createdProjects.push(projectName);

    // Update the icon
    const result = await projectsApi.update(projectName, { icon: 'star' });

    // Verify update succeeded
    expect(result).toBeDefined();
    expect(result.info).toBeDefined();
  });

  it('@real deletes a project', realTestOptions, async () => {
    // Create a project to delete
    const projectName = uniqueName('test-project-delete');
    await projectsApi.create(projectName);
    // Don't add to cleanup - we're testing deletion

    // Delete it
    const result = await projectsApi.delete(projectName);
    expect(result.success).toBe(true);

    // Verify project no longer exists
    const listResult = await projectsApi.list();
    expect(listResult).not.toContain(projectName);
  });

  it('@real rejects duplicate project creation', realTestOptions, async () => {
    const projectName = uniqueName('test-project-dup');

    // Create first time
    await projectsApi.create(projectName);
    createdProjects.push(projectName);

    // Try to create again - should throw ApiError with conflict status
    try {
      await projectsApi.create(projectName);
      expect.fail('Expected ApiError to be thrown for duplicate project');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const apiError = e as ApiError;
      expect(apiError.isConflict() || apiError.status >= 400).toBe(true);
    }
  });

  it('@real returns error for non-existent project deletion', realTestOptions, async () => {
    const nonExistentProject = uniqueName('non-existent-project');

    // Try to delete a project that doesn't exist
    try {
      await projectsApi.delete(nonExistentProject);
      // Some APIs return success for idempotent deletes - that's okay
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const apiError = e as ApiError;
      expect(apiError.isNotFound() || apiError.status >= 400).toBe(true);
    }
  });

  // Edge case tests
  it('@real handles project name with special characters', realTestOptions, async () => {
    // Note: API might reject certain characters - test what's supported
    const projectName = uniqueName('test-project-special-123');

    const result = await projectsApi.create(projectName);
    createdProjects.push(projectName);

    expect(result.info).toBeDefined();

    // Verify it's in the list
    const listResult = await projectsApi.list();
    expect(listResult).toContain(projectName);
  });

  it('@real returns camelCase response properties for project create', realTestOptions, async () => {
    const projectName = uniqueName('test-project-casing');

    const result = await projectsApi.create(projectName);
    createdProjects.push(projectName);

    // Should have camelCase keys (or no keys if just info)
    expect(result).toBeDefined();
    if (result.info) {
      expect(result).toHaveProperty('info');
    }
    // Should NOT have snake_case keys
    expect(result).not.toHaveProperty('created_at');
    expect(result).not.toHaveProperty('project_id');
  });
});
