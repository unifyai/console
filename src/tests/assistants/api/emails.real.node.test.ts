/**
 * Real API tests for Assistant Emails endpoint.
 *
 * Tests the /api/assistant/emails endpoint which returns
 * email addresses of all assistants owned by the user.
 *
 * Run with: npm run test:api
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { emailsApi, realTestOptions, skipIfServerNotReachable } from './fixtures/api-actions';

describe('@real Assistant Emails API', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  it('@real lists assistant emails', realTestOptions, async () => {
    const result = await emailsApi.list();

    expect(result).toBeDefined();
    expect(result.emails).toBeDefined();
    expect(Array.isArray(result.emails)).toBe(true);

    // Each email should be a string
    for (const email of result.emails) {
      expect(typeof email).toBe('string');
      if (email.length > 0) {
        expect(email).toContain('@');
      }
    }
  });

  it('@real returns camelCase response properties', realTestOptions, async () => {
    const result = await emailsApi.list();

    // Verify we get camelCase, not snake_case
    expect(result).toHaveProperty('emails');
    expect(result).not.toHaveProperty('email_list');
    expect(result).not.toHaveProperty('assistant_emails');
  });
});
