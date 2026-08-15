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
 *   - Choosing "Start Call" dismisses the picker immediately and lands in
 *     the regular platform with the call docked in the Coordinator's
 *     right pane; the meet window shows the usual connecting states
 *     while the call comes up.
 *   - Resolving the picker persists ``intro_watched`` on the
 *     Coordinator/State row, so a reload skips the picker and lands
 *     directly on the regular platform.
 *   - There is no "Skip onboarding" or "Resume onboarding" affordance
 *     anywhere. When onboarding is inactive (``onboarding_active === false``)
 *     the checklist body offers a single "Return to onboarding" control that
 *     flips the row back to active and repopulates the checklist.
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
  createAssistant,
  createAssistantTest,
  createTestUser,
  cleanupUser,
  connectWorkspaceEmail,
  createPersonalCoordinator,
  dbExec,
  deleteAllAssistantsForUser,
  orchestraFetch,
  openRailSection,
  openUnitySwitcher,
  selectAssistantInList,
} from './helpers';
import { railSection, railUnitySwitcher } from '../helpers/shell';

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

/**
 * Open the Coordinator's "Assistant info" panel onboarding sub-tab.
 *
 * While onboarding is running the top bar carries the onboarding progress
 * shortcut in that slot instead of the generic assistant-info toggle, so the
 * two affordances are mutually exclusive.
 */
