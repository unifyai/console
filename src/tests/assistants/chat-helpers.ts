/**
 * Shared helpers for the assistant chat E2E specs.
 *
 * The chat surface is exercised by several specs (core messaging, attachments,
 * search, and the page-level inbox stream). They share the same seeding and
 * navigation primitives but each owns its own user/assistant, so these helpers
 * are exposed as small factories bound to a spec's identities — keeping every
 * call site identical to a single-file suite while letting the files run as
 * independent, parallelizable Playwright shards.
 */

import { expect, type Page } from '@playwright/test';
import {
  navigateToAssistants,
  closeHireDialogIfOpen,
  openUnitySwitcher,
  orchestraFetch,
  type SeededAssistant,
} from './helpers';

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Seed a contact record so that getContactIdByEmail resolves for this user.
 * Bound to a default contactId so call sites mirror the single-file suite.
 */
export function createContactSeeder(defaultContactId: number) {
  return async function seedContact(
    apiKey: string,
    userId: string,
    assistantId: number,
    email: string,
    contactId: number = defaultContactId
  ) {
    /* eslint-disable @typescript-eslint/naming-convention */
    const entries = {
      email_address: email,
      contact_id: contactId,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context: `${userId}/${assistantId}/Contacts`,
          entries: [entries],
        }),
      },
      apiKey
    );
    if (!res.ok) throw new Error(`Failed to seed contact: ${res.status} ${await res.text()}`);
  };
}

