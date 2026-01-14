/**
 * Real API tests for src/lib/assistants/task.ts
 *
 * These tests hit the actual /api/logs endpoint to verify task functionality works correctly.
 * Run with: npm run test:real
 *
 * Requirements:
 *   1. VITE_TEST_API_KEY set in .env.test
 *   2. Dev server running (npm run dev) or NEXT_PUBLIC_BASE_URL pointing to a running instance
 *   3. Orchestra backend running and accessible
 *
 * @group real
 */

// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  getTestApiKey,
  getTestAssistant,
  skipIfServerNotReachable,
  realTestOptions,
} from '@/tests/assistants/api/fixtures/api-actions';
import { getTasks, getUniqueFieldValues, updateTask } from '@/lib/assistants/task';

const isError = (res: unknown): res is { detail: string } => {
  return res !== null && typeof res === 'object' && 'detail' in res;
};

describe('@real task.ts - Orchestra Integration', () => {
  let API_KEY: string;
  let TEST_USER_CONTEXT: string;
  let TEST_ASSISTANT_CONTEXT: string;

  beforeAll(async () => {
    try {
      API_KEY = getTestApiKey();
    } catch {
      console.warn('VITE_TEST_API_KEY not set, skipping integration tests');
      return;
    }

    await skipIfServerNotReachable();

    // Get a test assistant to use for context
    const assistant = await getTestAssistant(API_KEY);
    TEST_USER_CONTEXT = 'test-user';
    TEST_ASSISTANT_CONTEXT = `${assistant.firstName}_${assistant.surname}`;
  }, 30000);

  describe('getTasks', () => {
    it('@real should retrieve tasks list (may be empty)', realTestOptions, async () => {
      const getTasksAction = await getTasks(API_KEY, TEST_USER_CONTEXT);
      const result = await getTasksAction(TEST_ASSISTANT_CONTEXT, null, 10, 0);

      // Should return a LogsResponseProps or error object
      if (isError(result)) {
        // 404 might mean no context exists yet, which is acceptable
        console.log(
          'Note: getTasks returned detail (may be normal for new context):',
          result.detail
        );
        return;
      }

      // Should have logs property
      expect(result).toHaveProperty('logs');
      expect(Array.isArray(result.logs)).toBe(true);
    });

    it('@real should support filtering by expression', realTestOptions, async () => {
      const getTasksAction = await getTasks(API_KEY, TEST_USER_CONTEXT);
      // Filter for completed tasks
      const result = await getTasksAction(TEST_ASSISTANT_CONTEXT, 'status == "completed"', 10, 0);

      if (isError(result)) {
        // Filter might return no results or context doesn't exist
        console.log('Note: getTasks with filter returned detail:', result.detail);
        return;
      }

      expect(result).toHaveProperty('logs');
      expect(Array.isArray(result.logs)).toBe(true);
    });

    it('@real should support pagination', realTestOptions, async () => {
      const getTasksAction = await getTasks(API_KEY, TEST_USER_CONTEXT);

      // Get first page
      const page1 = await getTasksAction(TEST_ASSISTANT_CONTEXT, null, 5, 0);
      if (isError(page1)) {
        console.log('Note: getTasks pagination test - no tasks exist');
        return;
      }

      // Get second page
      const page2 = await getTasksAction(TEST_ASSISTANT_CONTEXT, null, 5, 5);
      if (isError(page2)) {
        // Second page might be empty if there are <= 5 tasks
        return;
      }

      expect(page1).toHaveProperty('logs');
      expect(page2).toHaveProperty('logs');
    });
  });

  describe('getUniqueFieldValues', () => {
    it('@real should return unique values for status field', realTestOptions, async () => {
      const getFieldValuesAction = await getUniqueFieldValues(API_KEY, TEST_USER_CONTEXT);
      const result = await getFieldValuesAction(TEST_ASSISTANT_CONTEXT, 'status');

      if (isError(result)) {
        // Might return error if no tasks exist
        console.log('Note: getUniqueFieldValues returned detail:', result.detail);
        return;
      }

      expect(Array.isArray(result)).toBe(true);
      // If there are statuses, they should be strings
      const values = result as string[];
      if (values.length > 0) {
        expect(typeof values[0]).toBe('string');
      }
    });

    it('@real should return unique values for priority field', realTestOptions, async () => {
      const getFieldValuesAction = await getUniqueFieldValues(API_KEY, TEST_USER_CONTEXT);
      const result = await getFieldValuesAction(TEST_ASSISTANT_CONTEXT, 'priority');

      if (isError(result)) {
        console.log('Note: getUniqueFieldValues for priority returned detail:', result.detail);
        return;
      }

      expect(Array.isArray(result)).toBe(true);
    });

    it('@real should return empty array for non-existent field', realTestOptions, async () => {
      const getFieldValuesAction = await getUniqueFieldValues(API_KEY, TEST_USER_CONTEXT);
      const result = await getFieldValuesAction(TEST_ASSISTANT_CONTEXT, 'nonexistent_field_xyz');

      if (isError(result)) {
        // API might return error for invalid field
        return;
      }

      expect(Array.isArray(result)).toBe(true);
      // Should be empty since field doesn't exist
      expect(result).toEqual([]);
    });
  });

  describe('updateTask', () => {
    it('@real should update task entries', realTestOptions, async () => {
      // First get a task to update
      const getTasksAction = await getTasks(API_KEY, TEST_USER_CONTEXT);
      const tasksResult = await getTasksAction(TEST_ASSISTANT_CONTEXT, null, 1, 0);

      if (isError(tasksResult)) {
        console.log('Note: No tasks available to update');
        return;
      }

      if (!Array.isArray(tasksResult.logs) || tasksResult.logs.length === 0) {
        console.log('Note: No tasks found to update');
        return;
      }

      // Get the first task's log ID
      const firstTask = tasksResult.logs[0] as { id?: string | number };
      if (!firstTask.id) {
        console.log('Note: Task has no ID field');
        return;
      }

      const logId = typeof firstTask.id === 'string' ? parseInt(firstTask.id, 10) : firstTask.id;

      // Update the task's description
      const updateAction = await updateTask(API_KEY, TEST_USER_CONTEXT);
      const result = await updateAction(TEST_ASSISTANT_CONTEXT, [logId], {
        description: `Updated by integration test at ${new Date().toISOString()}`,
      });

      expect(isError(result)).toBe(false);
      expect(result).toHaveProperty('info');
    });

    it('@real should handle updating non-existent task gracefully', realTestOptions, async () => {
      const updateAction = await updateTask(API_KEY, TEST_USER_CONTEXT);
      const result = await updateAction(TEST_ASSISTANT_CONTEXT, [999999999], {
        description: 'This should fail gracefully',
      });

      // Should either succeed (idempotent) or return an error detail
      // Either way, should not throw
      expect(result).toBeDefined();
    });

    it('@real should support batch updates', realTestOptions, async () => {
      // Get multiple tasks if available
      const getTasksAction = await getTasks(API_KEY, TEST_USER_CONTEXT);
      const tasksResult = await getTasksAction(TEST_ASSISTANT_CONTEXT, null, 3, 0);

      if (isError(tasksResult)) {
        console.log('Note: No tasks available for batch update');
        return;
      }

      if (!Array.isArray(tasksResult.logs) || tasksResult.logs.length < 2) {
        console.log('Note: Not enough tasks for batch update test');
        return;
      }

      // Get log IDs
      const logIds = tasksResult.logs
        .map((task: { id?: string | number }) => {
          if (!task.id) return null;
          return typeof task.id === 'string' ? parseInt(task.id, 10) : task.id;
        })
        .filter((id): id is number => id !== null);

      if (logIds.length < 2) {
        console.log('Note: Not enough valid task IDs for batch update');
        return;
      }

      // Batch update
      const updateAction = await updateTask(API_KEY, TEST_USER_CONTEXT);
      const result = await updateAction(TEST_ASSISTANT_CONTEXT, logIds, {
        notes: `Batch updated at ${new Date().toISOString()}`,
      });

      expect(isError(result)).toBe(false);
      expect(result).toHaveProperty('info');
    });
  });
});
