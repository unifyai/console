/**
 * Shell-host smoke for routed app-shell surfaces: `/favourites`
 * (ShellSectionPage) and `/interfaces` (rail chrome only). Verifies the
 * persistent rail renders beside each route body and that the route is reachable
 * inside the shell (no redirect to /login or the error boundary). The user is
 * seeded into a `Unify` org with a unify.ai mailbox — both signals the
 * `/interfaces` staff gate requires.
 *
 * Run: npx playwright test src/tests/shell/route-shell-smoke.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  deferCoordinatorOnboarding,
  dismissCoordinatorOnboardingIfOpen,
  getCoordinatorAgentId,
  ensureProjectSync,
} from '../assistants/helpers';
import { ensureUnifyOrg } from '../helpers/seeds/client';
import { assistantRail } from '../helpers/shell';

const user = createTestUser({
  name: 'ShellRoutes',
  lastName: 'Smoke',
  credits: 50_000,
  email: `shell-routes-staff-${Date.now()}@unify.ai`,
});
ensureUnifyOrg({ memberId: user.id, credits: 50_000 });
ensureProjectSync(user.apiKey);

const test = createAssistantTest(user);
test.setTimeout(180_000);

async function gotoAppShellRoute(page: import('@playwright/test').Page, path: string) {
  // domcontentloaded only — AppShell keeps Main mounted (hidden) on library
  // routes, and its SSE/chat traffic prevents networkidle from ever settling.
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await dismissCoordinatorOnboardingIfOpen(page);
}

test.beforeAll(async () => {
  createAssistant({ userId: user.id, firstName: 'Shell', surname: 'Route' });
  const coordinatorId = getCoordinatorAgentId(user.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(user.apiKey, coordinatorId);
  }
});

test.afterAll(() => {
  cleanupUser(user.id);
});

test('/favourites renders inside the rail shell with its section header @push @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  await gotoAppShellRoute(page, '/favourites');

  await expect(page).toHaveURL(/\/favourites/);
  await expect(assistantRail(page)).toBeVisible({ timeout: 15_000 });
  // Page title paints with the shell (outside Suspense). TabHeader also shows
  // the section label in the rail chrome, but as a span, not a heading.
  await expect(page.getByRole('heading', { name: 'Favourites' })).toBeVisible({
    timeout: 15_000,
  });
  // Project lists stream in after the server fetch.
  await expect(page.getByText('Available Projects')).toBeVisible({ timeout: 45_000 });
});

test('/interfaces renders inside the rail shell for a Unify member @push @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  await gotoAppShellRoute(page, '/interfaces');

  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });
  // Project picker is part of the interfaces nav chrome; interface picker only mounts when
  // the selected project has at least one interface.
  await expect(page.getByTestId('project-picker-trigger')).toBeVisible({ timeout: 25_000 });
});
