/**
 * Real Orchestra API tests for Custom API Keys.
 *
 * These tests hit the actual Orchestra API to verify custom API key CRUD operations.
 * Run with: npm run test:interfaces:api
 */

import { describe, it, expect, afterAll } from 'vitest';
import {
  customKeysApi,
  uniqueName,
  safeDelete,
  ApiError,
  realTestOptions,
} from './fixtures/api-actions';

describe('@real Custom Keys API', () => {
  // Track resources for cleanup
  const createdKeys: string[] = [];

  afterAll(async () => {
    // Cleanup all created keys
    for (const name of createdKeys) {
      await safeDelete(() => customKeysApi.delete(name), `customKey: ${name}`);
    }
  });

  it('@real lists custom API keys', realTestOptions, async () => {
    const result = await customKeysApi.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Result is array of { name, value } objects
  });

  it('@real creates a custom API key', realTestOptions, async () => {
    const keyName = uniqueName('test-key');
    const keyValue = 'test-value-12345';

    const result = await customKeysApi.create(keyName, keyValue);
    createdKeys.push(keyName);

    expect(result).toBeDefined();
    expect(result.info).toBeDefined();

    // Verify key exists in list
    const listResult = await customKeysApi.list();
    const found = listResult.find((k) => k.name === keyName);
    expect(found).toBeDefined();
  });

  it('@real gets a custom API key by name', realTestOptions, async () => {
    const keyName = uniqueName('test-key-get');
    const keyValue = 'test-value-get-12345';

    // Create first
    await customKeysApi.create(keyName, keyValue);
    createdKeys.push(keyName);

    // Get by name
    const result = await customKeysApi.get(keyName);

    expect(result).toBeDefined();
    expect(result.name).toBe(keyName);
    // Value is masked for security - only check it exists
    expect(result.value).toBeDefined();
  });

  it('@real deletes a custom API key', realTestOptions, async () => {
    const keyName = uniqueName('test-key-delete');
    const keyValue = 'test-value-delete-12345';

    // Create first
    await customKeysApi.create(keyName, keyValue);
    // Don't add to cleanup - we're testing deletion

    // Delete
    const result = await customKeysApi.delete(keyName);
    expect(result.info).toBeDefined();

    // Verify key no longer exists
    try {
      await customKeysApi.get(keyName);
      expect.fail('Expected ApiError for deleted key');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).isNotFound()).toBe(true);
    }
  });

  it('@real renames a custom API key', realTestOptions, async () => {
    const keyName = uniqueName('test-key-rename');
    const newKeyName = uniqueName('test-key-renamed');
    const keyValue = 'test-value-rename-12345';

    // Create first
    await customKeysApi.create(keyName, keyValue);
    // Track new name for cleanup (rename will change the name)
    createdKeys.push(newKeyName);

    // Rename
    const result = await customKeysApi.rename(keyName, newKeyName);
    expect(result.info).toBeDefined();

    // Verify old name no longer exists
    try {
      await customKeysApi.get(keyName);
      expect.fail('Expected ApiError for old key name');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
    }

    // Verify new name exists
    const newKey = await customKeysApi.get(newKeyName);
    expect(newKey.name).toBe(newKeyName);
    // Value is masked for security - only check it exists
    expect(newKey.value).toBeDefined();
  });

  it('@real handles duplicate key creation', realTestOptions, async () => {
    const keyName = uniqueName('test-key-dup');
    const keyValue = 'test-value-dup-12345';

    // Create first time
    await customKeysApi.create(keyName, keyValue);
    createdKeys.push(keyName);

    // Try to create again with same name
    // Note: API might either reject with error or silently update
    try {
      const result = await customKeysApi.create(keyName, 'different-value');
      // If it succeeds, the key was updated/overwritten - verify it still exists
      const listResult = await customKeysApi.list();
      const found = listResult.find((k) => k.name === keyName);
      expect(found).toBeDefined();
    } catch (e) {
      // If it fails, it should be an ApiError
      expect(e).toBeInstanceOf(ApiError);
    }
  });

  it('@real returns error for non-existent key', realTestOptions, async () => {
    const nonExistentKey = uniqueName('non-existent-key');

    try {
      await customKeysApi.get(nonExistentKey);
      expect.fail('Expected ApiError for non-existent key');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).isNotFound()).toBe(true);
    }
  });
});
