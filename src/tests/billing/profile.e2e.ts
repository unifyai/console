/**
 * Billing Profile E2E — open dialog, edit, save, validation, persistence.
 *
 * Run: npx playwright test src/tests/billing/profile.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import { createTestUser, cleanupUser, createBillingTest } from './helpers';

async function openProfileDialog(page: Page) {
  const section = page.getByTestId('billing-profile-section');
  await expect(section).toBeVisible({ timeout: 20_000 });

  await section.getByRole('button', { name: 'Edit' }).click();

  await expect(page.getByRole('heading', { name: 'Edit Billing Profile' })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('#billingName')).toBeVisible({ timeout: 15_000 });
}

async function fillRequiredAddress(page: Page) {
  await page.locator('#addrLine1').fill('123 Test St');
  await page.locator('#addrCity').fill('San Francisco');
  await page.locator('#addrPostal').fill('94105');
  await page.locator('#addrCountry').click();
  await page.getByRole('option', { name: 'United States' }).click();
}

const user = createTestUser({ name: 'Profile', lastName: 'Test', credits: 5_000 });
const test = createBillingTest(user, { skipWhenManualTopup: true });

test.afterAll(() => cleanupUser(user.id));

test('opens and closes the profile dialog via cancel', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await openProfileDialog(page);

  await expect(page.locator('#billingName')).toBeVisible();
  await expect(page.locator('#billingEmail')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#billingName')).not.toBeVisible({ timeout: 5_000 });
});

test('save button is disabled when name is empty', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await openProfileDialog(page);

  await page.locator('#billingName').fill('');

  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeDisabled({
    timeout: 5_000,
  });
});

test('saves billing name and closes dialog', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await openProfileDialog(page);

  await page.locator('#billingName').fill('Test Business Inc.');
  await page.locator('#billingEmail').fill('billing@test.com');
  await fillRequiredAddress(page);
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.locator('#billingName')).not.toBeVisible({ timeout: 15_000 });
});

test('persists saved name across page reloads', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await openProfileDialog(page);

  const uniqueName = `Persistent Biz ${Date.now()}`;
  await page.locator('#billingName').fill(uniqueName);
  await fillRequiredAddress(page);
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('#billingName')).not.toBeVisible({ timeout: 15_000 });

  await page.reload();
  await openProfileDialog(page);

  await expect(page.locator('#billingName')).toHaveValue(uniqueName);
});
