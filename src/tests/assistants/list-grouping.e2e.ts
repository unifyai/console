/**
 * Assistant List Grouping E2E — verifies the sidebar groups colleagues by
 * spaces without turning the selected right pane into a space-scoped view.
 *
 * Run: npx playwright test src/tests/assistants/list-grouping.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  createSpaceForAssistant,
  addAssistantToSpace,
  navigateToAssistants,
  closeHireDialogIfOpen,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';

function uniqueGroupingEmail(): string {
  return `list-grouping-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueGroupingEmail(),
  name: 'ListGrouping',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

const patchAssistant = createAssistant({
  userId: user.id,
  firstName: 'Patch',
  surname: 'Only',
});
const multiAssistant = createAssistant({
  userId: user.id,
  firstName: 'Mina',
  surname: 'Multi',
});
const soloAssistant = createAssistant({
  userId: user.id,
  firstName: 'Solo',
  surname: 'Only',
});

const patchAlpha = createSpaceForAssistant(patchAssistant, {
  name: 'Patch Alpha',
  description: 'Patch Alpha sidebar grouping coverage space.',
  selfContactId: 801,
  bossContactId: 802,
});
const patchBeta = createSpaceForAssistant(multiAssistant, {
  name: 'Patch Beta',
  description: 'Patch Beta sidebar grouping coverage space.',
  selfContactId: 901,
  bossContactId: 902,
});
addAssistantToSpace(multiAssistant, patchAlpha, {
  selfContactId: 903,
  bossContactId: 904,
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('groups colleagues by space and keeps row selection assistant-scoped', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const spacesSection = page.getByTestId('assistant-list-section-spaces');
  const soloSection = page.getByTestId('assistant-list-section-solo');
  await expect(spacesSection.getByRole('button', { name: /Teams/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(soloSection.getByRole('button', { name: /Independent colleagues.*1/ })).toBeVisible({
    timeout: 10_000,
  });

  const patchAlphaHeader = page.getByRole('button', { name: /Patch Alpha/ });
  const patchBetaHeader = page.getByRole('button', { name: /Patch Beta/ });
  await expect(patchAlphaHeader).toBeVisible({ timeout: 15_000 });
  await expect(patchBetaHeader).toBeVisible({ timeout: 10_000 });
  await expect(soloSection.getByText('Solo Only')).toBeVisible();

  const patchAlphaGroup = page.getByTestId(`assistant-list-group-space:${patchAlpha.spaceId}`);
  const patchBetaGroup = page.getByTestId(`assistant-list-group-space:${patchBeta.spaceId}`);

  await expect(patchAlphaGroup.getByText('Patch Only')).toBeVisible();
  await expect(
    patchAlphaGroup.getByTestId(`assistant-list-item-${multiAssistant.agentId}`)
  ).toBeVisible();
  await patchAlphaHeader.hover();
  await expect(
    page.getByRole('tooltip', { name: 'Patch Alpha sidebar grouping coverage space.' })
  ).toBeVisible();

  const secondaryListing = patchBetaGroup.getByRole('button', { name: /Mina Multi/ });
  await expect(secondaryListing).toBeVisible();
  await expect(secondaryListing.getByText('Mina Multi')).not.toHaveClass(/opacity-60/);
  const multiSpaceCue = secondaryListing.getByText('2 spaces');
  await expect(multiSpaceCue).toBeVisible();
  await multiSpaceCue.hover();
  await expect(page.getByRole('tooltip', { name: 'Also in Patch Alpha' })).toBeVisible();

  await secondaryListing.click();
  await expect(page.getByTestId('right-pane-tab-chat')).toHaveAttribute('data-state', 'active');
  await expect(page.locator('text=Mina').first()).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('right-pane-tab-memory').click();
  await expect(page.getByTestId('memory-destination-dropdown')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('memory-destination-dropdown').click();
  await expect(page.getByRole('option', { name: 'Patch Alpha' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('option', { name: 'Patch Beta' })).toBeVisible({
    timeout: 20_000,
  });
  await page.keyboard.press('Escape');

  await patchAlphaHeader.click();
  await expect(page.getByTestId(`assistant-list-item-${multiAssistant.agentId}`)).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate((groupId) => {
        const stored = window.localStorage.getItem('console:assistants:listGroupFolds');
        return stored ? JSON.parse(stored)[groupId] === true : false;
      }, `space:${patchAlpha.spaceId}`)
    )
    .toBe(true);

  await page.reload();
  await closeHireDialogIfOpen(page);
  await expect(page.getByRole('button', { name: /Patch Alpha/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId(`assistant-list-item-${multiAssistant.agentId}`)).toHaveCount(0);
  await expect(
    page.getByTestId('assistant-list-section-solo').getByText('Solo Only')
  ).toBeVisible();
});

test('typing in the sidebar search filters assistants and hides groups with no matches', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await expect(page.getByRole('button', { name: /Patch Alpha/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Patch Beta/ })).toBeVisible({ timeout: 10_000 });

  const searchInput = page.getByRole('searchbox');
  await expect(searchInput).toBeVisible({ timeout: 5_000 });
  await searchInput.fill('Patch Only');

  await expect(page.getByRole('button', { name: /Patch Alpha/ })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: /Patch Beta/ })).toHaveCount(0);
  await expect(page.getByTestId(`assistant-list-item-${patchAssistant.agentId}`)).toBeVisible();
  await expect(page.getByTestId(`assistant-list-item-${soloAssistant.agentId}`)).toHaveCount(0);

  await searchInput.fill('');
  await expect(page.getByRole('button', { name: /Patch Beta/ })).toBeVisible({ timeout: 5_000 });
});

test('kebab menu stays visible while Teams section is expanded', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const teamsSection = page.getByTestId('assistant-list-section-spaces');
  await expect(teamsSection).toBeVisible({ timeout: 15_000 });
  const teamsHeader = teamsSection.getByRole('button', { name: /Teams/ });
  if ((await teamsHeader.getAttribute('aria-expanded')) === 'false') {
    await teamsHeader.click();
  }
  await expect(teamsHeader).toHaveAttribute('aria-expanded', 'true');

  const assertMenuInSidebar = async (agentId: number) => {
    const row = page.getByTestId(`assistant-list-item-${agentId}`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.hover();
    const menuTrigger = page.getByTestId(`assistant-menu-${agentId}`);
    await expect(menuTrigger).toBeVisible({ timeout: 5_000 });
    await expect
      .poll(async () =>
        page.evaluate((testId) => {
          const menu = document.querySelector(`[data-testid="${testId}"]`);
          const sidebar = document.querySelector('[data-testid="assistant-list-section-spaces"]');
          if (!menu || !sidebar) return false;
          const menuRect = menu.getBoundingClientRect();
          const sidebarRect = sidebar.closest('.relative')?.getBoundingClientRect();
          if (!sidebarRect || menuRect.width <= 0) return false;
          return menuRect.right <= sidebarRect.right + 1;
        }, `assistant-menu-${agentId}`)
      )
      .toBe(true);
    await menuTrigger.click();
    await expect(page.getByTestId('menu-edit-profile')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  };

  await assertMenuInSidebar(patchAssistant.agentId);
  await assertMenuInSidebar(soloAssistant.agentId);
});

test('kebab menu stays visible for multi-space assistant rows', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const groupedRow = page.getByTestId(`assistant-list-item-${multiAssistant.agentId}`);
  await expect(groupedRow).toBeVisible({ timeout: 15_000 });
  await groupedRow.hover();

  const menuTrigger = page.getByTestId(`assistant-menu-${multiAssistant.agentId}`);
  await expect(menuTrigger).toBeVisible({ timeout: 5_000 });
  await expect(groupedRow.getByText('2 spaces')).toBeVisible();

  const menuBox = await menuTrigger.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.width).toBeGreaterThan(0);

  await menuTrigger.click();
  await expect(page.getByTestId('menu-edit-profile')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press('Escape');
});
