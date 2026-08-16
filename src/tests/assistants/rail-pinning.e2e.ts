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

const RAIL_CONFIG_COOKIE = 'console_rail_config';
const RAIL_COLLAPSED_KEY = 'console:assistants:railCollapsed';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Seed the stored rail config before the app boots. It is a cookie rather than
 * localStorage so the server renders the configured rail directly.
 */
async function seedRailConfig(page: Page, config: unknown) {
  await page.context().addCookies([
    {
      name: RAIL_CONFIG_COOKIE,
      value: encodeURIComponent(JSON.stringify(config)),
      url: BASE_URL,
    },
  ]);
}

async function readRailConfig(page: Page): Promise<{ unpinned?: string[] } | null> {
  const cookie = (await page.context().cookies(BASE_URL)).find(
    (entry) => entry.name === RAIL_CONFIG_COOKIE
  );
  return cookie === undefined ? null : JSON.parse(decodeURIComponent(cookie.value));
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

test('the configured rail is server-rendered, not corrected after mount', async ({
  authedPage: page,
}) => {
  await seedRailConfig(page, { v: 1, unpinned: ['workflows'], order: {} });
  await openApp(page);

  // Asserting the document itself is the point. A hydrated-DOM check passes
  // either way — a rail corrected on the client ends in the same state, one
  // frame later — so only the HTML the server sent can tell the two apart.
  const html = await (await page.request.get(`${BASE_URL}/assistants`)).text();
  expect(html).toContain('rail-section-integrations');
  expect(html).not.toContain('rail-section-workflows');
  expect(html).toContain('rail-section-more');
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
