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
 *     anywhere. Once onboarding is exited (``mode === 'working'``) the
 *     checklist body offers a single "Reactivate onboarding" control that
 *     flips the row back to ``onboarding`` and repopulates the checklist.
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
  orchestraFetch,
  openAssistantInfoPanel,
  openRailSection,
  openUnitySwitcher,
  selectAssistantInList,
} from './helpers';

const user = createTestUser({ name: 'CoordOnboard', lastName: 'E2E', credits: 50_000 });
const test = createAssistantTest(user);
test.setTimeout(180_000);
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

async function enableDevCalls(page: Page) {
  await page.context().addCookies([
    {
      name: 'console_dev_calls',
      value: '1',
      url: 'http://localhost:3000',
      sameSite: 'Lax',
    },
  ]);
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
    await openAssistantInfoPanel(page);
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
  const label = page.getByTestId(`coordinator-onboarding-section-${sectionId}-toggle`);
  const toggle = label.locator('xpath=ancestor::button[1]');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await label.click();
  }
}

async function selectCoordinatorCommunicationSubgroup(page: Page, subgroupId: string) {
  const toggle = page.getByTestId(`coordinator-onboarding-communication-${subgroupId}-toggle`);
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

async function expectComingSoonVisible(page: Page) {
  await expect(page.getByRole('button', { name: /^\[coming soon\]$/ }).first()).toBeVisible();
}

/**
 * Restore the fresh picker on the shared workspace coordinator.
 *
 * Resolving the picker latches ``intro_watched`` on the latest
 * Coordinator/State row (one-way sticky through the API). The shared test
 * fixture also defers onboarding up front (``onboarding_deferred: true``) so
 * legacy flows get the standard shell; the picker gate in ``Main.tsx`` stays
 * suppressed while that flag is set. Picker-expecting tests therefore reuse a
 * single coordinator and restore the genuine first-time state on the latest
 * row directly — both ``intro_watched`` and ``onboarding_deferred`` back to
 * false, mode left ``onboarding`` — so the next visit shows the picker exactly
 * like a first-time user.
 */
function resetCoordinatorIntroWatched() {
  dbExec(
    `UPDATE log_event SET data = ` +
      `jsonb_set(jsonb_set(data, '{intro_watched}', 'false'), '{onboarding_deferred}', 'false') ` +
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

/** Read the latest persisted lifecycle ``mode`` for the user's coordinator. */
function readPersistedMode(coordinatorId: string | number): string {
  return dbExec(
    `SELECT le.data->>'mode' FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name = '${user.id}/${coordinatorId}/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1;`
  );
}

async function seedCoordinatorOutboundTranscript(
  coordinatorId: string | number,
  medium: string,
  content: string,
  onboardingTriggerStepId?: string
) {
  const response = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${user.id}/${coordinatorId}/Transcripts`,
        entries: [
          {
            message_id: Date.now(),
            medium,
            sender_id: 0,
            receiver_ids: [1],
            timestamp: new Date().toISOString(),
            content,
            exchange_id: Date.now(),
            ...(onboardingTriggerStepId
              ? { metadata: { onboarding_trigger_step_id: onboardingTriggerStepId } }
              : {}),
          },
        ],
      }),
    },
    user.apiKey
  );
  expect(response.ok).toBeTruthy();
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
  await selectCoordinatorCommunicationSubgroup(page, 'email');
  await expect(
    page.getByTestId('coordinator-onboarding-item-email-reference').first()
  ).toHaveAttribute('data-next', 'true', { timeout: 15_000 });
  await expectChecklistItemClickable(page, 'email-reference');
  await expect(page.getByTestId('coordinator-onboarding-item-email-reply')).toHaveAttribute(
    'data-status',
    'locked'
  );
  await page.getByTestId('coordinator-onboarding-item-email-reply').click();
  await expect(page.getByTestId('coordinator-onboarding-item-email-reply')).toHaveAttribute(
    'data-blocked-feedback',
    'true'
  );
  await expect(
    page.getByTestId('coordinator-onboarding-blocking-arrow-email-reference')
  ).toHaveText('← Next');
  await selectCoordinatorCommunicationSubgroup(page, 'whatsapp');
  await page.getByTestId('coordinator-onboarding-item-whatsapp-call').click();
  await expect(page.getByTestId('coordinator-onboarding-item-whatsapp-call')).toHaveAttribute(
    'data-blocked-feedback',
    'true'
  );
  await expect(
    page.getByTestId('coordinator-onboarding-blocking-arrow-whatsapp-number')
  ).toHaveText('← Next');
  await expect(
    page.getByTestId('coordinator-onboarding-blocking-arrow-whatsapp-call-reference')
  ).toHaveCount(0);
  await selectCoordinatorCommunicationSubgroup(page, 'slack');
  await expect(page.getByTestId('coordinator-onboarding-item-slack-connect')).toHaveAttribute(
    'data-status',
    'locked'
  );
  await page.getByTestId('coordinator-onboarding-item-slack-reference').click();
  await expect(page.getByTestId('coordinator-onboarding-item-slack-reference')).toHaveAttribute(
    'data-blocked-feedback',
    'true'
  );
  await expect(page.getByTestId('coordinator-onboarding-blocking-arrow-slack-connect')).toHaveText(
    '← Locked'
  );
  await selectCoordinatorCommunicationSubgroup(page, 'discord');
  await expect(page.getByTestId('coordinator-onboarding-item-discord-connect')).toHaveAttribute(
    'data-status',
    'locked'
  );
  await page.getByTestId('coordinator-onboarding-item-discord-reference').click();
  await expect(page.getByTestId('coordinator-onboarding-item-discord-reference')).toHaveAttribute(
    'data-blocked-feedback',
    'true'
  );
  await expect(
    page.getByTestId('coordinator-onboarding-blocking-arrow-discord-connect')
  ).toHaveText('← Locked');
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);

  await selectCoordinatorOnboardingSection(page, 'my-computer');
  await expectComingSoonVisible(page);

  await selectCoordinatorOnboardingSection(page, 'workspace');
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).toBeVisible();
  await expectChecklistItemClickable(page, 'workspace');
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);
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
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-list-item-${coordinator.agentId}`)).toBeVisible({
    timeout: 15_000,
  });
  // Dismiss the switcher popover so it doesn't overlay the chat header
  // controls used below.
  await page.keyboard.press('Escape');

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
  await expect(page.getByTestId('coordinator-onboarding-section-communication')).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  await expect(
    page.getByTestId('coordinator-onboarding-communication-email-toggle')
  ).toHaveAttribute('aria-expanded', 'true');
  const emailReferenceRow = page.getByTestId('coordinator-onboarding-item-email-reference').first();
  await expect(emailReferenceRow).toBeVisible();
  await selectCoordinatorOnboardingSection(page, 'integrations');
  const appsRow = page.getByTestId('coordinator-onboarding-item-apps').first();
  await expect(appsRow).toBeVisible();
  await expectChecklistItemClickable(page, 'apps');
  await selectCoordinatorOnboardingSection(page, 'my-computer');
  await expectComingSoonVisible(page);
  await selectCoordinatorOnboardingSection(page, 'communication');
  await expect(emailReferenceRow).toHaveAttribute('data-next', 'true', { timeout: 15_000 });
  await expectChecklistItemClickable(page, 'email-reference');
  let onboardingStepEventRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/coordinator-onboarding-step-event')) {
      onboardingStepEventRequests += 1;
    }
  });
  await emailReferenceRow.click();
  await expect(
    page.getByTestId('coordinator-onboarding-action-feedback-email-reference')
  ).toHaveText('Sending...');
  await expect(
    page.getByTestId('coordinator-onboarding-action-feedback-email-reference')
  ).toHaveCount(0, {
    timeout: 6_000,
  });
  await expect(emailReferenceRow).not.toHaveAttribute('data-status', 'done');
  await expect(page.getByTestId('coordinator-onboarding-item-email-reply').first()).toHaveAttribute(
    'data-status',
    'locked'
  );
  await expect
    .poll(() => readPersistedOnboardingStep(coordinator.agentId), { timeout: 10_000 })
    .toBe('email-reply');
  await expect.poll(() => onboardingStepEventRequests, { timeout: 5_000 }).toBe(1);
  await emailReferenceRow.click();
  await expect.poll(() => onboardingStepEventRequests, { timeout: 1_000 }).toBe(1);
  await seedCoordinatorOutboundTranscript(
    coordinator.agentId,
    'email',
    'Untagged outbound email clue proof for onboarding.'
  );
  await expect(emailReferenceRow).not.toHaveAttribute('data-status', 'done');
  await seedCoordinatorOutboundTranscript(
    coordinator.agentId,
    'email',
    'Tagged outbound email clue proof for onboarding.',
    'email-reference'
  );
  await expect(emailReferenceRow).toHaveAttribute('data-status', 'done', { timeout: 12_000 });
  await expect(page.getByTestId('coordinator-onboarding-item-email-reply').first()).toHaveAttribute(
    'data-next',
    'true',
    { timeout: 10_000 }
  );
  const emailReplyRow = page.getByTestId('coordinator-onboarding-item-email-reply').first();
  await expectChecklistItemClickable(page, 'email-reply');
  await emailReplyRow.click();
  await expect(page.getByTestId('coordinator-onboarding-action-feedback-email-reply')).toHaveText(
    'Checking...'
  );
  await expect(page.getByTestId('coordinator-onboarding-action-feedback-email-reply')).toHaveCount(
    0,
    {
      timeout: 6_000,
    }
  );
  await expect(emailReplyRow).toHaveAttribute('role', 'button');
  await expect(emailReplyRow).not.toHaveAttribute('data-status', 'done');
  const appsRowAfterReplyCheck = page.getByTestId('coordinator-onboarding-item-apps').first();
  await expect(appsRowAfterReplyCheck).toBeVisible();
  await expect(appsRowAfterReplyCheck).not.toHaveAttribute('data-next', 'true');
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);
  await expect
    .poll(() => readPersistedOnboardingStep(coordinator.agentId), { timeout: 10_000 })
    .toBe('email-reply');
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).toHaveCount(0);
  await expect(appsRowAfterReplyCheck).not.toHaveAttribute('data-next', 'true');
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);

  // No skip / resume affordances exist on the platform either.
  await expect(page.getByTestId('coordinator-onboarding-skip')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-resume')).toHaveCount(0);
});

