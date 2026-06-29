/**
 * Shell-host smoke for the routes migrated into the shared rail shell in
 * Phase 4f–4g: `/favourites` (ShellSectionPage) and `/interfaces` (rail-chrome
 * only). Verifies the persistent rail renders beside each route body and that
 * the route is reachable inside the shell (no redirect to /login or the error
 * boundary). The user is seeded into a `Unify` org so `/interfaces` (gated to
 * Unify members) is accessible.
 *
 * Run: npx playwright test src/tests/shell/route-shell-smoke.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createOrg,
  deleteOrg,
  dbExec,
  createAssistantTest,
} from '../assistants/helpers';

const user = createTestUser({ name: 'ShellRoutes', lastName: 'Smoke', credits: 50_000 });
// The `organization.name` column is globally unique; clear any `Unify` org left
// behind by an earlier run before seeding a fresh one for this user.
dbExec("DELETE FROM organization WHERE name = 'Unify';");
const unifyOrg = createOrg({ ownerId: user.id, name: 'Unify', credits: 50_000 });

const test = createAssistantTest(user);
test.setTimeout(90_000);

test.afterAll(() => {
  deleteOrg(unifyOrg.id);
  cleanupUser(user.id);
});

test('/favourites renders inside the rail shell with its section header', async ({
  authedPage: page,
}) => {
  await page.goto('/favourites');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  await expect(page).toHaveURL(/\/favourites/);
  await expect(page.getByTestId('assistant-rail')).toBeVisible({ timeout: 15_000 });
  // Page body heading (TabHeader also shows the section label in the rail chrome).
  await expect(page.getByRole('heading', { name: 'Favourites' })).toBeVisible();
  // Favourites body streamed in.
  await expect(page.getByText('Available Projects')).toBeVisible({ timeout: 15_000 });

  await page.screenshot({ path: '/tmp/shell-favourites.png', fullPage: false });
});

test('/interfaces renders inside the rail shell for a Unify member', async ({
  authedPage: page,
}) => {
  await page.goto('/interfaces');
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});

  // Unify members are not redirected to /assistants, and we stay out of /login.
  await expect(page).toHaveURL(/\/interfaces/);
  await expect(page.getByTestId('assistant-rail')).toBeVisible({ timeout: 20_000 });

  await page.screenshot({ path: '/tmp/shell-interfaces.png', fullPage: false });
});
