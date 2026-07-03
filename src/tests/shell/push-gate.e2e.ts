/**
 * Push Gate — minimal assistants shell sanity for CI on every branch push.
 * Complements auth/login and route-shell-smoke with a single rail render check.
 *
 * Run: npx playwright test src/tests/shell/push-gate.e2e.ts
 */

import { expect } from '@playwright/test';
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
} from '../assistants/helpers';

const user = createTestUser({ name: 'PushGate', lastName: 'Shell', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

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

test('the assistants rail renders with brand and unity switcher @push @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  createAssistant({ userId: user.id, firstName: 'Push', surname: 'Gate' });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const rail = page.getByTestId('assistant-rail');
  await expect(rail).toBeVisible({ timeout: 15_000 });
  await expect(rail.getByText('Unify', { exact: true })).toBeVisible();
  await expect(page.getByTestId('rail-unity-switcher')).toBeVisible();
});
