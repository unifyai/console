/**
 * Call Working-Pose E2E — verifies the call-window droid adopts its
 * "working on a laptop" pose while the assistant has an in-flight `act`,
 * then turns back to face the screen once the act completes.
 *
 * Flow:
 *  - Start a call with a droid (appearance-sentinel) assistant so the call
 *    surface renders the animated `UnityCallAvatar` (not a photo).
 *  - Push a live incoming `CodeActActor.act` ManagerMethod event via the local
 *    push endpoint — the same SSE stream the Actions pane consumes — and assert
 *    the laptop appears on the call avatar.
 *  - Push the matching outgoing event and assert the laptop is removed.
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

test('droid adopts the working pose while an act is in flight and reverts when it ends', async ({
  authedPage: page,
}) => {
  await startCall(page);

  // Idle: facing the screen, no laptop.
  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'false');
  await expect(page.getByTestId('unity-call-laptop')).toHaveCount(0);

  // An in-flight `act` arrives over the live action stream → working pose.
  const callingId = `act-${Date.now()}`;
  await pushEvent(assistant.agentId, makeActEvent(callingId, 'incoming'));

  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'true', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('unity-call-laptop')).toBeVisible({ timeout: 15_000 });

  // The act completes → the droid turns back to face the screen and the laptop
  // is removed once the close animation settles.
  await pushEvent(assistant.agentId, makeActEvent(callingId, 'outgoing'));

  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'false', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('unity-call-laptop')).toHaveCount(0, { timeout: 15_000 });

  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();
  await expect(page.locator('text=Talk to Worker TestBot')).not.toBeVisible({ timeout: 10_000 });
});

test('a non-unify comms event rotates the droid, resets on cascade, and reverts after the cooloff', async ({
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

  // Cascade: a second event ~7s later (within the 10s cooloff) resets the timer.
  await page.waitForTimeout(7_000);
  await pushEvent(assistant.agentId, makeCommsEvent('whatsapp_message', 'inbound'));

  // ~7s after the second event (14s after the first) it is still rotated —
  // proving the cooloff tracks the latest event, not the first.
  await page.waitForTimeout(7_000);
  await expect(page.getByTestId('unity-call-laptop')).toBeVisible();
  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'true');

  // No further events: ~12s after the last one, it turns back to the screen.
  await page.waitForTimeout(12_000);
  await expect(page.getByTestId('unity-call-avatar')).toHaveAttribute('data-acting', 'false', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('unity-call-laptop')).toHaveCount(0, { timeout: 15_000 });

  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();
  await expect(page.locator('text=Talk to Worker TestBot')).not.toBeVisible({ timeout: 10_000 });
});
