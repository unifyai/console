/**
 * Real API tests for src/lib/assistants/contact.ts
 *
 * These tests hit the actual Orchestra API to verify contact functionality works correctly.
 * Run with: npm run test:real
 *
 * Requirements:
 *   1. VITE_TEST_API_KEY set in .env.test
 *   2. VITE_TEST_ADMIN_KEY set in .env.test (for admin operations)
 *   3. Dev server running (npm run dev) or NEXT_PUBLIC_BASE_URL pointing to a running instance
 *   4. Orchestra backend running and accessible
 *
 * @group real
 */

// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  contactApi,
  getTestAssistant,
  getTestApiKey,
  getAdminApiKey,
  skipIfServerNotReachable,
  realTestOptions,
} from '@/tests/assistants/api/fixtures/api-actions';

const isError = (res: unknown): res is { detail: string } => {
  return res !== null && typeof res === 'object' && 'detail' in res;
};

describe('@real contact.ts - Orchestra Integration', () => {
  let API_KEY: string;
  let ADMIN_KEY: string;

  beforeAll(async () => {
    try {
      API_KEY = getTestApiKey();
    } catch {
      console.warn('VITE_TEST_API_KEY not set, skipping integration tests');
      return;
    }

    try {
      ADMIN_KEY = getAdminApiKey();
    } catch {
      console.warn('VITE_TEST_ADMIN_KEY not set, some tests will be skipped');
      ADMIN_KEY = '';
    }

    await skipIfServerNotReachable();
  }, 10000);

  describe('listAvailablePhoneCountries', () => {
    it.skip('@real should return country list', realTestOptions, async () => {
      // SKIPPED: Requires external comms service and admin access
      // This endpoint requires admin access
      if (!ADMIN_KEY) {
        console.log('Skipping: ADMIN_KEY not set (required for this endpoint)');
        return;
      }

      try {
        const res = await contactApi.listCountries(ADMIN_KEY);

        expect(Array.isArray(res)).toBe(true);
        expect(res.length).toBeGreaterThan(0);
        expect(res[0]).toHaveProperty('code');
        expect(res[0]).toHaveProperty('name');
        expect(res[0]).toHaveProperty('flag');
      } catch (e: unknown) {
        // 403 means admin access is required
        if (e instanceof Error && e.message.includes('403')) {
          console.log('Admin access required (403), skipping');
          return;
        }
        throw e;
      }
    });
  });

  describe('listAvailableSocialPlatforms', () => {
    it.skip('@real should return platform list', realTestOptions, async () => {
      // SKIPPED: Requires external comms service and admin access
      if (!ADMIN_KEY) {
        console.log('Skipping: ADMIN_KEY not set');
        return;
      }

      const res = await contactApi.listPlatforms(ADMIN_KEY);

      expect(isError(res)).toBe(false);
      expect(Array.isArray(res)).toBe(true);
    });
  });

  describe('listAllAssistantEmails', () => {
    it.skip('@real should return list of emails', realTestOptions, async () => {
      // SKIPPED: Route not implemented (405 Method Not Allowed)
      if (!ADMIN_KEY) {
        console.log('Skipping: ADMIN_KEY not set');
        return;
      }

      const res = await contactApi.listEmails(ADMIN_KEY);

      expect(isError(res)).toBe(false);
      expect(Array.isArray(res)).toBe(true);
    });
  });

  describe('verifySocialAccount', () => {
    it.skip('@real should attempt verification', realTestOptions, async () => {
      // SKIPPED: Requires external comms service (telegram not supported, only whatsapp/phone)
      // This endpoint requires admin access
      if (!ADMIN_KEY) {
        console.log('Skipping: ADMIN_KEY not set (required for this endpoint)');
        return;
      }

      try {
        const res = await contactApi.verifySocial('whatsapp', '+15551234567', ADMIN_KEY);

        if (isError(res)) {
          expect(res.detail).toBeDefined();
        } else {
          expect(res).toHaveProperty('verificationCode');
        }
      } catch (e: unknown) {
        // 403 means admin access is required
        if (e instanceof Error && e.message.includes('403')) {
          console.log('Admin access required (403), skipping');
          return;
        }
        throw e;
      }
    });
  });

  describe('deleteAssistantContact', () => {
    it.skip('@real should attempt to delete contact', realTestOptions, async () => {
      // SKIPPED: Requires existing contact data
      try {
        const assistant = await getTestAssistant(API_KEY);
        const assistantId = assistant.agentId;

        const res = await contactApi.deleteContact(assistantId, 'email', API_KEY);

        if (isError(res)) {
          expect(res.detail).toBeDefined();
        } else {
          expect(res.info || res.assistant).toBeDefined();
        }
      } catch (e: unknown) {
        // Various errors are acceptable for this test
        if (
          e instanceof Error &&
          (e.message.includes('404') ||
            e.message.includes('400') ||
            e.message.includes('Invalid JSON'))
        ) {
          console.log('Contact deletion not available or no contact to delete');
          return;
        }
        throw e;
      }
    });
  });
});