test('workspace demos trigger a unify_message summary and complete from the outbound', async ({
  authedPage: page,
}) => {
  // Connecting the workspace email marks the ``workspace`` connect step
  // done (Orchestra derives it from the BYOD email contact), which unlocks
  // the mailbox / drive / calendar demo steps that depend on it.
  const coordinator = createPersonalCoordinator(user.id);
  connectWorkspaceEmail({ assistantId: coordinator.agentId });
  resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-list-item-${coordinator.agentId}`)).toBeVisible({
    timeout: 15_000,
  });
  await page.keyboard.press('Escape');

  await openOnboardingChecklist(page);
  await selectCoordinatorOnboardingSection(page, 'workspace');

  // All demos are available (the connect step is done) and clickable.
  const mailboxRow = page.getByTestId('coordinator-onboarding-item-workspace-mailbox').first();
  await expect(mailboxRow).toBeVisible();
  await expect(
    page.getByTestId('coordinator-onboarding-item-workspace-drive').first()
  ).toBeVisible();
  await expect(
    page.getByTestId('coordinator-onboarding-item-workspace-calendar').first()
  ).toBeVisible();
  await expect(
    page.getByTestId('coordinator-onboarding-item-workspace-contacts').first()
  ).toBeVisible();
  await expect(
    page.getByTestId('coordinator-onboarding-item-workspace-tasks').first()
  ).toBeVisible();
  // The Microsoft-only Teams demo never surfaces without a connected
  // Microsoft workspace (this connection carries no granted-scopes signal).
  await expect(page.getByTestId('coordinator-onboarding-item-workspace-teams')).toHaveCount(0);
  await expectChecklistItemClickable(page, 'workspace-mailbox');
  await expectChecklistItemClickable(page, 'workspace-drive');
  await expectChecklistItemClickable(page, 'workspace-calendar');
  await expectChecklistItemClickable(page, 'workspace-contacts');
  await expectChecklistItemClickable(page, 'workspace-tasks');

  let stepEventRequests = 0;
  let lastStepId: string | null = null;
  page.on('request', (request) => {
    if (request.url().includes('/api/coordinator-onboarding-step-event')) {
      stepEventRequests += 1;
      try {
        lastStepId = (JSON.parse(request.postData() ?? '{}') as { stepId?: string }).stepId ?? null;
      } catch {
        /* body shape asserted via the request count below */
      }
    }
  });

  // Clicking the row dispatches a single graph-owned step event for the
  // demo and surfaces the in-flight feedback label.
  await mailboxRow.click();
  await expect(
    page.getByTestId('coordinator-onboarding-action-feedback-workspace-mailbox')
  ).toHaveText('Summarizing...');
  await expect.poll(() => stepEventRequests, { timeout: 5_000 }).toBe(1);
  expect(lastStepId).toBe('workspace-mailbox');
  await expect(mailboxRow).not.toHaveAttribute('data-status', 'done');

  // An untagged unify_message is not proof of the demo.
  await seedCoordinatorOutboundTranscript(
    coordinator.agentId,
    'unify_message',
    'Untagged unify_message — not a workspace demo proof.'
  );
  await expect(mailboxRow).not.toHaveAttribute('data-status', 'done');

  // The tagged unify_message summary the assistant delivers completes it.
  await seedCoordinatorOutboundTranscript(
    coordinator.agentId,
    'unify_message',
    "Here's a quick summary of your mailbox.",
    'workspace-mailbox'
  );
  await expect(mailboxRow).toHaveAttribute('data-status', 'done', { timeout: 12_000 });

  // The other demos stay independently actionable.
  await expectChecklistItemClickable(page, 'workspace-drive');
  await expectChecklistItemClickable(page, 'workspace-calendar');
  await expectChecklistItemClickable(page, 'workspace-contacts');
  await expectChecklistItemClickable(page, 'workspace-tasks');
});

test('a connected Microsoft workspace surfaces the Teams-only demo', async ({
  authedPage: page,
}) => {
  // A Microsoft OAuth grant is marked by the canonical
  // ``MICROSOFT_GRANTED_SCOPES`` secret: it both completes the ``workspace``
  // connect step (Orchestra derives it) and identifies the provider, so the
  // Microsoft-only Teams demo renders alongside the shared demos.
  const coordinator = createPersonalCoordinator(user.id);
  dbExec(
    `INSERT INTO assistant_secrets (user_id, agent_id, secret_name, secret_value) ` +
      `VALUES ('${user.id}', ${coordinator.agentId}, 'MICROSOFT_GRANTED_SCOPES', ` +
      `'Files.Read.All ChannelMessage.Read.All Chat.Read') ` +
      `ON CONFLICT (agent_id, secret_name) DO UPDATE SET secret_value = EXCLUDED.secret_value;`
  );
  resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await openOnboardingChecklist(page);
  await selectCoordinatorOnboardingSection(page, 'workspace');

  // The Teams demo is present and actionable for the Microsoft workspace.
  await expect(
    page.getByTestId('coordinator-onboarding-item-workspace-teams').first()
  ).toBeVisible();
  await expectChecklistItemClickable(page, 'workspace-teams');

  // Clicking it dispatches the graph-owned step event and shows the
  // in-flight summarizing feedback, exactly like the shared demos.
  let lastStepId: string | null = null;
  page.on('request', (request) => {
    if (request.url().includes('/api/coordinator-onboarding-step-event')) {
      try {
        lastStepId = (JSON.parse(request.postData() ?? '{}') as { stepId?: string }).stepId ?? null;
      } catch {
        /* body shape asserted via the feedback label below */
      }
    }
  });
  await page.getByTestId('coordinator-onboarding-item-workspace-teams').first().click();
  await expect(
    page.getByTestId('coordinator-onboarding-action-feedback-workspace-teams')
  ).toHaveText('Summarizing...');
  await expect.poll(() => lastStepId, { timeout: 5_000 }).toBe('workspace-teams');

  // Clean up so the seeded Microsoft grant doesn't leak into sibling tests
  // that share this coordinator.
  dbExec(
    `DELETE FROM assistant_secrets WHERE agent_id = ${coordinator.agentId} ` +
      `AND secret_name = 'MICROSOFT_GRANTED_SCOPES';`
  );
});

test('starting a call connects and docks the call in the platform', async ({
  authedPage: page,
}) => {
  await enableDevCalls(page);
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

test('coordinator state exposes a voice intro briefing for onboarding narration', async () => {
  // The first call now uses Unity's bundled recorded opener. The state
  // endpoint still exposes the server-composed orientation briefing for
  // dynamic onboarding narration and non-recorded fallback paths.
  const coordinator = createPersonalCoordinator(user.id);
  resetCoordinatorIntroWatched();

  const res = await orchestraFetch(
    `/v0/assistant/${coordinator.agentId}/state`,
    { method: 'GET' },
    user.apiKey
  );
  expect(res.ok).toBeTruthy();
  const body = (await res.json()) as { info?: Record<string, unknown> } & Record<string, unknown>;
  const info = body.info ?? body;
  const briefing = String(info.voice_intro_briefing ?? info.voiceIntroBriefing ?? '');

  expect(briefing.length).toBeGreaterThan(0);
  expect(briefing).toContain('T dash W 1 N');
  expect(briefing.toLowerCase()).toContain('pause onboarding');
});

test('mobile onboarding keeps the docked T-W1N call visible instead of auto-opening Assistant info', async ({
  authedPage: page,
}) => {
  await enableDevCalls(page);
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

test('resolving the picker persists intro_watched and reload defaults to T-W1N + Assistant info', async ({
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

test('keeps the onboarding checklist visible while navigating assistant sections', async ({
  authedPage: page,
}) => {
  createPersonalCoordinator(user.id);
  resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await expect(page.getByTestId('assistant-info-sheet')).toBeVisible({ timeout: 15_000 });
  await openOnboardingChecklist(page);
  await expect(page.getByTestId('coordinator-onboarding-checklist')).toBeVisible({
    timeout: 15_000,
  });

  for (const { section, pane } of [
    { section: 'actions', pane: 'live-actions-viewer' },
    { section: 'tasks', pane: 'tasks-pane' },
    { section: 'integrations', pane: 'integrations-pane' },
    { section: 'contacts', pane: 'contacts-pane' },
  ] as const) {
    await openRailSection(page, section);
    await expect(page.getByTestId(`rail-section-${section}`)).toHaveAttribute(
      'aria-current',
      'page',
      { timeout: 10_000 }
    );
    await expect(page.getByTestId(pane)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('assistant-info-sheet')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('coordinator-onboarding-checklist')).toBeVisible({
      timeout: 5_000,
    });
  }
});

test('working mode offers a reactivate affordance that re-enters onboarding', async ({
  authedPage: page,
}) => {
  const coordinator = createPersonalCoordinator(user.id);
  resetCoordinatorIntroWatched();

  // Resolve the picker into the platform so the coordinator is selected
  // and the Assistant-info onboarding tab is reachable.
  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  // Exit onboarding: flip the Coordinator/State row to working mode.
  const promote = await orchestraFetch(
    `/v0/assistant/${coordinator.agentId}/state`,
    { method: 'PATCH', body: JSON.stringify({ mode: 'working' }) },
    user.apiKey
  );
  expect(promote.ok).toBeTruthy();

  // Reload so the client reads the working-mode snapshot, then open the
  // Coordinator's onboarding sub-tab.
  await gotoAssistants(page);
  await openOnboardingChecklist(page);

  // Working mode shows the reactivate affordance instead of the checklist.
  await expect(page.getByTestId('coordinator-onboarding-working')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('coordinator-onboarding-checklist')).toHaveCount(0);
  const reactivate = page.getByTestId('coordinator-onboarding-reactivate');
  await expect(reactivate).toBeVisible();

  // Reactivating flips the row back to onboarding and repopulates the
  // checklist directly from the server-derived render.
  await reactivate.click();
  await expect
    .poll(() => readPersistedMode(coordinator.agentId), { timeout: 10_000 })
    .toBe('onboarding');
  await expect(page.getByTestId('coordinator-onboarding-checklist')).toBeVisible({
    timeout: 15_000,
  });
});

test('switching back to T-W1N does not reapply the onboarding focus layout', async ({
  authedPage: page,
}) => {
  const coordinator = createPersonalCoordinator(user.id);
  const otherAssistant = createAssistant({
    userId: user.id,
    firstName: 'Switch',
    surname: 'Unity',
  });
  resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await expect(page.getByTestId('assistant-info-sheet')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('assistant-info-tab-onboarding')).toBeVisible();

  // Close the Coordinator's info sheet, then bounce to another unity and
  // back via the rail's unity switcher.
  await openAssistantInfoPanel(page);
  await expect(page.getByTestId('assistant-info-sheet')).toHaveCount(0);

  await selectAssistantInList(page, otherAssistant.agentId);
  await selectAssistantInList(page, coordinator.agentId);

  // Returning to Twin must not reapply the onboarding focus layout — the
  // info sheet stays closed.
  await expect(page.getByTestId('assistant-info-sheet')).toHaveCount(0);
});
