/**
 * Real API tests for Admin Credit Grant Link endpoints.
 *
 * Tests the /api/admin/credit-grant-link endpoints which allow
 * admins to create, list, and delete credit grant links.
 *
 * Note: These tests require VITE_TEST_ADMIN_KEY to be set.
 *
 * Run with: npm run test:api
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  adminApi,
  realTestOptions,
  skipIfServerNotReachable,
  ApiError,
} from '../assistants/api/fixtures/api-actions';

describe('@real Admin Credit Grant Link API', () => {
  let hasAdminKey = false;

  beforeAll(async () => {
    await skipIfServerNotReachable();

    // Check if admin key is available
    try {
      hasAdminKey = !!process.env.VITE_TEST_ADMIN_KEY;
    } catch {
      hasAdminKey = false;
    }
  });

  it('@real lists credit grant links', realTestOptions, async () => {
    if (!hasAdminKey) {
      console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
      return;
    }

    const result = await adminApi.listCreditGrantLinks();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('@real lists credit grant links with pagination', realTestOptions, async () => {
    if (!hasAdminKey) {
      console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
      return;
    }

    const result = await adminApi.listCreditGrantLinks(5, 0);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('@real creates credit grant link', realTestOptions, async () => {
    if (!hasAdminKey) {
      console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
      return;
    }

    const link = await adminApi.createCreditGrantLink(7);

    expect(link).toBeDefined();
    expect(link.id).toBeDefined();
    expect(link.token).toBeDefined();
    expect(link.expiresAt).toBeDefined();
  });

  it('@real rejects delete with invalid link ID', realTestOptions, async () => {
    if (!hasAdminKey) {
      console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
      return;
    }

    try {
      await adminApi.deleteCreditGrantLink('non-existent-link-id');
      expect.fail('Expected ApiError for invalid link ID');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect([400, 404]).toContain((e as ApiError).status);
    }
  });
});