async function openOnboardingChecklist(page: Page) {
  const onboardingTab = page.getByTestId('assistant-info-tab-onboarding');
  if (!(await onboardingTab.isVisible({ timeout: 5_000 }).catch(() => false))) {
    // Which affordance the top bar carries depends on onboarding state, and
    // both arrive only once the coordinator and its state have loaded.
    // The unified shell mounts a second, hidden copy of both, so match the
    // visible instance rather than a bare test id.
    const onboardingShortcut = page
      .locator('[data-testid="top-nav-onboarding-shortcut"]:visible')
      .last();
    const infoPanelButton = page.locator('[data-testid="assistant-info-button"]:visible').last();
    const isShortcutVisible = () => onboardingShortcut.isVisible().catch(() => false);
    await expect
      .poll(
        async () => {
          if (await isShortcutVisible()) return 'shortcut';
          if (await infoPanelButton.isVisible().catch(() => false)) return 'info-button';
          return 'pending';
        },
        { timeout: 30_000 }
      )
      .not.toBe('pending');

    await ((await isShortcutVisible()) ? onboardingShortcut : infoPanelButton).click();
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

async function selectCoordinatorCommunicationSubgroup(page: Page, subgroupId: string) {
  const toggle = page.getByTestId(`coordinator-onboarding-communication-${subgroupId}-toggle`);
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

/** The "My computer" section's own row, proving the section expanded. */
async function expectMyComputerRowVisible(page: Page) {
  await expect(
    page.getByTestId('coordinator-onboarding-item-my-computer-demo').first()
  ).toBeVisible();
}

/**
 * Restore the fresh picker on the shared workspace coordinator.
 *
 * Resolving the picker latches ``intro_watched`` on the latest
 * Coordinator/State row (one-way sticky through the API). The shared test
 * fixture also pauses onboarding up front (``onboarding_active: false``) so
 * legacy flows get the standard shell; the picker gate in ``Main.tsx`` stays
 * suppressed while onboarding is inactive. Picker-expecting tests therefore reuse a
 * single coordinator and restore the genuine first-time state on the latest
 * row directly — ``intro_watched`` back to false and ``onboarding_active``
 * back to true — so the next visit shows the picker exactly like a first-time user.
 *
 * The preceding resolution's write is async, so a single update can land before
 * it and be overwritten. Re-apply until the read-back sticks, which converges
 * as soon as that write has arrived.
 */
async function resetCoordinatorIntroWatched() {
  await expect
    .poll(
      () => {
        dbExec(
          `UPDATE log_event SET data = ` +
            `jsonb_set(jsonb_set(data, '{intro_watched}', 'false'), '{onboarding_active}', 'true') ` +
            `WHERE id = (SELECT le.id FROM log_event le ` +
            `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
            `JOIN context c ON c.id = lec.context_id ` +
            `WHERE c.name LIKE '${user.id}/%/Coordinator/State' ` +
            `ORDER BY le.id DESC LIMIT 1);`
        );
        return readPersistedIntroWatched();
      },
      { timeout: 15_000 }
    )
    .toBe('false');
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

/** Read the latest persisted ``onboarding_active`` flag for the user's coordinator. */
function readPersistedOnboardingActive(coordinatorId: string | number): string {
  return dbExec(
    `SELECT le.data->>'onboarding_active' FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name = '${user.id}/${coordinatorId}/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1;`
  );
}

/** Read persisted ``skipped_step_ids`` for the user's coordinator. */
function readPersistedSkippedStepIds(coordinatorId: string | number): string[] {
  const raw = dbExec(
    `SELECT le.data->'skipped_step_ids' FROM log_event le ` +
      `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
      `JOIN context c ON c.id = lec.context_id ` +
      `WHERE c.name = '${user.id}/${coordinatorId}/Coordinator/State' ` +
      `ORDER BY le.id DESC LIMIT 1;`
  ).trim();
  if (!raw || raw === '' || raw === 'null') return [];
  return JSON.parse(raw) as string[];
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

/**
 * Mark an onboarding step complete via the same Orchestra state PATCH the brain
 * uses (``set_onboarding_task_state`` -> ``onboarding_step_completion``). This is
 * how workspace and integration demos — multi-part tasks that do not auto-complete
 * from an outbound — are finished: the assistant does the whole task, then
 * explicitly sets the step done.
 */
async function markCoordinatorOnboardingStepComplete(
  coordinatorId: string | number,
  stepId: string
) {
  const response = await orchestraFetch(
    `/v0/assistant/${coordinatorId}/state`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        onboarding_step_completion: { step_id: stepId, completed: true },
      }),
    },
    user.apiKey
  );
  expect(response.ok).toBeTruthy();
}

test('picker shows on first visit with no skip or resume affordance @critical @area(assistants.coordinator-onboarding)', async ({
  authedPage: page,
}) => {
  await resetCoordinatorIntroWatched();
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
  await resetCoordinatorIntroWatched();

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
  // Discord's first step is the contact-detail row, so the arrow points past
  // the locked connect row to the actionable prerequisite behind it.
  await expect(page.getByTestId('coordinator-onboarding-blocking-arrow-discord-id')).toHaveText(
    '← Next'
  );
  await expect(
    page.getByTestId('coordinator-onboarding-blocking-arrow-discord-connect')
  ).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);

  await selectCoordinatorOnboardingSection(page, 'my-computer');
  await expectMyComputerRowVisible(page);

  await selectCoordinatorOnboardingSection(page, 'workspace');
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).toBeVisible();
  await expectChecklistItemClickable(page, 'workspace');
  await expect(page.getByTestId('coordinator-onboarding-item-act')).toHaveCount(0);
});

test('picking chat lands in the full platform with the checklist in Assistant info @critical @area(assistants.coordinator-onboarding)', async ({
  authedPage: page,
}) => {
  // Simulate an earlier session's workspace OAuth so the checklist has a
  // pre-completed step to show — Orchestra derives the ``workspace`` step
  // as done from the BYOD email contact on the Coordinator/State read.
  const coordinator = createPersonalCoordinator(user.id);
  connectWorkspaceEmail({ assistantId: coordinator.agentId });
  await resetCoordinatorIntroWatched();

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
  await expectMyComputerRowVisible(page);
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
  await expect(page.getByTestId('request-sent-ack-label').last()).toContainText('Request sent:');
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
  await expect(page.getByTestId('request-sent-ack-label').last()).toContainText('Request sent:');
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

test('workspace demos complete only when the assistant explicitly marks them done', async ({
  authedPage: page,
}) => {
  // Connecting the workspace email marks the ``workspace`` connect step
  // done (Orchestra derives it from the BYOD email contact), which unlocks
  // the mailbox / drive / calendar demo steps that depend on it. The
  // granted-scopes secret (written by the real OAuth flow) additionally
  // gates the calendar demo, which only renders once calendar was granted;
  // seed a grant that includes calendar so all three demos surface.
  const coordinator = createPersonalCoordinator(user.id);
  connectWorkspaceEmail({ assistantId: coordinator.agentId });
  dbExec(
    `INSERT INTO assistant_secrets (user_id, agent_id, secret_name, secret_value) ` +
      `VALUES ('${user.id}', ${coordinator.agentId}, 'GOOGLE_GRANTED_SCOPES', ` +
      `'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events ` +
      `https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.send ` +
      `https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify ` +
      `https://www.googleapis.com/auth/userinfo.email') ` +
      `ON CONFLICT (agent_id, secret_name) DO UPDATE SET secret_value = EXCLUDED.secret_value;`
  );
  await resetCoordinatorIntroWatched();

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
  await expectChecklistItemClickable(page, 'workspace-mailbox');
  await expectChecklistItemClickable(page, 'workspace-drive');
  await expectChecklistItemClickable(page, 'workspace-calendar');

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
  await expect(page.getByTestId('request-sent-ack-label').last()).toContainText('Request sent:');
  await expect(
    page.getByTestId('coordinator-onboarding-action-feedback-workspace-mailbox')
  ).toHaveText('Summarizing...');
  await expect.poll(() => stepEventRequests, { timeout: 5_000 }).toBe(1);
  expect(lastStepId).toBe('workspace-mailbox');
  await expect(mailboxRow).not.toHaveAttribute('data-status', 'done');

  // A workspace demo is a multi-part task: the assistant's summary outbound —
  // even one tagged for the step — must NOT auto-complete it. Only an explicit
  // set_onboarding_task_state call does. Seed both the untagged and tagged
  // summaries and confirm neither flips the row to done.
  await seedCoordinatorOutboundTranscript(
    coordinator.agentId,
    'unify_message',
    'Untagged unify_message — not a workspace demo proof.'
  );
  await expect(mailboxRow).not.toHaveAttribute('data-status', 'done');
  await seedCoordinatorOutboundTranscript(
    coordinator.agentId,
    'unify_message',
    "Here's a quick summary of your mailbox.",
    'workspace-mailbox'
  );
  await expect(mailboxRow).not.toHaveAttribute('data-status', 'done');

  // The assistant finishes the whole task and marks the step done via the
  // Orchestra state PATCH — that is what completes the demo.
  await markCoordinatorOnboardingStepComplete(coordinator.agentId, 'workspace-mailbox');
  await expect(mailboxRow).toHaveAttribute('data-status', 'done', { timeout: 12_000 });

  // The other demos stay independently actionable.
  await expectChecklistItemClickable(page, 'workspace-drive');
  await expectChecklistItemClickable(page, 'workspace-calendar');
});

test('integration onboarding dispatches row and chip events through to explicit completion', async ({
  authedPage: page,
}) => {
  const coordinator = createPersonalCoordinator(user.id);
  connectWorkspaceEmail({ assistantId: coordinator.agentId });
  await resetCoordinatorIntroWatched();

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
  await selectCoordinatorOnboardingSection(page, 'integrations');

  const appsRow = page.getByTestId('coordinator-onboarding-item-apps').first();
  await expect(appsRow).toBeVisible();
  await expectChecklistItemClickable(page, 'apps');
  await expect(page.getByTestId('coordinator-onboarding-suggestion-crm-sales')).toBeVisible();
  await expect(
    page.getByTestId('coordinator-onboarding-item-integration-read').first()
  ).toHaveAttribute('data-status', 'locked');

  const stepEvents: Array<{ stepId?: string; chipId?: string }> = [];
  page.on('request', (request) => {
    if (!request.url().includes('/api/coordinator-onboarding-step-event')) return;
    try {
      stepEvents.push(
        JSON.parse(request.postData() ?? '{}') as { stepId?: string; chipId?: string }
      );
    } catch {
      stepEvents.push({});
    }
  });

  await page.getByTestId('coordinator-onboarding-suggestion-crm-sales').click();
  await expect.poll(() => stepEvents.length, { timeout: 5_000 }).toBe(1);
  expect(stepEvents[0]).toEqual({ stepId: 'apps', chipId: 'crm-sales' });
  await expect(appsRow).not.toHaveAttribute('data-status', 'done');

  await markCoordinatorOnboardingStepComplete(coordinator.agentId, 'apps');
  await expect(appsRow).toHaveAttribute('data-status', 'done', { timeout: 12_000 });

  const readRow = page.getByTestId('coordinator-onboarding-item-integration-read').first();
  await expect(readRow).toHaveAttribute('data-next', 'true', { timeout: 10_000 });
  await expectChecklistItemClickable(page, 'integration-read');
  await expect(
    page.getByTestId('coordinator-onboarding-suggestion-crm-pipeline-summary')
  ).toBeVisible();

  await page.getByTestId('coordinator-onboarding-suggestion-crm-pipeline-summary').click();
  await expect(
    page.getByTestId('coordinator-onboarding-action-feedback-integration-read')
  ).toHaveText('Reading...');
  await expect.poll(() => stepEvents.length, { timeout: 5_000 }).toBe(2);
  expect(stepEvents[1]).toEqual({
    stepId: 'integration-read',
    chipId: 'crm-pipeline-summary',
  });
  await expect(readRow).not.toHaveAttribute('data-status', 'done');

  await seedCoordinatorOutboundTranscript(
    coordinator.agentId,
    'unify_message',
    'Here is a brief from the connected CRM.',
    'integration-read'
  );
  await expect(readRow).not.toHaveAttribute('data-status', 'done');

  await markCoordinatorOnboardingStepComplete(coordinator.agentId, 'integration-read');
  await expect(readRow).toHaveAttribute('data-status', 'done', { timeout: 12_000 });

  const actionRow = page.getByTestId('coordinator-onboarding-item-integration-action').first();
  await expect(actionRow).toHaveAttribute('data-next', 'true', { timeout: 10_000 });
  await expectChecklistItemClickable(page, 'integration-action');
  await expect(
    page.getByTestId('coordinator-onboarding-suggestion-take-concrete-action')
  ).toBeVisible();

  await actionRow.click();
  await expect(
    page.getByTestId('coordinator-onboarding-action-feedback-integration-action')
  ).toHaveText('Working...');
  await expect.poll(() => stepEvents.length, { timeout: 5_000 }).toBe(3);
  expect(stepEvents[2]).toEqual({ stepId: 'integration-action' });
  await markCoordinatorOnboardingStepComplete(coordinator.agentId, 'integration-action');
  await expect(actionRow).toHaveAttribute('data-status', 'done', { timeout: 12_000 });
});

test('the calendar demo only renders once the calendar scope is granted', async ({
  authedPage: page,
}) => {
  // A workspace connected without the calendar scope: the drive demo (which
  // has no scope gate) still surfaces, but the calendar demo stays hidden
  // until the user grants calendar access.
  const coordinator = createPersonalCoordinator(user.id);
  connectWorkspaceEmail({ assistantId: coordinator.agentId });
  dbExec(
    `INSERT INTO assistant_secrets (user_id, agent_id, secret_name, secret_value) ` +
      `VALUES ('${user.id}', ${coordinator.agentId}, 'GOOGLE_GRANTED_SCOPES', ` +
      `'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.send ` +
      `https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify ` +
      `https://www.googleapis.com/auth/userinfo.email') ` +
      `ON CONFLICT (agent_id, secret_name) DO UPDATE SET secret_value = EXCLUDED.secret_value;`
  );
  await resetCoordinatorIntroWatched();

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

  // Drive still renders; calendar is gated out until calendar is granted.
  await expect(
    page.getByTestId('coordinator-onboarding-item-workspace-drive').first()
  ).toBeVisible();
  await expectChecklistItemClickable(page, 'workspace-drive');
  await expect(page.getByTestId('coordinator-onboarding-item-workspace-calendar')).toHaveCount(0);
});

test('starting a call connects and docks the call in the platform @critical @area(assistants.coordinator-onboarding)', async ({
  authedPage: page,
}) => {
  await enableDevCalls(page);
  await resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);

  await page.getByTestId('coordinator-onboarding-start-call').click({ force: true });

  // Picker dismisses immediately; the docked meet window handles connecting.
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 10_000 });

  await expect(page.getByTestId('assistant-call-docked')).toBeVisible({ timeout: 40_000 });

  // Hang up to leave a clean state for subsequent tests.
  await page.getByRole('button', { name: 'End call' }).click();
});

test('mobile onboarding keeps the docked T-W1N call visible instead of auto-opening Assistant info', async ({
  authedPage: page,
}) => {
  await enableDevCalls(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);

  await page.getByTestId('coordinator-onboarding-start-call').click({ force: true });
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 10_000 });

  await expect(page.getByTestId('assistant-call-docked')).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId('assistant-info-sheet')).toHaveCount(0);
  await expect.poll(() => readPersistedIntroWatched(), { timeout: 10_000 }).toBe('true');

  await page.getByRole('button', { name: 'End call' }).click();
});

