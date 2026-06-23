/**
 * Coordinator onboarding E2E.
 *
 * The dedicated onboarding "mode" (an alternate /assistants shell with
 * no assistant list) has been removed. What remains is a transient
 * call-vs-chat picker shown on a fresh ``onboarding`` visit:
 *
 *   - The call-vs-chat picker shows on a fresh visit, with no skip
 *     affordance (the picker is the only gate, and it's lightweight).
 *   - Choosing "I'd rather text for now" tears the overlay down and
 *     drops the user into the regular platform (assistant list +
 *     right pane) with the Coordinator selected and the onboarding
 *     checklist living in its "Assistant info" panel.
 *   - Choosing "Start Call" connects the call directly (a brief
 *     "preparing" loader covers the audio handoff), then lands in the
 *     regular platform with the call docked in the Coordinator's
 *     right pane. There is no animated intro.
 *   - Resolving the picker persists ``intro_watched`` on the
 *     Coordinator/State row, so a reload skips the picker and lands
 *     directly on the regular platform.
 *   - There is no "Skip onboarding" or "Resume onboarding" affordance
 *     anywhere.
 *
 * These tests share one workspace coordinator and run serially. Since
 * ``intro_watched`` is one-way sticky on the row, picker-expecting
 * tests call ``resetCoordinatorIntroWatched`` first to restore the
 * fresh picker.
 *
 * Run: npx playwright test src/tests/assistants/coordinator-onboarding.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createAssistantTest,
  createTestUser,
  cleanupUser,
  connectWorkspaceEmail,
  createAssistant,
  createPersonalCoordinator,
  dbExec,
  deleteAllAssistantsForUser,
} from './helpers';

const user = createTestUser({ name: 'CoordOnboard', lastName: 'E2E', credits: 50_000 });
const test = createAssistantTest(user);
test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

const COMMS_STEP_IDS = [
  'email-reference',
  'email-reply',
  'whatsapp-number',
  'whatsapp-message-reference',
  'whatsapp-message',
  'whatsapp-call-reference',
  'whatsapp-call',
  'phone-number',
  'sms-reference',
  'sms-message',
  'phone-call-reference',
  'phone-call',
  'slack-connect',
  'slack-reference',
  'slack-message',
  'discord-connect',
  'discord-reference',
  'discord-message',
] as const;

test.afterAll(() => {
  try {
    deleteAllAssistantsForUser(user.id);
  } catch {
    /* best effort */
  }
  cleanupUser(user.id);
});

/**
 * Navigate to /assistants. We deliberately don't reuse
 * ``navigateToAssistants`` from the shared helpers because that
 * helper sets the per-assistant onboarding-roadmap suppression flag,
 * and we want a clean slate for the Coordinator onboarding gate.
 */
async function gotoAssistants(page: Page) {
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
}

async function expectPickerVisible(page: Page) {
  await expect(page.getByTestId('coordinator-onboarding-picker')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('coordinator-onboarding-start-call')).toBeVisible();
  await expect(page.getByTestId('coordinator-onboarding-pick-chat')).toBeVisible();
}

/** Open the Coordinator's "Assistant info" panel onboarding sub-tab. */
async function openOnboardingChecklist(page: Page) {
  const onboardingTab = page.getByTestId('assistant-info-tab-onboarding');
  if (!(await onboardingTab.isVisible({ timeout: 5_000 }).catch(() => false))) {
    await page.getByTestId('assistant-info-button').click();
    await expect(onboardingTab).toBeVisible({ timeout: 10_000 });
  }
  await onboardingTab.click();
}

async function expectChecklistItemClickable(page: Page, stepId: string) {
  await expect(page.getByTestId(`coordinator-onboarding-item-${stepId}`).first()).toHaveAttribute(
    'role',
    'button'
  );
}

async function expectChecklistItemNotDimmed(page: Page, stepId: string) {
  await expect(
    page
      .getByTestId(`coordinator-onboarding-item-${stepId}`)
      .first()
      .locator(
        'xpath=ancestor::li[contains(concat(" ", normalize-space(@class), " "), " opacity-50 ")]'
      )
  ).toHaveCount(0);
}

