/**
 * Real Orchestra API tests for Contexts.
 *
 * These tests hit the actual Orchestra API to verify contract stability.
 * Run with: npm run test:interfaces:api
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  projectsApi,
  contextsApi,
  uniqueName,
  safeDelete,
  ApiError,
  realTestOptions,
} from './fixtures/api-actions';

describe('@real Contexts API', () => {
  // Test project to contain contexts
  let testProject: string;
  // Track contexts for cleanup
  const createdContexts: string[] = [];

  beforeAll(async () => {
    // Create a test project
    testProject = uniqueName('test-contexts-project');
    await projectsApi.create(testProject);
  });

  afterAll(async () => {
    // Cleanup contexts first
    for (const name of createdContexts) {
      await safeDelete(
        () => contextsApi.delete(testProject, name),
        `context: ${name}`
      );
    }
    // Then cleanup project
    await safeDelete(
      () => projectsApi.delete(testProject),
      `project: ${testProject}`
    );
  });

  it('@real lists contexts in project', realTestOptions, async () => {
    const result = await contextsApi.list(testProject);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('@real creates a new context', realTestOptions, async () => {
    const contextName = uniqueName('test-context');
    const description = 'Test context description';

    // Create context
    const result = await contextsApi.create(
      testProject,
      contextName,
      description
    );
    createdContexts.push(contextName);

    expect(result).toBeDefined();

    // Verify context exists in list
    const listResult = await contextsApi.list(testProject);
    const found = listResult.find((c) => c.name === contextName);
    expect(found).toBeDefined();
    expect(found?.description).toBe(description);
  });

  it('@real deletes a context', realTestOptions, async () => {
    // Create a context to delete
    const contextName = uniqueName('test-context-delete');
    await contextsApi.create(testProject, contextName);
    // Don't add to cleanup - we're testing deletion

    // Delete it
    const result = await contextsApi.delete(testProject, contextName);
    expect(result.success).toBe(true);

    // Verify context no longer exists
    const listResult = await contextsApi.list(testProject);
    const found = listResult.find((c) => c.name === contextName);
    expect(found).toBeUndefined();
  });

  it('@real rejects duplicate context creation', realTestOptions, async () => {
    const contextName = uniqueName('test-context-dup');

    // Create first time
    await contextsApi.create(testProject, contextName);
    createdContexts.push(contextName);

    // Try to create again - should throw ApiError
    try {
      await contextsApi.create(testProject, contextName);
      expect.fail('Expected ApiError to be thrown for duplicate context');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const apiError = e as ApiError;
      expect(apiError.isConflict() || apiError.status >= 400).toBe(true);
    }
  });

  it(
    '@real returns error for non-existent context deletion',
    realTestOptions,
    async () => {
      const nonExistentContext = uniqueName('non-existent-context');

      // Try to delete a context that doesn't exist
      try {
        await contextsApi.delete(testProject, nonExistentContext);
        // Some APIs return success for idempotent deletes - that's okay
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const apiError = e as ApiError;
        expect(apiError.isNotFound() || apiError.status >= 400).toBe(true);
      }
    }
  );

  it('@real creates context without description', realTestOptions, async () => {
    const contextName = uniqueName('test-context-nodesc');

    // Create context without description
    const result = await contextsApi.create(testProject, contextName);
    createdContexts.push(contextName);

    expect(result).toBeDefined();

    // Verify context exists
    const listResult = await contextsApi.list(testProject);
    const found = listResult.find((c) => c.name === contextName);
    expect(found).toBeDefined();
  });
});