test('resolving the picker persists intro_watched and reload lands on T-W1N without auto-opening Assistant info @critical @area(assistants.coordinator-onboarding)', async ({
  authedPage: page,
}) => {
  await resetCoordinatorIntroWatched();
  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await expect.poll(() => readPersistedIntroWatched(), { timeout: 10_000 }).toBe('true');

  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.getByTestId('assistant-info-sheet')).toHaveCount(0);
  await openOnboardingChecklist(page);
  await expect(page.getByTestId('coordinator-onboarding-checklist')).toBeVisible({
    timeout: 15_000,
  });
});

test('keeps the onboarding checklist visible while navigating assistant sections', async ({
  authedPage: page,
}) => {
  createPersonalCoordinator(user.id);
  await resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await expect(page.getByTestId('assistant-info-sheet')).toHaveCount(0);
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
    // Scope to the live rail: the unified shell keeps a second, hidden rail
    // mounted, and a bare test id matches both.
    await expect(railSection(page, section)).toHaveAttribute('aria-current', 'page', {
      timeout: 10_000,
    });
    await expect(page.getByTestId(pane)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('assistant-info-sheet')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('coordinator-onboarding-checklist')).toBeVisible({
      timeout: 5_000,
    });
  }
});

test('inactive onboarding offers a return affordance that re-enters onboarding', async ({
  authedPage: page,
}) => {
  const coordinator = createPersonalCoordinator(user.id);
  await resetCoordinatorIntroWatched();

  // Resolve the picker into the platform so the coordinator is selected
  // and the Assistant-info onboarding tab is reachable.
  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  // Deactivate onboarding.
  const deactivate = await orchestraFetch(
    `/v0/assistant/${coordinator.agentId}/state`,
    { method: 'PATCH', body: JSON.stringify({ onboarding_active: false }) },
    user.apiKey
  );
  expect(deactivate.ok).toBeTruthy();

  // Reload so the client reads the inactive snapshot, then open the
  // Coordinator's onboarding sub-tab.
  await gotoAssistants(page);
  await openOnboardingChecklist(page);

  // Inactive onboarding shows the return affordance instead of the checklist.
  await expect(page.getByTestId('coordinator-onboarding-inactive')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId('coordinator-onboarding-checklist')).toHaveCount(0);
  const returnButton = page.getByTestId('coordinator-onboarding-return');
  await expect(returnButton).toBeVisible();

  // Returning flips the row back to active and repopulates the checklist
  // directly from the server-derived render.
  await returnButton.click();
  await expect
    .poll(() => readPersistedOnboardingActive(coordinator.agentId), { timeout: 10_000 })
    .toBe('true');
  await expect(page.getByTestId('coordinator-onboarding-checklist')).toBeVisible({
    timeout: 15_000,
  });
});

