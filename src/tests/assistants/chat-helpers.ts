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
  context?: string;
  selfContactId?: number;
  bossContactId?: number;
  authoringAssistantId?: number | null;
}

/**
 * Seed a transcript log entry (a historical chat message). Bound to the
 * spec's default self/boss contact ids; per-call overrides via opts.
 */
export function createTranscriptSeeder(defaults: { selfContactId: number; bossContactId: number }) {
  let messageCounter = 1000;

  return async function seedTranscript(
    apiKey: string,
    userId: string,
    assistantId: number,
    opts: SeedTranscriptOpts
  ): Promise<number> {
    const msgId = messageCounter++;
    const ts = opts.timestamp || new Date().toISOString();
    const selfId = opts.selfContactId ?? defaults.selfContactId;
    const bossId = opts.bossContactId ?? defaults.bossContactId;

    /* eslint-disable @typescript-eslint/naming-convention */
    const entries: Record<string, unknown> = {
      medium: opts.medium ?? 'unify_message',
      sender_id: opts.senderId,
      receiver_ids: opts.receiverIds ?? (opts.senderId === selfId ? [bossId] : [selfId]),
      content: opts.content,
      message_id: msgId,
      timestamp: ts,
    };
    if (opts.exchangeId !== undefined) entries.exchange_id = opts.exchangeId;
    if ('authoringAssistantId' in opts) {
      entries.authoring_assistant_id = opts.authoringAssistantId;
    }
    /* eslint-enable @typescript-eslint/naming-convention */

    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context: opts.context ?? `${userId}/${assistantId}/Transcripts`,
          entries: [entries],
        }),
      },
      apiKey
    );
    if (!res.ok) throw new Error(`Failed to seed transcript: ${res.status} ${await res.text()}`);
    return msgId;
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

function pubsubEmulatorUrl(path: string): string {
  const base = PUBSUB_EMULATOR_HOST.startsWith('http')
    ? PUBSUB_EMULATOR_HOST
    : `http://${PUBSUB_EMULATOR_HOST}`;
  return `${base}/v1${path}`;
}

export async function ensurePubSubTopic(assistantId: number): Promise<void> {
  const topicName = `unity-${assistantId}-staging`;
  const url = pubsubEmulatorUrl(`/projects/${PUBSUB_PROJECT_ID}/topics/${topicName}`);
  const res = await fetch(url, { method: 'PUT' });
  // 200 = created, 409 = already exists — both fine.
  if (!res.ok && res.status !== 409) {
    throw new Error(`ensurePubSubTopic(${topicName}) failed: ${res.status} ${await res.text()}`);
  }
}

export async function publishUnifyMessageOutbound(
  assistantId: number,
  opts: { content: string; contactId: number }
): Promise<void> {
  const topicName = `unity-${assistantId}-staging`;
  const payload = {
    thread: 'unify_message_outbound',
    event: {
      content: opts.content,
      role: 'assistant',
      /* eslint-disable-next-line @typescript-eslint/naming-convention */
      contact_id: opts.contactId,
    },
  };
  const body = {
    messages: [
      {
        data: Buffer.from(JSON.stringify(payload)).toString('base64'),
        attributes: { thread: 'unify_message_outbound' },
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
    throw new Error(
      `publishUnifyMessageOutbound(${topicName}) failed: ${res.status} ${await res.text()}`
    );
  }
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
  };
}
