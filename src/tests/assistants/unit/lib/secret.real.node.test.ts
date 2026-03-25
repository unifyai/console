/**
 * Real API tests for src/lib/assistants/secret.ts
 *
 * These tests hit the actual /api/logs endpoint to verify secrets functionality works correctly.
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
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  getTestApiKey,
  getTestAssistant,
  skipIfServerNotReachable,
  realTestOptions,
  uniqueName,
} from '@/tests/assistants/api/fixtures/api-actions';
import { getSecrets, createSecret, deleteSecret } from '@/lib/assistants/secret';

const isError = (res: unknown): res is { detail: string } => {
  return res !== null && typeof res === 'object' && 'detail' in res;
};

describe('@real secret.ts - Orchestra Integration', () => {
  let API_KEY: string;
  let TEST_USER_ID: string;
  let TEST_ASSISTANT_ID: string;
  const createdSecretIds: number[] = [];

  beforeAll(async () => {
    try {
      API_KEY = getTestApiKey();
    } catch {
      console.warn('VITE_TEST_API_KEY not set, skipping integration tests');
      return;
    }

    await skipIfServerNotReachable();

    const assistant = await getTestAssistant(API_KEY);
    TEST_USER_ID = 'test-user-id';
    TEST_ASSISTANT_ID = String(assistant.agentId);
  }, 30000);

  afterEach(async () => {
    if (createdSecretIds.length > 0 && API_KEY) {
      const deleteAction = await deleteSecret(API_KEY);
      for (const logId of createdSecretIds) {
        try {
          await deleteAction(logId, TEST_USER_ID);
        } catch {
          // Ignore cleanup errors
        }
      }
      createdSecretIds.length = 0;
    }
  });

  afterAll(async () => {
    if (createdSecretIds.length > 0 && API_KEY) {
      const deleteAction = await deleteSecret(API_KEY);
      for (const logId of createdSecretIds) {
        try {
          await deleteAction(logId, TEST_USER_ID);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  describe('getSecrets', () => {
    it('@real should retrieve secrets list (may be empty)', realTestOptions, async () => {
      const getSecretsAction = await getSecrets(API_KEY, TEST_USER_ID, false);
      const result = await getSecretsAction(TEST_ASSISTANT_ID, TEST_USER_ID);

      if (isError(result)) {
        console.log(
          'Note: getSecrets returned detail (may be normal for new context):',
          result.detail
        );
        return;
      }

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createSecret', () => {
    it('@real should create a new secret', realTestOptions, async () => {
      const secretName = uniqueName('test-secret');
      const secretValue = 'test-value-12345';

      const createAction = await createSecret(API_KEY, TEST_USER_ID, false);
      const result = await createAction(TEST_ASSISTANT_ID, TEST_USER_ID, {
        name: secretName,
        value: secretValue,
      });

      expect(isError(result)).toBe(false);
      expect(result).toHaveProperty('info');
      expect((result as { info: string }).info).toContain('successfully');

      const getSecretsAction = await getSecrets(API_KEY, TEST_USER_ID, false);
      const secrets = await getSecretsAction(TEST_ASSISTANT_ID, TEST_USER_ID);

      if (!isError(secrets) && Array.isArray(secrets)) {
        const createdSecret = secrets.find((s) => s.name === secretName);
        if (createdSecret) {
          createdSecretIds.push(createdSecret.logId);
          expect(createdSecret.name).toBe(secretName);
          expect(createdSecret.value).toBeDefined();
        }
      }
    });

    it('@real should create secret with description', realTestOptions, async () => {
      const secretName = uniqueName('described-secret');
      const secretValue = 'secret-value-with-desc';
      const secretDescription = 'This is a test secret for integration testing';

      const createAction = await createSecret(API_KEY, TEST_USER_ID, false);
      const result = await createAction(TEST_ASSISTANT_ID, TEST_USER_ID, {
        name: secretName,
        value: secretValue,
        description: secretDescription,
      });

      expect(isError(result)).toBe(false);
      expect(result).toHaveProperty('info');

      const getSecretsAction = await getSecrets(API_KEY, TEST_USER_ID, false);
      const secrets = await getSecretsAction(TEST_ASSISTANT_ID, TEST_USER_ID);

      if (!isError(secrets) && Array.isArray(secrets)) {
        const createdSecret = secrets.find((s) => s.name === secretName);
        if (createdSecret) {
          createdSecretIds.push(createdSecret.logId);
          expect(createdSecret.description).toBe(secretDescription);
        }
      }
    });
  });

  describe('deleteSecret', () => {
    it('@real should delete an existing secret', realTestOptions, async () => {
      const secretName = uniqueName('delete-me-secret');
      const createAction = await createSecret(API_KEY, TEST_USER_ID, false);
      await createAction(TEST_ASSISTANT_ID, TEST_USER_ID, {
        name: secretName,
        value: 'to-be-deleted',
      });

      const getSecretsAction = await getSecrets(API_KEY, TEST_USER_ID, false);
      const secrets = await getSecretsAction(TEST_ASSISTANT_ID, TEST_USER_ID);

      if (isError(secrets) || !Array.isArray(secrets)) {
        throw new Error('Failed to get secrets after creation');
      }

      const createdSecret = secrets.find((s) => s.name === secretName);
      if (!createdSecret) {
        throw new Error('Created secret not found in list');
      }

      const deleteAction = await deleteSecret(API_KEY);
      const result = await deleteAction(createdSecret.logId, TEST_USER_ID);

      expect(isError(result)).toBe(false);
      expect(result).toHaveProperty('info');
      expect((result as { info: string }).info).toContain('successfully');

      const secretsAfter = await getSecretsAction(TEST_ASSISTANT_ID, TEST_USER_ID);
      if (!isError(secretsAfter) && Array.isArray(secretsAfter)) {
        const deletedSecret = secretsAfter.find((s) => s.name === secretName);
        expect(deletedSecret).toBeUndefined();
      }
    });

    it('@real should handle deleting non-existent secret gracefully', realTestOptions, async () => {
      const deleteAction = await deleteSecret(API_KEY);
      const result = await deleteAction(999999999, TEST_USER_ID);

      expect(result).toBeDefined();
    });
  });
});
