/**
 * Coordinator onboarding helpers for E2E tests.
 *
 * A freshly provisioned Coordinator renders a full-screen onboarding overlay
 * that intercepts pointer events on /assistants. Tests that assume the
 * standard shell defer onboarding once before the first authenticated page load.
 */

import { expect, type Page } from '@playwright/test';
import { dbExec, orchestraFetch } from './seeds/client';

/** Agent ID of a user's personal (non-org) Coordinator, or null if none. */
export function getCoordinatorAgentId(userId: string): number | null {
  const result = dbExec(
    `SELECT agent_id FROM assistants WHERE user_id = '${userId}' AND is_coordinator = TRUE AND organization_id IS NULL ORDER BY agent_id LIMIT 1`
  );
  const parsed = parseInt(result, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Pause Coordinator onboarding so legacy assistant flows can use the standard shell.
 */
export async function deferCoordinatorOnboarding(
  apiKey: string,
  coordinatorId: number
): Promise<void> {
  const payloads = [{ intro_watched: true, onboarding_active: false }, { intro_watched: true }];

  for (const body of payloads) {
    const res = await orchestraFetch(
      `/v0/assistant/${coordinatorId}/state`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
      apiKey
    );
    if (res.ok) {
      return;
    }
    if (res.status !== 422) {
      throw new Error(`Failed to pause coordinator onboarding: ${res.status}`);
    }
  }

  throw new Error('Failed to pause coordinator onboarding: 422');
}

/** Defer personal Coordinator onboarding when one exists for the user. */
export async function deferCoordinatorForUser(userId: string, apiKey: string): Promise<void> {
  const coordinatorId = getCoordinatorAgentId(userId);
  if (coordinatorId) {
    await deferCoordinatorOnboarding(apiKey, coordinatorId);
  }
}

async function coordinatorOverlayVisible(page: Page): Promise<boolean> {
  return page
    .getByTestId('coordinator-onboarding')
    .isVisible({ timeout: 500 })
    .catch(() => false);
}

async function waitForWorkspaceShell(page: Page): Promise<void> {
  const path = new URL(page.url()).pathname;
  const loadingWorkspace = page.getByRole('status', { name: 'Loading workspace' });

  if (!path.startsWith('/assistants')) {
    if (await loadingWorkspace.isVisible({ timeout: 500 }).catch(() => false)) {
      await loadingWorkspace.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    }
    return;
  }

  await expect
    .poll(
      async () => {
        if (await coordinatorOverlayVisible(page)) return 'overlay';
        if (
          await page
            .getByTestId('assistant-rail')
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          return 'rail';
        }
        if (await loadingWorkspace.isVisible().catch(() => false)) {
          return 'loading';
        }
        return 'pending';
      },
      { timeout: 30_000 }
    )
    .not.toBe('loading');
}

/**
 * Clear the coordinator intro overlay after /assistants (or another app-shell
 * route) has loaded. Prefer UI dismissal; fall back to a single DB defer +
 * reload when the overlay persists.
 */
export async function deferCoordinatorAfterAssistantsLoad(
  page: Page,
  userId: string,
  apiKey: string
): Promise<void> {
  await waitForWorkspaceShell(page);
  await dismissCoordinatorOnboardingIfOpen(page);
  if (!(await coordinatorOverlayVisible(page))) return;

  const coordinatorId = getCoordinatorAgentId(userId);
  if (coordinatorId) {
    await deferCoordinatorOnboarding(apiKey, coordinatorId);
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForWorkspaceShell(page);
  await dismissCoordinatorOnboardingIfOpen(page);
}

/** Ensure the workspace shell is interactive after navigation (coordinator overlay dismissed). */
export async function ensureShellReady(page: Page, userId: string, apiKey: string): Promise<void> {
  await deferCoordinatorAfterAssistantsLoad(page, userId, apiKey);
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
