/**
 * Assistant List E2E — verifies the assistant list behaves correctly:
 * empty state, list rendering after seeding, clicking to open profile,
 * deep links, info panel interactions, and list updating after a new hire.
 *
 * Run: npx playwright test src/tests/assistants/list.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openHireDialog,
  openUnitySwitcher,
  openAssistantInfoProfileTab,
  selectAssistantInList,
  fillProfileFields,
  selectVoice,
  clickHireButton,
  getAssistantFromDb,
  getCoordinatorAgentId,
  deferCoordinatorOnboarding,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  openAssistantInfoPanelFromList,
  openAssistantInfoPanel,
} from './helpers';
import { railSection } from '../helpers/shell';

const user = createTestUser({ name: 'ListE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

const shellOpts = { userId: user.id, apiKey: user.apiKey };

test.beforeAll(async () => {
  const coordinatorId = getCoordinatorAgentId(user.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(user.apiKey, coordinatorId);
  }
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('the Onboard button opens the hire dialog @push @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  // Every workspace now has an always-present personal Coordinator, so the list
  // is never truly empty and the legacy "auto-open on empty" path no longer
  // fires. A coordinator-only workspace stays on the onboarding intro, so seed
  // one regular assistant to land on the standard list, then drive the hire
  // dialog from the Onboard button (the surviving user-initiated entry point).
  createAssistant({ userId: user.id, firstName: 'Existing', surname: 'Unity' });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);

  await openHireDialog(page, shellOpts);

  // The switcher may stay open under the hire dialog — target by name.
  const dialog = page.getByRole('dialog', { name: 'Onboard Teammate' });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByRole('heading', { name: 'Onboard Teammate' })).toBeVisible({
    timeout: 5_000,
  });
});

test('seeded assistants appear in the list with correct names @push @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);

  const a1 = createAssistant({ userId: user.id, firstName: 'Alpha', surname: 'ListTest' });
  const a2 = createAssistant({ userId: user.id, firstName: 'Beta', surname: 'ListTest' });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);

  // The list now lives inside the rail's unity switcher.
  await openUnitySwitcher(page);

  const item1 = page.getByTestId(`assistant-list-item-${a1.agentId}`);
  const item2 = page.getByTestId(`assistant-list-item-${a2.agentId}`);

  await expect(item1).toBeVisible({ timeout: 15_000 });
  await expect(item2).toBeVisible({ timeout: 5_000 });

  // Personal workspaces only list virtual assistants — no Real/Virtual filters
  // and no org roster nesting (Teams / Groups / Colleagues).
  await expect(page.getByTestId('assistant-list-filter-real')).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-filter-virtual')).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-section-teams')).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-section-groups')).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-section-people')).toHaveCount(0);
  await expect(item1).toContainText('Alpha');
  await expect(item2).toContainText('Beta');
});

test('clicking an assistant in the list selects it and shows the Chat tab @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  const seeded = createAssistant({ userId: user.id, firstName: 'Clickable', surname: 'Selectee' });
  const agentId = seeded.agentId;
  const dbAssistant = getAssistantFromDb(agentId);

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);

  // Selecting from the switcher opens the unity in the section host with the
  // Chat section active by default (the rail owns section nav now).
  await selectAssistantInList(page, agentId);

  await expect(railSection(page, 'chat')).toHaveAttribute('aria-current', 'page', {
    timeout: 10_000,
  });
  // Hidden duplicate shell surfaces can also contain the name; match the
  // visible instance only.
  await expect(
    page.locator(`text=${dbAssistant.firstName}`).locator('visible=true').first()
  ).toBeVisible({
    timeout: 5_000,
  });
  await expect(
    page.locator(`text=${dbAssistant.surname}`).locator('visible=true').first()
  ).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('call-audio-button')).toBeVisible({ timeout: 5_000 });
});

test('deep link ?profile=agentId opens the correct assistant', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);
  const seeded = createAssistant({ userId: user.id, firstName: 'DeepLink', surname: 'Target' });
  const dbAssistant = getAssistantFromDb(seeded.agentId);

  await page.goto(`/assistants?profile=${seeded.agentId}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await closeHireDialogIfOpen(page);

  const chatHome = railSection(page, 'chat');
  await expect(chatHome).toContainText(dbAssistant.firstName, {
    timeout: 10_000,
  });
  await expect(chatHome).toContainText(dbAssistant.surname, {
    timeout: 5_000,
  });
});

test('assistant list item info toggle exposes profile and contact sections', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  const seeded = createAssistant({ userId: user.id, firstName: 'Menu', surname: 'Options' });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page, shellOpts);

  await openAssistantInfoPanelFromList(page, seeded.agentId);
  await expect(page.getByTestId('assistant-info-edit-profile-section')).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByTestId('assistant-info-edit-contact-section')).toBeVisible({
    timeout: 5_000,
  });
});

test('assistant list item unfold control opens the info panel', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);
  const seeded = createAssistant({ userId: user.id, firstName: 'Unfold', surname: 'Panel' });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page, shellOpts);

  const listItem = page.getByTestId(`assistant-list-item-${seeded.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  await openAssistantInfoPanelFromList(page, seeded.agentId);
  await openAssistantInfoProfileTab(page);
  await expect(page.getByTestId('assistant-info-edit-profile')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('assistant-info-edit-profile').click();
  await expect(page.locator('[role="dialog"]').filter({ hasText: /^Edit / })).toHaveCount(0);
  await expect(page.getByTestId('assistant-info-edit-contact-section')).toBeVisible({
    timeout: 5_000,
  });
});

test('list updates after hiring a new assistant without page reload @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  // A regular assistant must exist so the page renders the standard list view
  // (a coordinator-only workspace stays on the onboarding intro).
  createAssistant({ userId: user.id, firstName: 'Baseline', surname: 'Unity' });
  const firstName = `Fresh${Date.now()}`;

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);

  // The list lives inside the rail's unity switcher — open it to
  // count visible list items before the hire, then close it (the switcher is
  // itself a [role="dialog"], so leaving it open would make openHireDialog
  // think the hire dialog is already up).
  await openUnitySwitcher(page);
  const itemsBefore = await page.locator('[data-testid^="assistant-list-item-"]').count();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await openHireDialog(page, shellOpts);
  await fillProfileFields(page, {
    firstName,
    lastName: 'ListNew',
    about: 'Testing list update after hire.',
  });
  await selectVoice(page);
  await clickHireButton(page);

  // The hire dialog (and the switcher) dismiss on submit; reopen the
  // switcher to confirm the freshly hired unity shows without a page reload.
  await openUnitySwitcher(page);
  const newItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(newItem).toBeVisible({ timeout: 60_000 });

  const itemsAfter = await page.locator('[data-testid^="assistant-list-item-"]').count();
  expect(itemsAfter).toBe(itemsBefore + 1);
});
