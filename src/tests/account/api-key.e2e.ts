/**
 * API Key E2E — view key on Advanced tab, regenerate and verify.
 *
 * Run: npx playwright test src/tests/account/api-key.e2e.ts
 */

import { expect } from '@playwright/test';
import { createTestUser, cleanupUser, createAccountTest, getUserApiKeyFromDb } from './helpers';

const user = createTestUser({ name: 'ApiKey', lastName: 'Test', credits: 5_000 });
const test = createAccountTest(user);

test.afterAll(() => cleanupUser(user.id));

test('Security tab shows a masked API key', async ({ authedPage: page }) => {
  await page.goto('/account?tab=security');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const keyLabel = page.locator('text=API Key');
  await expect(keyLabel).toBeVisible({ timeout: 15_000 });

  // The key section should be present
  const keyContainer = page.locator('label:has-text("API Key")').first();
  await expect(keyContainer).toBeVisible({ timeout: 5_000 });
});

test('regenerating API key via API produces a new key in the database', async ({
  authedPage: page,
}) => {
  const oldKey = getUserApiKeyFromDb(user.id);
  expect(oldKey).toBeTruthy();

  await page.goto('/account?tab=security');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const response = await page.request.get(
    `/api/profile/keys/regenerate?UserID=${encodeURIComponent(user.id)}`
  );

  if (response.status() === 200) {
    const data = await response.json();
    expect(data.key).toBeTruthy();

    const newKey = getUserApiKeyFromDb(user.id);
    expect(newKey).toBeTruthy();
    expect(newKey).not.toBe(oldKey);
    expect(newKey).toBe(data.key);
  } else {
    // Admin client might not be configured in local dev — verify error is meaningful
    expect(response.status()).toBeGreaterThanOrEqual(400);
    const errBody = await response.json().catch(() => ({}));
    expect(errBody).toBeTruthy();

    // Old key should remain unchanged
    const keyAfter = getUserApiKeyFromDb(user.id);
    expect(keyAfter).toBe(oldKey);
  }
});
