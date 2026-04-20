/**
 * Timezone Sync E2E — verifies the global TimezoneSync component:
 *  - silently fixes empty timezones for new users
 *  - auto-updates mismatched timezones for existing users + shows Undo toast
 *  - reverts when Undo is clicked AND remembers the dismissal so the same
 *    browser timezone is not auto-applied again on subsequent loads
 *  - leaves matching timezones untouched
 *
 * Each test creates a Playwright context with an explicit `timezoneId`
 * (overriding the test machine's local timezone) so we can deterministically
 * assert what the component does with mismatches.
 *
 * Run: npx playwright test src/tests/account/timezone-sync.e2e.ts
 */

import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { createTestUser, cleanupUser, getUserFromDb, loginAndSaveState, dbExec } from './helpers';

const user = createTestUser({ name: 'TZ', lastName: 'Sync', credits: 5_000 });

/** Set the user's timezone column directly (bypasses the API). */
function setUserTimezoneInDb(userId: string, timezone: string | null) {
  const value = timezone === null ? 'NULL' : `'${timezone}'`;
  dbExec(`UPDATE "user" SET timezone = ${value} WHERE id = '${userId}'`);
}

/**
 * Custom fixture: gives each test its own context where we control the
 * browser timezone. Login state is shared across tests via storageState
 * (login happens once and is reused) so we don't pay the auth cost per test.
 *
 * Note: the very first login may itself trigger TimezoneSync on the throwaway
 * login context. That's fine — every test resets the user's timezone in the
 * DB *before* opening its own context, so the initial login has no effect on
 * what each test sees.
 */
let cachedAuthFile: string | undefined;

const test = base.extend<{
  contextWithTimezone: (timezoneId: string) => Promise<Page>;
}>({
  contextWithTimezone: async ({ browser }, use, testInfo) => {
    const openedContexts: BrowserContext[] = [];

    const open = async (timezoneId: string) => {
      if (!cachedAuthFile) {
        testInfo.setTimeout(testInfo.timeout + 30_000);
        cachedAuthFile = await loginAndSaveState(browser as Browser, user.email, user.password);
      }
      const ctx = await browser.newContext({
        storageState: cachedAuthFile,
        timezoneId,
      });
      const page = await ctx.newPage();
      openedContexts.push(ctx);
      return page;
    };

    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(open);

    for (const ctx of openedContexts) {
      await ctx.close().catch(() => {});
    }
  },
});

test.afterAll(() => cleanupUser(user.id));

/**
 * Wait for the TimezoneSync POST to /api/user/update-profile to complete (or
 * for a short grace period to elapse if no request is expected).
 */
async function waitForSyncAttempt(page: Page, opts: { expected: boolean }) {
  if (opts.expected) {
    await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/user/update-profile') && resp.request().method() === 'POST',
      { timeout: 10_000 }
    );
    // Give React a beat to run any post-update side effects (toast, refresh)
    await page.waitForTimeout(500);
  } else {
    // No request expected — wait long enough that any pending request would have fired.
    await page.waitForTimeout(2_000);
  }
}

test('silently sets timezone for users with no prior value (no toast)', async ({
  contextWithTimezone,
}) => {
  setUserTimezoneInDb(user.id, null);
  const page = await contextWithTimezone('Asia/Tokyo');

  await page.goto('/');
  await waitForSyncAttempt(page, { expected: true });

  expect(getUserFromDb(user.id).timezone).toBe('Asia/Tokyo');

  // No undo prompt for fresh users — the toast should never appear.
  const toast = page.locator('[data-sonner-toast]').first();
  await expect(toast).toHaveCount(0);
});

test('does nothing when account timezone already matches the browser', async ({
  contextWithTimezone,
}) => {
  setUserTimezoneInDb(user.id, 'America/Los_Angeles');
  const page = await contextWithTimezone('America/Los_Angeles');

  await page.goto('/');
  await waitForSyncAttempt(page, { expected: false });

  expect(getUserFromDb(user.id).timezone).toBe('America/Los_Angeles');
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
});

test('auto-updates mismatched timezone and shows an Undo toast', async ({
  contextWithTimezone,
}) => {
  setUserTimezoneInDb(user.id, 'America/New_York');
  const page = await contextWithTimezone('Europe/London');

  await page.goto('/');
  await waitForSyncAttempt(page, { expected: true });

  expect(getUserFromDb(user.id).timezone).toBe('Europe/London');

  const toast = page.locator('[data-sonner-toast][data-type="info"]').first();
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(toast).toContainText('Timezone updated to London');
  await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible();
});

test('clicking Undo restores the previous timezone', async ({ contextWithTimezone }) => {
  setUserTimezoneInDb(user.id, 'America/Chicago');
  const page = await contextWithTimezone('Europe/Paris');

  await page.goto('/');
  await waitForSyncAttempt(page, { expected: true });
  expect(getUserFromDb(user.id).timezone).toBe('Europe/Paris');

  const toast = page.locator('[data-sonner-toast][data-type="info"]').first();
  await expect(toast).toBeVisible({ timeout: 5_000 });

  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/user/update-profile') && resp.request().method() === 'POST',
      { timeout: 10_000 }
    ),
    toast.getByRole('button', { name: 'Undo' }).click(),
  ]);

  await expect
    .poll(() => getUserFromDb(user.id).timezone, { timeout: 5_000 })
    .toBe('America/Chicago');
});

test('after Undo, the same browser timezone is not auto-applied again', async ({
  contextWithTimezone,
}) => {
  setUserTimezoneInDb(user.id, 'America/Denver');
  const page = await contextWithTimezone('Europe/Berlin');

  // First load → mismatch detected → updated → toast shown.
  await page.goto('/');
  await waitForSyncAttempt(page, { expected: true });
  const toast = page.locator('[data-sonner-toast][data-type="info"]').first();
  await expect(toast).toBeVisible({ timeout: 5_000 });

  // Undo → reverts AND records Europe/Berlin as a dismissed browser TZ in localStorage.
  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/user/update-profile') && resp.request().method() === 'POST',
      { timeout: 10_000 }
    ),
    toast.getByRole('button', { name: 'Undo' }).click(),
  ]);
  await expect
    .poll(() => getUserFromDb(user.id).timezone, { timeout: 5_000 })
    .toBe('America/Denver');

  // Reload the page in the SAME context (so localStorage AND sessionStorage carry over).
  // Manually clear the session flag to simulate a fresh session while keeping the
  // dismissal localStorage entry — this exercises the cross-session dismissal path.
  await page.evaluate(() => sessionStorage.removeItem('tz-sync-checked'));
  await page.reload();
  await waitForSyncAttempt(page, { expected: false });

  expect(getUserFromDb(user.id).timezone).toBe('America/Denver');
});
