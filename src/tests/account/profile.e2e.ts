/**
 * User Profile E2E — view profile, edit fields, verify eager (auto) persistence.
 *
 * The profile tab has no explicit Save button: text fields persist on blur via
 * a partial PATCH to `/api/user/update-profile`. These tests blur the field and
 * assert the resulting DB state (UI alone can be optimistic).
 *
 * Run: npx playwright test src/tests/account/profile.e2e.ts
 */

import { expect } from '@playwright/test';
import { createTestUser, cleanupUser, createAccountTest, getUserFromDb, dbExec } from './helpers';

const user = createTestUser({ name: 'Profile', lastName: 'Tester', credits: 5_000 });
const test = createAccountTest(user);

test.afterAll(() => cleanupUser(user.id));

/** Blur the given field and wait for the eager auto-save round-trip to land. */
async function blurAndWaitForSave(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator
) {
  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/api/user/update-profile') && resp.status() === 200,
      { timeout: 15_000 }
    ),
    locator.blur(),
  ]);
  // Wait for the status indicator / React re-render after save.
  await page.waitForTimeout(500);
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

test('editing profile name auto-saves to the database on blur', async ({ authedPage: page }) => {
  const newName = `Edited${Date.now()}`;

  await page.goto('/account?tab=profile');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });

  await nameInput.fill(newName);
  await blurAndWaitForSave(page, nameInput);

  // The auto-save indicator confirms the write without an explicit Save click.
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

  const dbUser = getUserFromDb(user.id);
  expect(dbUser.name).toBe(newName);
});

test('there is no explicit Save button on the profile tab', async ({ authedPage: page }) => {
  await page.goto('/account?tab=profile');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });

  await nameInput.fill(`NoButton${Date.now()}`);
  // Editing must not surface a Save/Cancel bar — saving is eager.
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
});

test('auto-saved profile name persists after page reload', async ({ authedPage: page }) => {
  const uniqueName = `Persist${Date.now()}`;

  await page.goto('/account?tab=profile');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });

  await nameInput.fill(uniqueName);
  await blurAndWaitForSave(page, nameInput);

  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const reloadedInput = page.locator('input[name="name"]');
  await expect(reloadedInput).toBeVisible({ timeout: 15_000 });

  expect(await reloadedInput.inputValue()).toBe(uniqueName);
});

test('editing last name auto-saves to the database on blur', async ({ authedPage: page }) => {
  const newLast = `Last${Date.now()}`;

  await page.goto('/account?tab=profile');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const lastNameInput = page.locator('input[name="lastName"]');
  await expect(lastNameInput).toBeVisible({ timeout: 15_000 });

  await lastNameInput.fill(newLast);
  await blurAndWaitForSave(page, lastNameInput);

  const dbUser = getUserFromDb(user.id);
  expect(dbUser.lastName).toBe(newLast);
});

test('removing the profile photo unsets the database image', async ({ authedPage: page }) => {
  dbExec(`UPDATE "user" SET image = '/brand/chat-bg.svg' WHERE id = '${user.id}'`);

  await page.goto('/account?tab=profile');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  await page.getByRole('button', { name: /profile photo/i }).click();

  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/api/user/photo') && resp.request().method() === 'DELETE',
      { timeout: 15_000 }
    ),
    page.getByRole('menuitem', { name: /remove/i }).click(),
  ]);

  expect(getUserFromDb(user.id).image).toBeNull();
});
