/**
 * Coordinator onboarding muted-intro E2E.
 *
 * Run: npx playwright test src/tests/assistants/coordinator-onboarding-muted-intro.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  cleanupUser,
  createAssistantTest,
  createTestUser,
  dbExec,
  deleteAllAssistantsForUser,
} from './helpers';

const user = createTestUser({ name: 'CoordMute', lastName: 'E2E', credits: 50_000 });
const test = createAssistantTest(user);
test.setTimeout(120_000);

test.afterAll(() => {
  try {
    deleteAllAssistantsForUser(user.id);
  } catch {
    /* best effort */
  }
  cleanupUser(user.id);
});

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

function readPersistedIntroWatched(): string {
  return dbExec(
    `SELECT le.data->>'intro_watched' FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name LIKE '${user.id}/%/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1;`
  );
}

test('muting the intro switches to text mode and discards the warmed call', async ({
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
  await expect(page.getByTestId('coordinator-onboarding-call-intro')).toBeVisible({
    timeout: 10_000,
  });

  const audioSwitcher = page.getByTestId('coordinator-onboarding-audio-switcher');
  await expect(audioSwitcher).toBeVisible();
  await expect(audioSwitcher).toHaveAttribute('aria-pressed', 'false');
  await audioSwitcher.click();
  await expect(audioSwitcher).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('coordinator-onboarding-droid-speech')).toBeVisible({
    timeout: 5_000,
  });

  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });
  await expect(page.getByTestId('assistant-call-docked')).toHaveCount(0);
  await expect.poll(() => readPersistedIntroWatched(), { timeout: 10_000 }).toBe('true');
});
