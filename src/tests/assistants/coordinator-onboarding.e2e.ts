/**
 * Coordinator onboarding E2E.
 *
 * Verifies the guided alternate view of /assistants rendered while
 * the workspace Coordinator's state is in ``onboarding`` mode:
 *
 *   - The unskippable call-vs-chat picker shows on a fresh visit
 *   - Choosing "Start Call" shows the Marty intro before docking
 *     the real call surface, and hanging up continues in chat
 *   - The skip-onboarding affordance is suppressed until the user
 *     has answered the picker
 *   - Choosing "I'd rather chat for now" reveals the chat surface
 *     and exposes the skip affordance
 *   - Resolving the picker persists ``intro_watched`` on the
 *     Coordinator/State row, so a reload skips the ringing picker /
 *     auto-playing intro and lands directly on the working layout
 *   - The "Replay intro" affordance re-runs the intro on demand
 *     (no picker, no ringing)
 *   - Skipping promotes the workspace Coordinator to ``working`` and
 *     the regular /assistants shell takes over, including after a
 *     reload
 *
 * These tests share one workspace coordinator and run serially. Since
 * ``intro_watched`` is one-way sticky on the row, picker-expecting
 * tests call ``resetCoordinatorIntroWatched`` first to restore the
 * fresh ringing picker.
 *
 * The tests run serially against a single fresh user because the
 * promotion is one-way per workspace — once promoted, we'd need to
 * provision a new workspace to revisit onboarding.
 *
 * Run: npx playwright test src/tests/assistants/coordinator-onboarding.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createAssistantTest,
  createTestUser,
  cleanupUser,
  connectWorkspaceEmail,
  createPersonalCoordinator,
  dbExec,
  deleteAllAssistantsForUser,
} from './helpers';

const user = createTestUser({ name: 'CoordOnboard', lastName: 'E2E', credits: 50_000 });
const test = createAssistantTest(user);
test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

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

/**
 * Restore the fresh ringing picker on the shared workspace coordinator.
 *
 * Resolving the picker latches ``intro_watched`` on the latest
 * Coordinator/State row (one-way sticky through the API). These serial
 * tests reuse a single coordinator, so picker-expecting tests clear the
 * flag on that row directly — mode stays ``onboarding`` so the next
 * visit rings the picker exactly like a first-time user.
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

test('picker shows on first visit and hides the skip affordance', async ({ authedPage: page }) => {
  resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);

  // The picker is intentionally unskippable: until the user answers
  // call-or-chat there is no Skip button.
  await expect(page.getByTestId('coordinator-onboarding-skip')).toHaveCount(0);
});

test('a workspace connected in an earlier session pre-completes the checklist step', async ({
  authedPage: page,
}) => {
  // Simulate an earlier session's workspace OAuth: a BYOD email
  // contact lands on the coordinator row directly, with no transition
  // event fired this session. Orchestra derives the ``workspace``
  // step as complete from this row on the Coordinator/State read, so
  // the checklist must show it done from the very first render — the
  // historical failure mode was Marty (and the
  // checklist, briefly) telling the user to connect a workspace that
  // was already connected.
  const coordinator = createPersonalCoordinator(user.id);
  connectWorkspaceEmail({ assistantId: coordinator.agentId });
  resetCoordinatorIntroWatched();

  // Pin the durable signal the derivation reads: an active,
  // user-provisioned email contact with a provider.
  const contactCount = dbExec(
    `SELECT COUNT(*) FROM assistant_contacts WHERE assistant_id = ${coordinator.agentId} ` +
      `AND contact_type = 'email' AND provisioned_by = 'user' AND status = 'active' ` +
      `AND provider IS NOT NULL;`
  );
  expect(parseInt(contactCount, 10)).toBeGreaterThan(0);

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();

  // The sidebar checklist mounts post-picker, already seeded from the
  // server-derived snapshot — no pane needs to mount, no probe needs
  // to resolve.
  const workspaceRow = page.getByTestId('coordinator-onboarding-item-workspace').first();
  await expect(workspaceRow).toBeVisible({ timeout: 15_000 });
  await expect(workspaceRow).toHaveAttribute('data-status', 'done');

  // With workspace done, the next actionable step is connecting apps.
  await expect(page.getByTestId('coordinator-onboarding-item-apps').first()).toHaveAttribute(
    'data-next',
    'true'
  );
});

test('starting a call shows the Marty intro, docks the call, then falls back to chat on hangup', async ({
  authedPage: page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, {
      __COORDINATOR_ONBOARDING_INTRO_DURATION_MS: 1_400,
    });
  });
  resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);

  await page.getByTestId('coordinator-onboarding-start-call').click({ force: true });

  const intro = page.getByTestId('coordinator-onboarding-call-intro');
  await expect(intro).toBeVisible({ timeout: 10_000 });
  await expect(intro).toHaveAttribute('data-background-motion', 'idle');
  await expect(intro).toHaveAttribute('data-background-motion', 'scrolling');
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);

  await expect(page.getByTestId('coordinator-call-docked-region')).toBeVisible({
    timeout: 40_000,
  });
  await expect(page.getByTestId('assistant-call-docked')).toBeVisible();
  await expect(page.getByTestId('coordinator-chat-during-call-region')).toBeVisible();

  await page.getByRole('button', { name: 'End call' }).click();
  await expect(page.getByTestId('coordinator-onboarding-chat')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-skip')).toBeVisible();
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 });
});

test('picking chat reveals the chat surface and the skip affordance', async ({
  authedPage: page,
}) => {
  resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);

  await page.getByTestId('coordinator-onboarding-pick-chat').click();

  await expect(page.getByTestId('coordinator-onboarding-chat')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-skip')).toBeVisible();

  // The chat composer is part of the standard assistant chat panel —
  // its presence is the canonical signal that the chat surface is
  // wired up and ready for input.
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 });
});

test('resolving the picker persists intro_watched and reload skips the picker', async ({
  authedPage: page,
}) => {
  resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding-chat')).toBeVisible({
    timeout: 10_000,
  });

  // Resolving the picker latches ``intro_watched`` on the latest
  // Coordinator/State row.
  await expect.poll(() => readPersistedIntroWatched(), { timeout: 10_000 }).toBe('true');

  // A reload now lands directly on the working layout: no ringing
  // picker, no auto-playing intro — just the chat surface and the
  // sidebar (which carries the Replay intro affordance).
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await expect(page.getByTestId('coordinator-onboarding-chat')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-replay-intro')).toBeVisible();
  await expect(page.getByTestId('coordinator-onboarding-skip')).toBeVisible();
});

test('replay intro re-runs the intro without the ringing picker', async ({ authedPage: page }) => {
  await page.addInitScript(() => {
    Object.assign(window, {
      __COORDINATOR_ONBOARDING_INTRO_DURATION_MS: 1_400,
    });
  });
  // Continues from the previous test's state: intro already watched, so
  // we land on the working layout directly (no reset).
  await gotoAssistants(page);
  await expect(page.getByTestId('coordinator-onboarding-replay-intro')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);

  await page.getByTestId('coordinator-onboarding-replay-intro').click();

  // The intro plays from the top — no picker, straight into the
  // animated intro that hands off to the docked call.
  const intro = page.getByTestId('coordinator-onboarding-call-intro');
  await expect(intro).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-call-docked-region')).toBeVisible({
    timeout: 40_000,
  });

  // Hang up to return to a clean chat surface for subsequent tests.
  await page.getByRole('button', { name: 'End call' }).click();
  await expect(page.getByTestId('coordinator-onboarding-chat')).toBeVisible({
    timeout: 10_000,
  });
});

test('skipping an inline checklist step persists and advances to the next step', async ({
  authedPage: page,
}) => {
  const coordinator = createPersonalCoordinator(user.id);
  connectWorkspaceEmail({ assistantId: coordinator.agentId });
  resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();

  const appsRow = page.getByTestId('coordinator-onboarding-item-apps').first();
  await expect(appsRow).toHaveAttribute('data-next', 'true', { timeout: 15_000 });

  await page.getByTestId('coordinator-onboarding-skip-step-apps').click();
  await expect(appsRow).toHaveAttribute('data-status', 'skipped');
  await expect(page.getByTestId('coordinator-onboarding-item-act').first()).toHaveAttribute(
    'data-next',
    'true'
  );

  const skippedState = dbExec(
    `SELECT le.data->'skipped_step_ids' FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name = '${user.id}/${coordinator.agentId}/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1;`
  );
  expect(skippedState).toContain('apps');

  // The picker was resolved (chat), so a reload skips it and lands on
  // the working layout directly — the skipped step survives the reload.
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-item-apps').first()).toHaveAttribute(
    'data-status',
    'skipped',
    { timeout: 15_000 }
  );
});

test('skipping onboarding swaps in the regular assistants layout', async ({ authedPage: page }) => {
  resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);

  // Skip requires the picker to be answered first.
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding-skip')).toBeVisible({
    timeout: 10_000,
  });

  await page.getByTestId('coordinator-onboarding-skip').click();

  // Onboarding view disappears entirely once the promotion lands.
  await expect(page.getByTestId('coordinator-onboarding')).toHaveCount(0, {
    timeout: 15_000,
  });
  // The standard assistants shell exposes the hire entry point even
  // when Marty is the only assistant, whereas the onboarding view
  // suppresses it behind the picker/sidebar flow.
  await expect(page.getByRole('button', { name: /^Onboard$/ })).toBeVisible({ timeout: 15_000 });
});

test('the promotion is persistent across reloads', async ({ authedPage: page }) => {
  // Subsequent visits land directly on the regular layout — mode is
  // ``working`` server-side now, so the onboarding gate stays
  // closed even on a cold load.
  await gotoAssistants(page);
  await expect(page.getByTestId('coordinator-onboarding')).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: /^Onboard$/ })).toBeVisible({ timeout: 15_000 });
});
