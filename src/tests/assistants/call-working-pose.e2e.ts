/**
 * Call Working-Pose E2E — verifies the call-window droid's pose state machine.
 *
 * Behaviour under test (see `useWorkingPose` in AssistantCommunicationDialog):
 *  - The droid answers facing the camera. The first time it turns to its laptop
 *    it stays there for the rest of the call — nothing ever turns it back to
 *    face the camera (a one-way latch).
 *  - An in-flight `act` turns the droid to its laptop, and it STAYS there after
 *    the act completes.
 *  - A non-unify comms event turns the droid to its laptop, and it STAYS there.
 *  - With no events, the droid turns to its laptop after the silence window and
 *    stays.
 *
 * Local mode: LiveKit creds are absent so the call hook reports connected
 * immediately; Pub/Sub creds are absent so actions flow through the in-memory
 * bus. No real media server or cloud is required.
 *
 * Run: npx playwright test src/tests/assistants/call-working-pose.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  selectAssistantInList,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  setUserCredits,
} from './helpers';

const CONSOLE_BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const user = createTestUser({ name: 'WorkingPoseE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

// An `appearance://` profile photo makes this a droid assistant, so the call
// surface renders the animated UnityCallAvatar rather than a photo Avatar.
const assistant = createAssistant({
  userId: user.id,
  firstName: 'Worker',
  surname: 'TestBot',
  profilePhoto: 'appearance://standard/green/up/ball/none',
});

test.afterAll(() => {
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

function makeActEvent(callingId: string, phase: 'incoming' | 'outgoing') {
  return {
    type: 'ManagerMethod',
    data: {
      id: Math.floor(Math.random() * 1_000_000),
      ts: new Date().toISOString(),
      entries: {
        callingId,
        eventId: `evt-${callingId}-${phase}-${Date.now()}`,
        manager: 'CodeActActor',
        method: 'act',
        phase,
        hierarchy: ['CodeActActor.act'],
        hierarchyLabel: 'CodeActActor.act',
        status: 'ok',
        displayLabel: 'Taking action',
        request: phase === 'incoming' ? 'Draft the quarterly report' : undefined,
        answer: phase === 'outgoing' ? 'Done' : undefined,
        eventTimestamp: new Date().toISOString(),
      },
    },
  };
}

function makeCommsEvent(medium: string, direction: 'inbound' | 'outbound') {
  return { type: 'CommsActivity', data: { medium, direction } };
}

async function pushEvent(assistantId: number, event: Record<string, unknown>) {
  const res = await fetch(`${CONSOLE_BASE}/api/assistant/${assistantId}/actions/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Push failed: ${res.status} ${await res.text()}`);
}

async function startCall(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await page.waitForTimeout(1_000);

  const audioBtn = page.getByTestId('call-audio-button');
  await expect(audioBtn).toBeEnabled({ timeout: 15_000 });
  await audioBtn.click();

  await expect(page.locator('text=Talk to Worker TestBot')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('unity-call-avatar')).toBeVisible({ timeout: 15_000 });
}

async function endCall(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'End call' }).click();
  await expect(page.locator('text=Talk to Worker TestBot')).not.toBeVisible({ timeout: 10_000 });
}

test('an in-flight act turns the droid to the laptop and it stays there after the act ends', async ({
  authedPage: page,
}) => {
  await startCall(page);

  // Facing the camera at first (within the silence window), no laptop.
  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'false');
  await expect(page.getByTestId('unity-call-laptop')).toHaveCount(0);

  // An in-flight `act` arrives over the live action stream → working pose.
  const callingId = `act-${Date.now()}`;
  await pushEvent(assistant.agentId, makeActEvent(callingId, 'incoming'));

  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'true', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('unity-call-laptop')).toBeVisible({ timeout: 15_000 });

  // The act completes — but the droid keeps working on the laptop and never
  // turns back to the camera.
  await pushEvent(assistant.agentId, makeActEvent(callingId, 'outgoing'));
  await page.waitForTimeout(3_000);

  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'true');
  await expect(page.getByTestId('unity-call-laptop')).toBeVisible();

  await endCall(page);
});

test('a comms event turns the droid to the laptop and it stays there (no cooloff revert)', async ({
  authedPage: page,
}) => {
  await startCall(page);
  await expect(page.getByTestId('unity-call-laptop')).toHaveCount(0);

  // An outbound email lands → working pose.
  await pushEvent(assistant.agentId, makeCommsEvent('email', 'outbound'));
  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'true', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('unity-call-laptop')).toBeVisible({ timeout: 15_000 });

  // No further events: well past any old cooloff window, the droid is still on
  // the laptop — once turned, it never faces the camera again.
  await page.waitForTimeout(13_000);
  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'true');
  await expect(page.getByTestId('unity-call-laptop')).toBeVisible();

  await endCall(page);
});

test('the droid drifts to the laptop after a spell of silence with no events', async ({
  authedPage: page,
}) => {
  await startCall(page);

  // Facing the camera at first, no laptop, with no act or comms activity.
  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'false');
  await expect(page.getByTestId('unity-call-laptop')).toHaveCount(0);

  // After the silence window elapses it turns to the laptop on its own.
  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'true', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('unity-call-laptop')).toBeVisible({ timeout: 15_000 });

  await endCall(page);
});
