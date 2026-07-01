/**
 * API Key E2E — view key on Security tab, reveal toggle, regenerate via API.
 *
 * Run: npx playwright test src/tests/account/api-key.e2e.ts
 */

import { expect } from '@playwright/test';
import { createTestUser, cleanupUser, createAccountTest, getUserApiKeyFromDb } from './helpers';

const user = createTestUser({ name: 'ApiKey', lastName: 'Test', credits: 5_000 });
const test = createAccountTest(user);

test.afterAll(() => cleanupUser(user.id));

async function openSecurityTab(page: import('@playwright/test').Page) {
  await page.goto('/account?tab=security');
  await expect(page.getByText('API access')).toBeVisible({ timeout: 15_000 });
}

test('Security tab masks the API key until revealed', async ({ authedPage: page }) => {
  const dbKey = getUserApiKeyFromDb(user.id);
  expect(dbKey).toBeTruthy();

  await openSecurityTab(page);

  const keySection = page
    .locator('text=API access')
    .locator('xpath=ancestor::div[contains(@class,"rounded-lg")]');
  const keyInput = keySection.locator('input').first();
  await expect(keyInput).toBeVisible({ timeout: 10_000 });
  await expect(keyInput).toHaveValue(/^•+$/);

  await keySection.getByRole('button').click();
  await expect(keyInput).toHaveValue(dbKey);
});

test('regenerating API key produces a new key in the database', async ({ authedPage: page }) => {
  const oldKey = getUserApiKeyFromDb(user.id);
  expect(oldKey).toBeTruthy();

  await openSecurityTab(page);

  const response = await page.request.get(
    `/api/profile/keys/regenerate?UserID=${encodeURIComponent(user.id)}`
  );
  expect(response.status()).toBe(200);

  const data = await response.json();
  expect(data.key).toBeTruthy();
  expect(data.key).not.toBe(oldKey);

  const newKey = getUserApiKeyFromDb(user.id);
  expect(newKey).toBe(data.key);
});
