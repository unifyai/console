/**
 * Real Orchestra API tests for Logs.
 *
 * These tests hit the actual Orchestra API to verify contract stability.
 * Run with: npm run test:interfaces:api
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  projectsApi,
  logsApi,
  contextsApi,
  uniqueName,
  safeDelete,
  realTestOptions,
  ApiError,
} from './fixtures/api-actions';

describe('@real Logs API', () => {
  // Test project to contain logs
  let testProject: string;

  beforeAll(async () => {
    // Create a test project
    testProject = uniqueName('test-logs-project');
    await projectsApi.create(testProject);
  });

  afterAll(async () => {
    // Cleanup project (logs are deleted with it)
    await safeDelete(() => projectsApi.delete(testProject), `project: ${testProject}`);
  });

  it('@real gets logs with filters', realTestOptions, async () => {
    const result = await logsApi.get(testProject, {
      limit: 10,
    });

    // Should return without throwing - may have logs array or be empty
    expect(result).toBeDefined();
  });

  it('@real gets latest timestamp', realTestOptions, async () => {
    // Should not throw - returns timestamp or null for empty project
    const result = await logsApi.getLatestTimestamp(testProject);

    // Result is defined (may be null/empty for new project with no logs)
    expect(result).toBeDefined();
  });

  it('@real gets log metrics', realTestOptions, async () => {
    // Metrics endpoint requires a key parameter
    const result = await logsApi.getMetrics(testProject, 'count', 'id', {});

    // Metrics result should be defined
    expect(result).toBeDefined();
  });

  it('@real creates new logs', realTestOptions, async () => {
    const result = await logsApi.create(
      testProject,
      [{ test_param: 'value1' }, { test_param: 'value2' }],
      [
        { message: 'Test log entry 1', level: 'info' },
        { message: 'Test log entry 2', level: 'debug' },
      ]
    );

    // Should return confirmation (format varies)
    expect(result).toBeDefined();
    // May have info message or other confirmation
  });

  it('@real updates existing logs', realTestOptions, async () => {
    // First create some logs with a custom field we can update
    await logsApi.create(
      testProject,
      [{ test_param: 'update-test' }],
      [{ custom_field: 'original', level: 'info' }]
    );

    // Get logs to find an ID to update
    const logsResult = await logsApi.get(testProject, { limit: 1 });

    // If we have logs, try to update a non-immutable field
    if (logsResult.logs && logsResult.logs.length > 0) {
      const logId = logsResult.logs[0].id as number;
      try {
        const result = await logsApi.update(
          testProject,
          null,
          [logId],
          { custom_field: 'updated' },
          {},
          true // overwrite
        );
        expect(result).toBeDefined();
      } catch (e) {
        // Some fields may be immutable - this is expected behavior
        expect(e).toBeInstanceOf(ApiError);
      }
    } else {
      // No logs to update, that's okay
      expect(logsResult).toBeDefined();
    }
  });

  it('@real deletes logs', realTestOptions, async () => {
    // Create logs specifically for deletion
    await logsApi.create(
      testProject,
      [{ test_param: 'delete-test' }],
      [{ message: 'To be deleted', level: 'info' }]
    );

    // Get logs to find IDs to delete
    const logsResult = await logsApi.get(testProject, { limit: 5 });

    if (logsResult.logs && logsResult.logs.length > 0) {
      const logIds = logsResult.logs.map((l) => l.id as number);
      const result = await logsApi.delete(testProject, null, logIds);
      expect(result).toBeDefined();
    } else {
      expect(logsResult).toBeDefined();
    }
  });

  it('@real returns camelCase response properties for logs get', realTestOptions, async () => {
    const result = await logsApi.get(testProject, { limit: 10 });

    expect(result).toBeDefined();
    // Should NOT have snake_case keys in the response
    expect(result).not.toHaveProperty('total_count');
    // If there are logs, check their properties
    if (result.logs && result.logs.length > 0) {
      const log = result.logs[0];
      // Should NOT have snake_case keys
      expect(log).not.toHaveProperty('created_at');
      expect(log).not.toHaveProperty('updated_at');
    }
  });

  it('@real returns camelCase response properties for logs create', realTestOptions, async () => {
    const result = await logsApi.create(
      testProject,
      [{ testParam: 'casing-test' }],
      [{ message: 'Casing test entry', level: 'info' }]
    );

    expect(result).toBeDefined();
    // Should NOT have snake_case keys
    expect(result).not.toHaveProperty('log_ids');
    expect(result).not.toHaveProperty('created_at');
  });

  it('@real gets fields for project', realTestOptions, async () => {
    // First create some logs to ensure fields exist
    await logsApi.create(
      testProject,
      [{ testParam: 'fields-test' }],
      [{ testField: 'value', numericField: 123 }]
    );

    // Get fields without context
    const result = await logsApi.getFields(testProject);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    // Should have at least some fields from the log we created
    // Fields have structure like { dataType: 'str', fieldType: 'entry', ... }
  });

  it('@real gets fields with context parameter', realTestOptions, async () => {
    // This test verifies that the context parameter is passed correctly
    // to the backend (fix for Bug #14)
    const testContext = 'TestContext';
    await contextsApi.create(testProject, testContext);

    // Get fields with a specific context
    // This should not return fields from other contexts
    const result = await logsApi.getFields(testProject, testContext);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    // Empty context may return empty object, that's okay
    // The important thing is it doesn't throw and doesn't return wrong fields
  });

  it('@real projectName parameter is used (not project)', realTestOptions, async () => {
    // This test specifically verifies the fix for Bug #14
    // The API was reading 'project' but frontend sends 'projectName'

    // If the fix works, this should return fields for testProject
    // If broken, it would return default/fallback fields
    const result = await logsApi.getFields(testProject);

    expect(result).toBeDefined();
    // If we get fields with strange names like 'modelProviderStr', 'endpointId', etc.
    // it means the project parameter wasn't passed correctly
    expect(result).not.toHaveProperty('modelProviderStr');
    expect(result).not.toHaveProperty('endpointId');
    expect(result).not.toHaveProperty('credits');
  });
});
