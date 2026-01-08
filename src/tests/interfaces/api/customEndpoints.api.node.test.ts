/**
 * Real Orchestra API tests for Custom Endpoints.
 *
 * These tests hit the actual Orchestra API to verify custom endpoint CRUD operations.
 * Note: Custom endpoints require a custom API key to be created first.
 * Run with: npm run test:interfaces:api
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  customEndpointsApi,
  customKeysApi,
  uniqueName,
  safeDelete,
  ApiError,
  realTestOptions,
  realTestOptionsExtended,
} from './fixtures/api-actions';

describe('@real Custom Endpoints API', () => {
  // Track resources for cleanup
  const createdEndpoints: string[] = [];
  let testKeyName: string;

  beforeAll(async () => {
    // Create a custom API key that will be used by all custom endpoints
    testKeyName = uniqueName('test-endpoint-key');
    await customKeysApi.create(testKeyName, 'test-api-key-value-12345');
  });

  afterAll(async () => {
    // Cleanup all created endpoints
    for (const name of createdEndpoints) {
      await safeDelete(() => customEndpointsApi.delete(name), `customEndpoint: ${name}`);
    }
    // Cleanup the test key
    await safeDelete(() => customKeysApi.delete(testKeyName), `customKey: ${testKeyName}`);
  });

  it('@real lists custom endpoints', realTestOptions, async () => {
    const result = await customEndpointsApi.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('@real creates a custom endpoint', realTestOptionsExtended, async () => {
    const endpointName = `${uniqueName('test-model')}@custom`;
    const url = 'https://api.example.com/v1';

    const result = await customEndpointsApi.create(endpointName, url, testKeyName);
    createdEndpoints.push(endpointName);

    expect(result).toBeDefined();
    expect(result.info).toBeDefined();

    // Verify endpoint exists in list
    const listResult = await customEndpointsApi.list();
    const found = listResult.find((e) => e.name === endpointName);
    expect(found).toBeDefined();
  });

  it('@real creates a custom endpoint with modelArg', realTestOptionsExtended, async () => {
    const endpointName = `${uniqueName('test-model-arg')}@custom`;
    const url = 'https://api.example.com/v1';
    const modelArg = 'actual-model-name-v1';

    const result = await customEndpointsApi.create(endpointName, url, testKeyName, modelArg);
    createdEndpoints.push(endpointName);

    expect(result).toBeDefined();
    expect(result.info).toBeDefined();

    // Verify endpoint exists with correct modelArg
    const listResult = await customEndpointsApi.list();
    const found = listResult.find((e) => e.name === endpointName);
    expect(found).toBeDefined();
    expect(found?.modelArg).toBe(modelArg);
  });

  it('@real deletes a custom endpoint', realTestOptions, async () => {
    const endpointName = `${uniqueName('test-model-delete')}@custom`;
    const url = 'https://api.example.com/v1';

    // Create first
    await customEndpointsApi.create(endpointName, url, testKeyName);
    // Don't add to cleanup - we're testing deletion

    // Delete
    const result = await customEndpointsApi.delete(endpointName);
    expect(result.info).toBeDefined();

    // Verify endpoint no longer exists
    const listResult = await customEndpointsApi.list();
    const found = listResult.find((e) => e.name === endpointName);
    expect(found).toBeUndefined();
  });

  it('@real renames a custom endpoint', realTestOptionsExtended, async () => {
    const endpointName = `${uniqueName('test-model-rename')}@custom`;
    const newEndpointName = `${uniqueName('test-model-renamed')}@custom`;
    const url = 'https://api.example.com/v1';

    // Create first
    await customEndpointsApi.create(endpointName, url, testKeyName);
    // Track new name for cleanup
    createdEndpoints.push(newEndpointName);

    // Rename
    const result = await customEndpointsApi.rename(endpointName, newEndpointName);
    expect(result.info).toBeDefined();

    // Verify old name no longer exists
    const listResult = await customEndpointsApi.list();
    const oldFound = listResult.find((e) => e.name === endpointName);
    expect(oldFound).toBeUndefined();

    // Verify new name exists
    const newFound = listResult.find((e) => e.name === newEndpointName);
    expect(newFound).toBeDefined();
  });

  it('@real rejects endpoint with invalid provider', realTestOptions, async () => {
    // Provider must be one of: custom, custom-openai, custom-mistral, etc.
    const invalidEndpointName = `${uniqueName('test-model')}@invalid-provider`;
    const url = 'https://api.example.com/v1';

    try {
      await customEndpointsApi.create(invalidEndpointName, url, testKeyName);
      expect.fail('Expected ApiError for invalid provider');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(400);
    }
  });

  it('@real rejects endpoint without @ symbol', realTestOptions, async () => {
    const invalidEndpointName = uniqueName('test-model-no-at');
    const url = 'https://api.example.com/v1';

    try {
      await customEndpointsApi.create(invalidEndpointName, url, testKeyName);
      expect.fail('Expected ApiError for endpoint without @ symbol');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(400);
    }
  });

  it('@real rejects endpoint with non-existent key', realTestOptions, async () => {
    const endpointName = `${uniqueName('test-model')}@custom`;
    const url = 'https://api.example.com/v1';
    const nonExistentKey = uniqueName('non-existent-key');

    try {
      await customEndpointsApi.create(endpointName, url, nonExistentKey);
      expect.fail('Expected ApiError for non-existent key');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).isNotFound()).toBe(true);
    }
  });
});