export interface SeedTranscriptOpts {
  senderId: number;
  content: string;
  timestamp?: string;
  medium?: string;
  exchangeId?: number;
  receiverIds?: number[];
  selfContactId?: number;
  bossContactId?: number;
  /** Post into a team/group room thread instead of the assistant DM. */
  teamId?: number;
  groupId?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Resolve (get-or-create) the caller's assistant-DM thread in the unified
 * chat store. Cached per (apiKey, assistantId).
 */
const resolvedThreadIds = new Map<string, number>();

export async function resolveAssistantDmThreadId(
  apiKey: string,
  assistantId: number
): Promise<number> {
  const key = `${apiKey}:${assistantId}`;
  const cached = resolvedThreadIds.get(key);
  if (cached !== undefined) return cached;
  const res = await orchestraFetch(
    '/v0/chat/threads/resolve',
    {
      method: 'POST',
      /* eslint-disable-next-line @typescript-eslint/naming-convention */
      body: JSON.stringify({ kind: 'assistant_dm', assistant_id: assistantId }),
    },
    apiKey
  );
  if (!res.ok) throw new Error(`Failed to resolve chat thread: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const threadId = Number(data.thread_id);
  resolvedThreadIds.set(key, threadId);
  return threadId;
}

/**
 * Seed one historical chat message into the unified chat store (the source
 * Console reads history from). Bound to the spec's default self/boss contact
 * ids; a sender matching the assistant's self contact seeds an
 * assistant-authored message via the runtime send route.
 *
 * `medium: 'unify_meet'` seeds a call-transcript utterance instead
 * (`exchangeId` groups utterances into one call).
 */
export function createTranscriptSeeder(defaults: { selfContactId: number; bossContactId: number }) {
  return async function seedTranscript(
    apiKey: string,
    userId: string,
    assistantId: number,
    opts: SeedTranscriptOpts
  ): Promise<number> {
    const selfId = opts.selfContactId ?? defaults.selfContactId;
    const isAssistantAuthored = opts.senderId === selfId;

    if ((opts.medium ?? 'unify_message') === 'unify_meet') {
      const callId = `e2e-call-${assistantId}-${opts.exchangeId ?? 0}`;
      const res = await orchestraFetch(
        `/v0/assistant/${assistantId}/calls/utterances`,
        {
          method: 'POST',
          /* eslint-disable @typescript-eslint/naming-convention */
          body: JSON.stringify({
            call_id: callId,
            utterances: [
              {
                content: opts.content,
                speaker_name: isAssistantAuthored ? 'Assistant' : 'You',
                speaker_assistant_id: isAssistantAuthored ? assistantId : null,
                ...(opts.timestamp ? { spoken_at: opts.timestamp } : {}),
                metadata: opts.metadata ?? {},
              },
            ],
          }),
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        apiKey
      );
      if (!res.ok) throw new Error(`Failed to seed utterance: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return Number(data.utterances?.[0]?.id ?? 0);
    }

    let res: Response;
    if (isAssistantAuthored || opts.teamId !== undefined || opts.groupId !== undefined) {
      // The runtime send route resolves DM/team/group threads server-side.
      /* eslint-disable @typescript-eslint/naming-convention */
      const body: Record<string, unknown> = { content: opts.content };
      if (opts.teamId !== undefined) body.team_id = opts.teamId;
      if (opts.groupId !== undefined) body.group_id = opts.groupId;
      /* eslint-enable @typescript-eslint/naming-convention */
      if (!isAssistantAuthored && (opts.teamId !== undefined || opts.groupId !== undefined)) {
        // Human-authored room message: post via the thread endpoint.
        const scope =
          opts.teamId !== undefined
            ? /* eslint-disable-next-line @typescript-eslint/naming-convention */
              { kind: 'team', team_id: opts.teamId }
            : /* eslint-disable-next-line @typescript-eslint/naming-convention */
              { kind: 'group', group_id: opts.groupId };
        const resolveRes = await orchestraFetch(
          '/v0/chat/threads/resolve',
          { method: 'POST', body: JSON.stringify(scope) },
          apiKey
        );
        if (!resolveRes.ok) {
          throw new Error(`Failed to resolve room thread: ${resolveRes.status}`);
        }
        const thread = await resolveRes.json();
        res = await orchestraFetch(
          `/v0/chat/threads/${thread.thread_id}/messages`,
          { method: 'POST', body: JSON.stringify({ content: opts.content }) },
          apiKey
        );
      } else {
        res = await orchestraFetch(
          `/v0/assistant/${assistantId}/chat/messages`,
          { method: 'POST', body: JSON.stringify(body) },
          apiKey
        );
      }
    } else {
      const threadId = await resolveAssistantDmThreadId(apiKey, assistantId);
      res = await orchestraFetch(
        `/v0/chat/threads/${threadId}/messages`,
        { method: 'POST', body: JSON.stringify({ content: opts.content }) },
        apiKey
      );
    }
    if (!res.ok) throw new Error(`Failed to seed chat message: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return Number(data.id);
  };
}

// ---------------------------------------------------------------------------
// Pub/Sub emulator helpers
// ---------------------------------------------------------------------------
//
// The local `./scripts/local.sh --chat` harness runs a Pub/Sub emulator on
// `localhost:8085` under project `local-test-project`, and Console's SSE
// routes derive topic names as `unity-{agentId}-staging` (see `getTopicName`).
// These helpers mirror what the Communication adapters and Unity's
// `echo_responder.py` publish, so tests can inject a live assistant reply
// without standing up the full adapter pipeline.
//
// Topics must exist before subscriptions can pull from them, and the Pub/Sub
// client in Console creates subscriptions lazily on first SSE connect — so
// tests that want to exercise the page-level chat-stream must pre-create the
// topic via `ensurePubSubTopic` to avoid the SSE route returning a 500 on
// startup.

const PUBSUB_EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST || 'localhost:8085';
const PUBSUB_PROJECT_ID = process.env.GCP_PROJECT_ID || 'local-test-project';
const PUBSUB_TOPIC_SUFFIX = process.env.PUBSUB_TOPIC_SUFFIX ?? '-staging';

function pubsubEmulatorUrl(path: string): string {
  const base = PUBSUB_EMULATOR_HOST.startsWith('http')
    ? PUBSUB_EMULATOR_HOST
    : `http://${PUBSUB_EMULATOR_HOST}`;
  return `${base}/v1${path}`;
}

export function pubsubEmulatorConfigured(): boolean {
  return !!process.env.PUBSUB_EMULATOR_HOST?.trim();
}

function assistantTopicName(assistantId: number): string {
  return `unity-${assistantId}${PUBSUB_TOPIC_SUFFIX}`;
}

async function ensureTopic(topicName: string): Promise<void> {
  const url = pubsubEmulatorUrl(`/projects/${PUBSUB_PROJECT_ID}/topics/${topicName}`);
  const res = await fetch(url, { method: 'PUT' });
  // 200 = created, 409 = already exists — both fine.
  if (!res.ok && res.status !== 409) {
    throw new Error(`ensureTopic(${topicName}) failed: ${res.status} ${await res.text()}`);
  }
}

async function publishToTopic(
  topicName: string,
  payload: Record<string, unknown>,
  attributes: Record<string, string>
): Promise<void> {
  await ensureTopic(topicName);
  const body = {
    messages: [
      {
        data: Buffer.from(JSON.stringify(payload)).toString('base64'),
        attributes,
      },
    ],
  };
  const url = pubsubEmulatorUrl(`/projects/${PUBSUB_PROJECT_ID}/topics/${topicName}:publish`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`publishToTopic(${topicName}) failed: ${res.status} ${await res.text()}`);
  }
}

export async function ensurePubSubTopic(assistantId: number): Promise<void> {
  await ensureTopic(assistantTopicName(assistantId));
}

export async function publishUnifyMessageOutbound(
  assistantId: number,
  opts: { content: string; contactId: number; userId?: string; messageId?: number }
): Promise<void> {
  const topicName = assistantTopicName(assistantId);
  /* eslint-disable @typescript-eslint/naming-convention */
  const event: Record<string, unknown> = {
    kind: 'assistant_dm',
    assistant_id: assistantId,
    sender_kind: 'assistant',
    content: opts.content,
    timestamp: new Date().toISOString(),
  };
  if (opts.userId) event.user_id = opts.userId;
  if (opts.messageId !== undefined) event.id = opts.messageId;
  /* eslint-enable @typescript-eslint/naming-convention */
  await publishToTopic(
    topicName,
    { thread: 'chat_message', event },
    { thread: 'chat_message', kind: 'assistant_dm' }
  );
}

/**
 * Convert a Console SSE-shaped ManagerMethod frame (used by /actions/push)
 * into the flat Unity EventBus payload the emulator Actions path expects.
 */
export function sseManagerEventToUnityPayload(event: {
  type: string;
  data: { id: number; ts: string; entries: Record<string, unknown> };
}): Record<string, unknown> {
  const entries = event.data.entries;
  /* eslint-disable @typescript-eslint/naming-convention */
  return {
    row_id: event.data.id,
    event_id: entries.eventId,
    calling_id: entries.callingId,
    event_timestamp: entries.eventTimestamp ?? event.data.ts,
    type: event.type,
    manager: entries.manager,
    method: entries.method,
    phase: entries.phase,
    hierarchy: entries.hierarchy,
    hierarchy_label: entries.hierarchyLabel,
    display_label: entries.displayLabel,
    status: entries.status,
    question: entries.question,
    answer: entries.answer,
    request: entries.request,
  };
  /* eslint-enable @typescript-eslint/naming-convention */
}

/**
 * Publish a Unity EventBus-shaped action_event to the assistant topic.
 * Matches what Console's Actions SSE route reshapes for the browser.
 */
export async function publishActionEventToEmulator(
  assistantId: number,
  event: Record<string, unknown>
): Promise<void> {
  await publishToTopic(
    assistantTopicName(assistantId),
    { thread: 'action_event', event },
    { thread: 'action_event' }
  );
}

/** Publish a comms_activity frame used by the call-window working pose. */
export async function publishCommsActivityToEmulator(
  assistantId: number,
  event: { medium: string; direction: 'inbound' | 'outbound' }
): Promise<void> {
  await publishToTopic(
    assistantTopicName(assistantId),
    { thread: 'comms_activity', event },
    { thread: 'comms_activity' }
  );
}

export async function ensureBillingPubSubTopic(billingAccountId: number): Promise<void> {
  await ensureTopic(`billing-account-${billingAccountId}${PUBSUB_TOPIC_SUFFIX}`);
}

export async function publishBillingEventToEmulator(
  billingAccountId: number,
  event: { event_type: string; balance: number }
): Promise<void> {
  /* eslint-disable @typescript-eslint/naming-convention */
  const payload = {
    billing_account_id: billingAccountId,
    event_type: event.event_type,
    balance: event.balance,
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  await publishToTopic(`billing-account-${billingAccountId}${PUBSUB_TOPIC_SUFFIX}`, payload, {
    thread: 'billing_event',
  });
}

// ---------------------------------------------------------------------------
// Chat surface locators
// ---------------------------------------------------------------------------

/** Main chat composer (not the About/bio field in the info panel). */
export function chatComposer(page: Page) {
  return page.getByRole('textbox', { name: 'Send a message...' });
}

/** Wait until contact resolution finished and the composer can send. */
export async function waitForChatSendReady(page: Page, timeout = 60_000): Promise<void> {
  const composer = chatComposer(page);
  await expect(composer).toBeEnabled({ timeout });
  await composer.fill('…');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled({ timeout });
  await composer.fill('');
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Open an assistant's chat from the rail's unity switcher and wait for the
 * chat scroll area. Bound to a default assistant so call sites stay terse.
 */
export function createOpenAssistantChat(defaultAssistant: SeededAssistant) {
  return async function openAssistantChat(page: Page, targetAssistant = defaultAssistant) {
    await navigateToAssistants(page);
    await closeHireDialogIfOpen(page);
    await openUnitySwitcher(page);

    const listItem = page.getByTestId(`assistant-list-item-${targetAssistant.agentId}`);
    await expect(listItem).toBeVisible({ timeout: 15_000 });
    await listItem.click();
    await page.waitForTimeout(2_000);

    const chatArea = page.getByTestId('chat-scroll-area');
    await expect(chatArea).toBeVisible({ timeout: 10_000 });

    const closeInfo = page.getByRole('button', { name: 'Close assistant info' });
    if (await closeInfo.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeInfo.click();
    }

    await expect(chatComposer(page)).toBeEnabled({ timeout: 20_000 });
    await waitForChatSendReady(page);
  };
}
