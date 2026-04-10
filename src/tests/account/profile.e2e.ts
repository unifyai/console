/**
 * User Profile E2E — view profile, edit name, verify persistence.
 *
 * Run: npx playwright test src/tests/account/profile.e2e.ts
 */

import { expect } from '@playwright/test';
import { createTestUser, cleanupUser, createAccountTest, getUserFromDb } from './helpers';

const user = createTestUser({ name: 'Profile', lastName: 'Tester', credits: 5_000 });
const test = createAccountTest(user);

test.afterAll(() => cleanupUser(user.id));

async function saveProfileAndWait(page: import('@playwright/test').Page) {
  const saveBtn = page.getByRole('button', { name: 'Save' });
  await expect(saveBtn).toBeVisible({ timeout: 5_000 });

  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/api/profile/updateUser') && resp.status() === 200,
      { timeout: 15_000 }
    ),
    saveBtn.click(),
  ]);

  // Wait for React re-render after save
  await page.waitForTimeout(1_000);
}

test('profile page displays the user name matching DB', async ({ authedPage: page }) => {
  await page.goto('/account?tab=profile');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });

  const displayedName = await nameInput.inputValue();
  const dbUser = getUserFromDb(user.id);

  expect(displayedName).toBe(dbUser.name);
});

test('editing and saving profile name persists to the database', async ({ authedPage: page }) => {
  const newName = `Edited${Date.now()}`;

  await page.goto('/account?tab=profile');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });

  await nameInput.fill(newName);
  await saveProfileAndWait(page);

  const dbUser = getUserFromDb(user.id);
  expect(dbUser.name).toBe(newName);
});

test('saved profile name persists after page reload', async ({ authedPage: page }) => {
  const uniqueName = `Persist${Date.now()}`;

  await page.goto('/account?tab=profile');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });

  await nameInput.fill(uniqueName);
  await saveProfileAndWait(page);

  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const reloadedInput = page.locator('input[name="name"]');
  await expect(reloadedInput).toBeVisible({ timeout: 15_000 });

  expect(await reloadedInput.inputValue()).toBe(uniqueName);
});

test('editing last name and saving persists to the database', async ({ authedPage: page }) => {
  const newLast = `Last${Date.now()}`;

  await page.goto('/account?tab=profile');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const lastNameInput = page.locator('input[name="lastName"]');
  await expect(lastNameInput).toBeVisible({ timeout: 15_000 });

  await lastNameInput.fill(newLast);
  await saveProfileAndWait(page);

  const dbUser = getUserFromDb(user.id);
  expect(dbUser.lastName).toBe(newLast);
});
