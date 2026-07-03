/**
 * Session Handling E2E — stale session signout.
 *
 * Run: npx playwright test src/tests/auth/session.e2e.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  loginAndWaitForRedirect,
  switchToEmailTab,
  type TestUser,
} from './helpers';

test.describe('Stale Session Signout', () => {
  let user: TestUser;

  test.beforeAll(() => {
    user = createTestUser({ name: 'Stale', lastName: 'Session' });
  });

  test.afterAll(() => {
    cleanupUser(user.id);
  });

  test('clears session and shows login form when signout=true with active session @push @critical @area(auth.core)', async ({
    page,
  }) => {
    await page.goto('/login');
    await loginAndWaitForRedirect(page, user.email, user.password, 15_000);

    await page.goto('/login?signout=true');
    await page.waitForURL((url) => url.pathname === '/login' && !url.searchParams.has('signout'), {
      timeout: 15000,
    });

    await switchToEmailTab(page);
    await expect(page.getByTestId('email-login-form')).toBeVisible();
  });
});
