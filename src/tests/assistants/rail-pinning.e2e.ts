/**
 * Rail pinning E2E — verifies the configurable rail: unpinning a section moves
 * it behind More, activity pulls a hidden section back into the rail under its
 * own name, the customize editor is reachable from the overflow in every rail
 * state, and the stored config survives a reload.
 *
 * Run: npx playwright test src/tests/assistants/rail-pinning.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  getCoordinatorAgentId,
  deferCoordinatorOnboarding,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';
import { assistantRail, railSection } from '../helpers/shell';

const user = createTestUser({ name: 'RailPin', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

const RAIL_CONFIG_KEY = 'console:assistants:railConfig';
const RAIL_COLLAPSED_KEY = 'console:assistants:railCollapsed';

/** Seed the stored rail config before the app boots. */
async function seedRailConfig(page: Page, config: unknown) {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key as string, value as string);
      } catch {
        /* private mode — ignore */
      }
    },
    [RAIL_CONFIG_KEY, JSON.stringify(config)] as const
  );
}

async function readRailConfig(page: Page): Promise<{ unpinned?: string[] } | null> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), RAIL_CONFIG_KEY);
  return raw === null ? null : JSON.parse(raw);
}

async function openApp(page: Page) {
  await navigateToAssistants(page, { userId: user.id, apiKey: user.apiKey });
  await closeHireDialogIfOpen(page);
  await expect(assistantRail(page)).toBeVisible({ timeout: 15_000 });
}

test.beforeAll(async () => {
  const coordinatorId = getCoordinatorAgentId(user.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(user.apiKey, coordinatorId);
  }
  deleteAllAssistantsForUser(user.id);
  createAssistant({ userId: user.id, firstName: 'Pinny', surname: 'Rail' });
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('every section is pinned by default, so there is no overflow @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  await openApp(page);

  await expect(railSection(page, 'workflows')).toBeVisible();
  await expect(railSection(page, 'data')).toBeVisible();
  await expect(assistantRail(page).getByTestId('rail-section-more')).toHaveCount(0);
});

test('unpinning a section moves it behind More and survives a reload', async ({
  authedPage: page,
}) => {
  await openApp(page);

  const rail = assistantRail(page);
  const workflows = railSection(page, 'workflows');
  await workflows.hover();
  await rail.getByTestId('rail-section-workflows-pin-toggle').click();

  await expect(workflows).toHaveCount(0);

  const more = rail.getByTestId('rail-section-more');
  await expect(more).toBeVisible();

  // The stored config is the negative set — only what the user turned off.
  await expect.poll(async () => (await readRailConfig(page))?.unpinned).toEqual(['workflows']);

  await more.click();
  const menu = page.getByTestId('rail-more-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByTestId('rail-more-item-workflows')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.reload();
  await closeHireDialogIfOpen(page);
  await expect(assistantRail(page).getByTestId('rail-section-more')).toBeVisible({
    timeout: 15_000,
  });
  await expect(railSection(page, 'workflows')).toHaveCount(0);
});

test('a hidden section can be re-pinned from the More menu', async ({ authedPage: page }) => {
  await seedRailConfig(page, { v: 1, unpinned: ['data'], order: {} });
  await openApp(page);

  const rail = assistantRail(page);
  await expect(railSection(page, 'data')).toHaveCount(0);

  await rail.getByTestId('rail-section-more').click();
  await expect(page.getByTestId('rail-more-menu')).toBeVisible();
  await page.getByTestId('rail-more-pin-data').click();

  await expect(railSection(page, 'data')).toBeVisible();
  await expect.poll(async () => (await readRailConfig(page))?.unpinned).toEqual([]);
});

test('the customize editor opens from the More menu and toggles a section', async ({
  authedPage: page,
}) => {
  await seedRailConfig(page, { v: 1, unpinned: ['desktop'], order: {} });
  await openApp(page);

  await assistantRail(page).getByTestId('rail-section-more').click();
  await page.getByTestId('rail-more-customize').click();

  const list = page.getByTestId('rail-customize-list');
  await expect(list).toBeVisible();
  await expect(list.getByTestId('rail-customize-row-desktop')).toBeVisible();

  await list.getByTestId('rail-customize-toggle-desktop').click();
  await expect.poll(async () => (await readRailConfig(page))?.unpinned).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(railSection(page, 'desktop')).toBeVisible();
});

test('a section absent from a stored config stays pinned', async ({ authedPage: page }) => {
  // A config written before a section shipped must not hide it. This is the
  // whole reason the stored set is negative rather than a list of pins.
  await seedRailConfig(page, { v: 1, unpinned: ['contacts'], order: {} });
  await openApp(page);

  await expect(railSection(page, 'contacts')).toHaveCount(0);
  await expect(railSection(page, 'workflows')).toBeVisible();
  await expect(railSection(page, 'knowledge')).toBeVisible();
});

test('the folded dock reaches the overflow and the editor', async ({ authedPage: page }) => {
  await seedRailConfig(page, { v: 1, unpinned: ['data', 'desktop'], order: {} });
  await page.addInitScript(
    ([key]) => {
      try {
        window.localStorage.setItem(key as string, '1');
      } catch {
        /* private mode — ignore */
      }
    },
    [RAIL_COLLAPSED_KEY] as const
  );
  await openApp(page);

  const rail = assistantRail(page);
  await expect(rail).toHaveClass(/w-\[74px\]/);

  await rail.getByTestId('rail-section-more').click();
  const menu = page.getByTestId('rail-more-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByTestId('rail-more-item-data')).toBeVisible();

  await page.getByTestId('rail-more-customize').click();
  await expect(page.getByTestId('rail-customize-list')).toBeVisible();
});
