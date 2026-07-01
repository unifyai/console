/**
 * Shell-host smoke for routed app-shell surfaces: `/favourites`
 * (ShellSectionPage) and `/interfaces` (rail chrome only). Verifies the
 * persistent rail renders beside each route body and that the route is reachable
 * inside the shell (no redirect to /login or the error boundary). The user is
 * seeded into a `Unify` org so `/interfaces` (gated to Unify members) is
 * accessible.
 *
 * Run: npx playwright test src/tests/shell/route-shell-smoke.e2e.ts
 */

import { expect } from '@playwright/test';
import { createTestUser, cleanupUser, createAssistantTest } from '../assistants/helpers';
import { ensureUnifyOrg } from '../helpers/seeds/client';

const user = createTestUser({ name: 'ShellRoutes', lastName: 'Smoke', credits: 50_000 });
ensureUnifyOrg({ memberId: user.id, credits: 50_000 });

const test = createAssistantTest(user);
test.setTimeout(90_000);

test.afterAll(() => {
  cleanupUser(user.id);
});

test('/favourites renders inside the rail shell with its section header', async ({
  authedPage: page,
}) => {
  await page.goto('/favourites');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  await expect(page).toHaveURL(/\/favourites/);
  await expect(page.getByTestId('assistant-rail').first()).toBeVisible({ timeout: 15_000 });
  // Page body heading (TabHeader also shows the section label in the rail chrome).
  await expect(page.getByRole('heading', { name: 'Favourites' })).toBeVisible();
  // Favourites body streamed in.
  await expect(page.getByText('Available Projects')).toBeVisible({ timeout: 15_000 });
});

test('/interfaces renders inside the rail shell for a Unify member', async ({
  authedPage: page,
}) => {
  await page.goto('/interfaces', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/interfaces/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  await expect(page.getByTestId('assistant-rail').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('project-picker-trigger')).toBeVisible({ timeout: 25_000 });
});
