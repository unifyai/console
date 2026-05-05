/**
 * Seed Scenario: Personal Workspace — Multi-Assistant
 *
 * Variant of `personal-workspace` that hires several assistants for the
 * same owner. Useful for manually exercising multi-assistant features
 * such as the page-level chat stream, unread badges, client-side
 * sharding of the chat-stream subscription, and typing-indicator
 * scoping across the assistant list.
 *
 * **What it creates:**
 *   - 1 user ("owner") with billing account + API key
 *   - N personal assistants (organization_id = NULL), each with chat
 *     infrastructure (contact + Pub/Sub topic) provisioned so inbound
 *     messages can be published to any of them out of the box.
 *
 * **Credentials:**
 *   - `owner` — full access
 */

import type { SeededState } from '../types';
import { createUser, createAssistant, createEmailLogin, seedChatInfrastructure } from '../client';

// Tuned so the workspace exceeds the chat-stream client-side shard size
// (CHAT_STREAM_SHARD_SIZE = 25), exercising multi-shard delivery while
// staying small enough to load comfortably in the UI.
const ASSISTANT_COUNT = 6;

const ASSISTANT_PROFILES: { firstName: string; surname: string }[] = [
  { firstName: 'Ada', surname: 'Lovelace' },
  { firstName: 'Alan', surname: 'Turing' },
  { firstName: 'Grace', surname: 'Hopper' },
  { firstName: 'Linus', surname: 'Torvalds' },
  { firstName: 'Margaret', surname: 'Hamilton' },
  { firstName: 'Donald', surname: 'Knuth' },
];

export async function seedPersonalWorkspaceMulti(): Promise<SeededState> {
  const owner = createUser({ name: 'Personal', lastName: 'Owner' });
  createEmailLogin({ userId: owner.id });

  const assistants = ASSISTANT_PROFILES.slice(0, ASSISTANT_COUNT).map((profile) =>
    createAssistant({
      userId: owner.id,
      firstName: profile.firstName,
      surname: profile.surname,
    })
  );

  // Provision chat infra (contact row + Pub/Sub topic) for every
  // assistant so the page-level chat stream can subscribe to all of
  // them on first load.
  for (const assistant of assistants) {
    await seedChatInfrastructure({
      apiKey: owner.apiKey,
      userId: owner.id,
      assistantId: assistant.agentId,
      email: owner.email,
    });
  }

  return {
    users: { owner },
    assistants,
    credentials: {
      owner: {
        email: owner.email,
        password: 'testpass123',
        apiKey: owner.apiKey,
        userId: owner.id,
      },
    },
  };
}