async function selectCoordinatorOnboardingSection(page: Page, sectionId: string) {
  const toggle = page.getByTestId(`coordinator-onboarding-section-${sectionId}-toggle`);
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

async function openChecklistItemMenu(page: Page, stepId: string) {
  await page.getByTestId(`coordinator-onboarding-item-${stepId}`).click();
}

/**
 * Restore the fresh picker on the shared workspace coordinator.
 *
 * Resolving the picker latches ``intro_watched`` on the latest
 * Coordinator/State row (one-way sticky through the API). These serial
 * tests reuse a single coordinator, so picker-expecting tests clear the
 * flag on that row directly — mode stays ``onboarding`` so the next
 * visit shows the picker exactly like a first-time user.
 */
function resetCoordinatorIntroWatched() {
  dbExec(
    `UPDATE log_event SET data = jsonb_set(data, '{intro_watched}', 'false') ` +
      `WHERE id = (SELECT le.id FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name LIKE '${user.id}/%/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1);`
  );
}

/** Read the latest persisted ``intro_watched`` flag for the user's coordinator. */
function readPersistedIntroWatched(): string {
  return dbExec(
    `SELECT le.data->>'intro_watched' FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name LIKE '${user.id}/%/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1;`
  );
}

function readPersistedOnboardingStep(coordinatorId: string | number): string {
  return dbExec(
    `SELECT le.data->>'onboarding_step' FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name = '${user.id}/${coordinatorId}/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1;`
  );
}

function readPersistedSkippedPhaseIds(coordinatorId: string | number): string {
  return dbExec(
    `SELECT le.data->'skipped_phase_ids' FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name = '${user.id}/${coordinatorId}/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1;`
  );
}

function markCoordinatorStepsSkipped(coordinatorId: string | number, stepIds: readonly string[]) {
  const json = JSON.stringify(stepIds).replace(/'/g, "''");
  dbExec(
    `UPDATE log_event SET data = jsonb_set(data, '{skipped_step_ids}', '${json}'::jsonb) ` +
      `WHERE id = (SELECT le.id FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name = '${user.id}/${coordinatorId}/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1);`
  );
}

test('picker shows on first visit with no skip or resume affordance', async ({
  authedPage: page,
}) => {
  resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);

  // The skip / resume affordances were removed with the dedicated
  // onboarding mode — neither exists anywhere now.
  await expect(page.getByTestId('coordinator-onboarding-skip')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-resume')).toHaveCount(0);
});

test('checklist allows independent sections to start out of order', async ({
  authedPage: page,
}) => {
  const coordinator = createPersonalCoordinator(user.id);
  resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await openOnboardingChecklist(page);
  await selectCoordinatorOnboardingSection(page, 'communication');
  await expect(
    page.getByTestId('coordinator-onboarding-item-email-reference').first()
  ).toHaveAttribute('data-next', 'true', { timeout: 15_000 });
  await expectChecklistItemClickable(page, 'email-reference');
  await openChecklistItemMenu(page, 'email-reference');
  await expect(page.getByRole('menuitem', { name: 'Action' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Skip' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('coordinator-onboarding-item-email-reply')).toHaveAttribute(
    'data-status',
    'locked'
  );
  await page.getByTestId('coordinator-onboarding-lock-hover-email-reply').click();
  await expect(page.getByText('Depends on:')).toBeVisible();
  await expect(page.getByText('Email the first reference')).toBeVisible();
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);

  await selectCoordinatorOnboardingSection(page, 'my-computer');
  await expect(page.getByTestId('coordinator-onboarding-item-email-reference')).toHaveCount(0);
  await expect(
    page.getByTestId('coordinator-onboarding-item-my-computer-coming-soon')
  ).toHaveAttribute('data-status', 'locked');

  await selectCoordinatorOnboardingSection(page, 'workspace');
  await expectChecklistItemClickable(page, 'workspace');
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-item-apps')).toHaveAttribute(
    'data-status',
    'locked'
  );

  await openChecklistItemMenu(page, 'workspace');
  await page.getByRole('menuitem', { name: 'Skip' }).click();
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).toHaveAttribute(
    'data-status',
    'skipped'
  );
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).not.toHaveAttribute(
    'role',
    'button'
  );
  await expect(page.getByTestId('coordinator-onboarding-item-apps')).toBeVisible();
  await expect(page.getByTestId('coordinator-onboarding-item-apps')).not.toHaveAttribute(
    'data-status',
    'skipped'
  );

  await openChecklistItemMenu(page, 'workspace');
  await page.getByRole('menuitem', { name: 'Unskip' }).click();
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).toHaveAttribute(
    'role',
    'button'
  );
});

