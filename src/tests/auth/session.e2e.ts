/**
 * Session Handling E2E — authenticated redirects, stale session signout,
 * token forwarding through login flows.
 *
 * Run: npx playwright test src/tests/auth/session.e2e.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  login,
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

  test('shows login form when signout=true and no session exists', async ({ page }) => {
    await page.goto('/login?signout=true');

    // The signout handler processes (even with no session), then redirects to /login
    await page.waitForURL((url) => url.pathname === '/login' && !url.searchParams.has('signout'), {
      timeout: 15000,
    });

    await switchToEmailTab(page);
    await expect(page.getByTestId('email-login-form')).toBeVisible({ timeout: 10000 });
  });

  test('clears session and shows login form when signout=true with active session', async ({
    page,
  }) => {
    // Login first
    await page.goto('/login');
    await loginAndWaitForRedirect(page, user.email, user.password, 15_000);

    // Now visit /login?signout=true to simulate a stale session clear
    await page.goto('/login?signout=true');

    // Should eventually show the login form after clearing the session
    await page.waitForURL((url) => url.pathname === '/login' && !url.searchParams.has('signout'), {
      timeout: 15000,
    });

    await switchToEmailTab(page);
    await expect(page.getByTestId('email-login-form')).toBeVisible();
  });

  test('preserves credit token through signout redirect', async ({ page }) => {
    await page.goto('/login');
    await loginAndWaitForRedirect(page, user.email, user.password, 15_000);

    // Simulate stale session with a credit token
    await page.goto('/login?signout=true&credit=test-credit-token');

    // After signout, the credit token should be preserved in the URL
    await page.waitForURL((url) => url.pathname === '/login' && !url.searchParams.has('signout'), {
      timeout: 15000,
    });

    expect(page.url()).toContain('credit=test-credit-token');
  });
});

test.describe('View Transitions', () => {
  test('switches between login, register, verify, and forgot-password views', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);

    // Start on login
    await expect(page.getByTestId('email-login-form')).toBeVisible();

    // Login → Register
    await page.getByTestId('switch-to-register').click();
    await expect(page.getByTestId('email-register-form')).toBeVisible();

    // Register → Login
    await page.getByTestId('switch-to-login').click();
    await expect(page.getByTestId('email-login-form')).toBeVisible();

    // Login → Forgot Password
    await page.getByTestId('forgot-password-link').click();
    await expect(page.getByTestId('forgot-password-form')).toBeVisible();

    // Forgot Password → Login
    await page.getByTestId('back-to-login-link').click();
    await expect(page.getByTestId('email-login-form')).toBeVisible();
  });
});
