/**
 * Coordinator onboarding helpers for E2E tests.
 *
 * A freshly provisioned Coordinator renders a full-screen onboarding overlay
 * that intercepts pointer events on /assistants. Tests that assume the
 * standard shell defer onboarding once before the first authenticated page load.
 */

import type { Page } from '@playwright/test';
import { dbExec } from './seeds/client';

/** Agent ID of a user's personal (non-org) Coordinator, or null if none. */
export function getCoordinatorAgentId(userId: string): number | null {
  const result = dbExec(
    `SELECT agent_id FROM assistants WHERE user_id = '${userId}' AND is_coordinator = TRUE AND organization_id IS NULL ORDER BY agent_id LIMIT 1`
  );
  const parsed = parseInt(result, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Dismiss the Coordinator onboarding gate for a workspace.
 *
 * Setting ``onboarding_deferred`` clears the intro overlay and coordinator
 * focus layout, leaving the regular two-pane list. Idempotent.
 */
export async function deferCoordinatorOnboarding(
  apiKey: string,
  coordinatorId: number
): Promise<void> {
  void apiKey;
  const userId = dbExec(
    `SELECT user_id FROM assistants WHERE agent_id = ${coordinatorId} LIMIT 1;`
  );
  if (!userId) return;

  dbExec(
    `UPDATE log_event SET data = ` +
      `jsonb_set(jsonb_set(COALESCE(data, '{}'::jsonb), '{intro_watched}', 'true'), '{onboarding_deferred}', 'true') ` +
      `WHERE id = (SELECT le.id FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name = '${userId}/${coordinatorId}/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1);`
  );
}

/** Defer personal Coordinator onboarding when one exists for the user. */
export async function deferCoordinatorForUser(userId: string, apiKey: string): Promise<void> {
  const coordinatorId = getCoordinatorAgentId(userId);
  if (coordinatorId) {
    await deferCoordinatorOnboarding(apiKey, coordinatorId);
  }
}

/**
 * Wait for a personal Coordinator row, defer onboarding, and reload so
 * /assistants renders the standard shell instead of the intro overlay.
 */
export async function deferCoordinatorAfterAssistantsLoad(
  page: Page,
  userId: string,
  apiKey: string
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    await dismissCoordinatorOnboardingIfOpen(page);

    const coordinatorId = getCoordinatorAgentId(userId);
    if (coordinatorId) {
      await deferCoordinatorOnboarding(apiKey, coordinatorId);
    }

    const overlay = page.getByTestId('coordinator-onboarding');
    if (!(await overlay.isVisible({ timeout: 500 }).catch(() => false))) {
      return;
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
  }
}

/** Pick chat when the coordinator intro overlay blocks shell interactions. */
export async function dismissCoordinatorOnboardingIfOpen(page: Page): Promise<void> {
  const pickChat = page.getByTestId('coordinator-onboarding-pick-chat');
  if (!(await pickChat.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return;
  }
  await pickChat.click();
  await page
    .getByTestId('coordinator-onboarding')
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => {});
}