test('picking chat lands in the full platform with the checklist in Assistant info', async ({
  authedPage: page,
}) => {
  // Simulate an earlier session's workspace OAuth so the checklist has a
  // pre-completed step to show — Orchestra derives the ``workspace`` step
  // as done from the BYOD email contact on the Coordinator/State read.
  const coordinator = createPersonalCoordinator(user.id);
  connectWorkspaceEmail({ assistantId: coordinator.agentId });
  resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();

  // The intro overlay tears down, revealing the regular platform: the
  // assistant list is present (the dedicated onboarding shell hid it).
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });
  await expect(page.getByTestId(`assistant-list-item-${coordinator.agentId}`)).toBeVisible({
    timeout: 15_000,
  });

  // The onboarding checklist now lives in the Coordinator's "Assistant
  // info" panel, seeded from the server-derived snapshot.
  await openOnboardingChecklist(page);
  await expect(page.getByTestId('coordinator-onboarding-section-communication-toggle')).toHaveText(
    /1\. Communication/
  );
  await expect(page.getByTestId('coordinator-onboarding-section-workspace-toggle')).toHaveText(
    /2\. Workspace/
  );
  await expect(page.getByTestId('coordinator-onboarding-section-integrations-toggle')).toHaveText(
    /3\. Integrations/
  );
  await selectCoordinatorOnboardingSection(page, 'integrations');
  await expectChecklistItemClickable(page, 'apps');
  await expect(page.getByTestId('coordinator-onboarding-item-email-reference')).toHaveCount(0);
  await selectCoordinatorOnboardingSection(page, 'my-computer');
  await expect(
    page.getByTestId('coordinator-onboarding-item-my-computer-coming-soon')
  ).toHaveAttribute('data-status', 'locked');
  await selectCoordinatorOnboardingSection(page, 'communication');
  const emailReferenceRow = page.getByTestId('coordinator-onboarding-item-email-reference').first();
  await expect(emailReferenceRow).toHaveAttribute('data-next', 'true', { timeout: 15_000 });
  await expectChecklistItemClickable(page, 'email-reference');
  await openChecklistItemMenu(page, 'email-reference');
  await page.getByRole('menuitem', { name: 'Action' }).click();
  await expect(emailReferenceRow).toHaveAttribute('data-status', 'done', { timeout: 10_000 });
  await openChecklistItemMenu(page, 'email-reference');
  await expect(page.getByRole('menuitem', { name: 'Reset' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Reset' }).click();
  await expect(emailReferenceRow).toHaveAttribute('data-status', 'pending');
  await expect(page.getByTestId('coordinator-onboarding-item-email-reply').first()).toHaveAttribute(
    'data-status',
    'locked'
  );
  await openChecklistItemMenu(page, 'email-reference');
  await page.getByRole('menuitem', { name: 'Action' }).click();
  await expect(page.getByTestId('coordinator-onboarding-item-email-reply').first()).toHaveAttribute(
    'data-next',
    'true',
    { timeout: 10_000 }
  );
  await expectChecklistItemClickable(page, 'email-reply');
  await openChecklistItemMenu(page, 'email-reply');
  await page.getByRole('menuitem', { name: 'Action' }).click();
  await expect(page.getByTestId('coordinator-onboarding-info-content-email-reply')).toBeVisible();
  await expect(page.getByTestId('coordinator-onboarding-item-apps')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);
  await expect
    .poll(() => readPersistedOnboardingStep(coordinator.agentId), { timeout: 10_000 })
    .toBe('email-reply');
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-item-apps')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);

  // No skip / resume affordances exist on the platform either.
  await expect(page.getByTestId('coordinator-onboarding-skip')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-resume')).toHaveCount(0);
});

test('starting a call connects and docks the call in the platform', async ({
  authedPage: page,
}) => {
  resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);

  await page.getByTestId('coordinator-onboarding-start-call').click({ force: true });

  // No animated intro: the picker hands straight off to the connecting
  // call (a brief "preparing" loader covers the audio handoff).
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);

  // The overlay clears and the real call is docked in the Coordinator's
  // regular right pane.
  await expect(page.getByTestId('assistant-call-docked')).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 10_000 });

  // Hang up to leave a clean state for subsequent tests.
  await page.getByRole('button', { name: 'End call' }).click();
});