test('skipping an actionable checklist row does not trigger the row action', async ({
  authedPage: page,
}) => {
  // Regression: the row "..." menu is a React child of the actionable row but
  // portaled in the DOM. React still bubbles portal clicks up the component
  // tree, so selecting Skip used to also fire the row action (e.g. opening
  // Slack connect). Prefer Slack when that action is wired; otherwise use the
  // always-wired email reference trigger.
  const coordinator = createPersonalCoordinator(user.id);
  await resetCoordinatorIntroWatched();

  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await openOnboardingChecklist(page);
  await selectCoordinatorOnboardingSection(page, 'communication');

  await selectCoordinatorCommunicationSubgroup(page, 'slack');
  const slackRow = page.getByTestId('coordinator-onboarding-item-slack-connect').first();
  await expect(slackRow).toBeVisible({ timeout: 15_000 });
  const slackActionable = (await slackRow.getAttribute('role')) === 'button';

  const stepId = slackActionable ? 'slack-connect' : 'email-reference';
  if (!slackActionable) {
    await selectCoordinatorCommunicationSubgroup(page, 'email');
  }

  const row = page.getByTestId(`coordinator-onboarding-item-${stepId}`).first();
  await expectChecklistItemClickable(page, stepId);
  await row.hover();
  await page.getByTestId(`coordinator-onboarding-row-menu-${stepId}`).click();
  await page.getByTestId(`coordinator-onboarding-skip-${stepId}`).click();

  await expect(row).toHaveAttribute('data-status', 'skipped', { timeout: 10_000 });
  await expect(page.getByTestId(`coordinator-onboarding-action-feedback-${stepId}`)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add to Slack' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect
    .poll(() => readPersistedSkippedStepIds(coordinator.agentId), { timeout: 10_000 })
    .toEqual(expect.arrayContaining([stepId]));
});

test('opening onboarding from the top bar confirms before switching away from another teammate', async ({
  authedPage: page,
}) => {
  createPersonalCoordinator(user.id);
  const other = createAssistant({ userId: user.id, firstName: 'Sidebar', surname: 'Teammate' });

  await resetCoordinatorIntroWatched();

  // Resolve the picker into the platform, leaving onboarding running so the
  // top-bar shortcut renders.
  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding')).toBeHidden({ timeout: 15_000 });

  await selectAssistantInList(page, other.agentId);
  const switcher = railUnitySwitcher(page);
  await expect(switcher).toContainText('Sidebar', { timeout: 15_000 });

  // The shortcut names both sides of the switch instead of performing it.
  await page.getByTestId('top-nav-onboarding-shortcut').first().click();
  const confirmDialog = page.getByTestId('onboarding-switch-teammate-dialog');
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
  await expect(confirmDialog).toContainText('T-W1N');
  await expect(confirmDialog).toContainText('Sidebar Teammate');

  // Cancelling leaves the selection where it was.
  await page.getByTestId('onboarding-switch-teammate-cancel').click();
  await expect(confirmDialog).toHaveCount(0, { timeout: 10_000 });
  await expect(switcher).toContainText('Sidebar');
  await expect(page.getByTestId('coordinator-onboarding-checklist')).toHaveCount(0);

  // Confirming selects the Coordinator and opens its onboarding checklist.
  await page.getByTestId('top-nav-onboarding-shortcut').first().click();
  await page.getByTestId('onboarding-switch-teammate-confirm').click();
  await expect(confirmDialog).toHaveCount(0, { timeout: 10_000 });
  await expect(switcher).toContainText('T-W1N', { timeout: 15_000 });
  await expect(page.getByTestId('coordinator-onboarding-checklist')).toBeVisible({
    timeout: 15_000,
  });
});
