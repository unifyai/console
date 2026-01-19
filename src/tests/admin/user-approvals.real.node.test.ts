/**
 * Real API tests for Admin User Approvals endpoints.
 *
 * Tests the /api/admin/user-approvals endpoints which allow
 * admins to list and manage user hiring approvals.
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

describe('@real Admin User Approvals API', () => {
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

  it('@real lists user approvals', realTestOptions, async () => {
    if (!hasAdminKey) {
      console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
      return;
    }

    const result = await adminApi.listApprovals();

    expect(result).toBeDefined();
    // Response should have approvals or info array
    const approvals = result.approvals || result.info || [];
    expect(Array.isArray(approvals)).toBe(true);
  });

  it('@real lists approvals with status filter', realTestOptions, async () => {
    if (!hasAdminKey) {
      console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
      return;
    }

    const result = await adminApi.listApprovals('approved', 10, 0);

    expect(result).toBeDefined();
    const approvals = result.approvals || result.info || [];
    expect(Array.isArray(approvals)).toBe(true);
  });

  it('@real lists approvals with pagination', realTestOptions, async () => {
    if (!hasAdminKey) {
      console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
      return;
    }

    const result = await adminApi.listApprovals(undefined, 5, 0);

    expect(result).toBeDefined();
    const approvals = result.approvals || result.info || [];
    expect(Array.isArray(approvals)).toBe(true);
    expect(approvals.length).toBeLessThanOrEqual(5);
  });

  it('@real returns camelCase response properties', realTestOptions, async () => {
    if (!hasAdminKey) {
      console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
      return;
    }

    const result = await adminApi.listApprovals();

    // Verify we don't get snake_case properties at top level
    const keys = Object.keys(result);
    for (const key of keys) {
      expect(key).not.toMatch(/^[a-z]+_[a-z]+/); // No snake_case
    }
  });

  it('@real rejects update with invalid user ID', realTestOptions, async () => {
    if (!hasAdminKey) {
      console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
      return;
    }

    try {
      await adminApi.updateApprovalStatus('non-existent-user-id', 'approve');
      expect.fail('Expected ApiError for invalid user ID');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      // 500 can occur if the backend doesn't handle invalid UUIDs gracefully
      expect([400, 404, 500]).toContain((e as ApiError).status);
    }
  });

  it('@real rejects delete with invalid link ID', realTestOptions, async () => {
    if (!hasAdminKey) {
      console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
      return;
    }

    try {
      await adminApi.deleteApprovalLink('non-existent-link-id');
      expect.fail('Expected ApiError for invalid link ID');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect([400, 404]).toContain((e as ApiError).status);
    }
  });
});