test('mobile onboarding keeps the docked Twin call visible instead of auto-opening Assistant info', async ({
  authedPage: page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);

  await page.getByTestId('coordinator-onboarding-start-call').click({ force: true });
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);

  await expect(page.getByTestId('assistant-call-docked')).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId('assistant-info-sheet')).toHaveCount(0);
  await expect.poll(() => readPersistedIntroWatched(), { timeout: 10_000 }).toBe('true');

  await page.getByRole('button', { name: 'End call' }).click();
});

test('resolving the picker persists intro_watched and reload defaults to Twin + Assistant info', async ({
  authedPage: page,
}) => {
  resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  // Resolving the picker latches ``intro_watched`` on the latest
  // Coordinator/State row.
  await expect.poll(() => readPersistedIntroWatched(), { timeout: 10_000 }).toBe('true');

  // A reload now lands directly on the regular platform: no picker, no
  // intro overlay. The bare /assistants visit defaults to the Coordinator
  // selected with its "Assistant info" onboarding card open — regardless
  // of onboarding being already watched.
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.getByTestId('assistant-info-sheet')).toBeVisible({ timeout: 15_000 });
  await openOnboardingChecklist(page);
  await expect(page.getByTestId('coordinator-onboarding-checklist')).toBeVisible({
    timeout: 15_000,
  });
});

test('switching back to Twin does not reapply the onboarding focus layout', async ({
  authedPage: page,
}) => {
  const coordinator = createPersonalCoordinator(user.id);
  const otherAssistant = createAssistant({
    userId: user.id,
    firstName: 'Switch',
    surname: 'Droid',
  });
  resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await expect(page.getByTestId('assistant-info-sheet')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('assistant-info-tab-onboarding')).toBeVisible();

  await page.getByTestId('assistant-list-toggle-fold').click();
  await expect(page.getByLabel('Collapse assistant list')).toBeVisible();
  await page.getByTestId('assistant-info-button').click();
  await expect(page.getByTestId('assistant-info-sheet')).toHaveCount(0);

  await page.getByTestId(`assistant-list-item-${otherAssistant.agentId}`).click();
  await page.getByTestId(`assistant-list-item-${coordinator.agentId}`).click();

  await expect(page.getByLabel('Collapse assistant list')).toBeVisible();
  await expect(page.getByTestId('assistant-info-sheet')).toHaveCount(0);
});

test('skipping an inline checklist step can be reversed later', async ({ authedPage: page }) => {
  const coordinator = createPersonalCoordinator(user.id);
  connectWorkspaceEmail({ assistantId: coordinator.agentId });
  markCoordinatorStepsSkipped(coordinator.agentId, COMMS_STEP_IDS);
  resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await openOnboardingChecklist(page);
  const appsRow = page.getByTestId('coordinator-onboarding-item-apps').first();
  await expect(appsRow).toHaveAttribute('data-next', 'true', { timeout: 15_000 });
  await expectChecklistItemClickable(page, 'apps');
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);

  await openChecklistItemMenu(page, 'apps');
  await page.getByRole('menuitem', { name: 'Skip' }).click();
  await expect(appsRow).toHaveAttribute('data-status', 'skipped');
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);

  const skippedState = dbExec(
    `SELECT le.data->'skipped_step_ids' FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name = '${user.id}/${coordinator.agentId}/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1;`
  );
  expect(skippedState).toContain('apps');

  await selectCoordinatorOnboardingSection(page, 'integrations');
  await openChecklistItemMenu(page, 'apps');
  await page.getByRole('menuitem', { name: 'Unskip' }).click();
  await expect(appsRow).toHaveAttribute('data-next', 'true');
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);

  const unskippedState = dbExec(
    `SELECT le.data->'skipped_step_ids' FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name = '${user.id}/${coordinator.agentId}/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1;`
  );
  expect(unskippedState).not.toContain('apps');
});
