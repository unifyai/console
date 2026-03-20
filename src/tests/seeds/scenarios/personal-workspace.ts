/**
 * Seed Scenario: Personal Workspace
 *
 * Creates a single user with a personal assistant (no organization).
 * The simplest scenario — useful for testing personal workspace features.
 *
 * **What it creates:**
 *   - 1 user ("owner") with billing account + API key
 *   - 1 personal assistant (organization_id = NULL)
 *
 * **Credentials:**
 *   - `owner` — full access
 */

import type { SeededState } from '../types';
import { createUser, createAssistant, createEmailLogin, seedChatInfrastructure } from '../client';

export async function seedPersonalWorkspace(): Promise<SeededState> {
  const owner = createUser({ name: 'Personal', lastName: 'Owner' });
  createEmailLogin({ userId: owner.id });

  const assistant = createAssistant({
    userId: owner.id,
    firstName: 'Ada',
    surname: 'Lovelace',
  });

  await seedChatInfrastructure({
    apiKey: owner.apiKey,
    userId: owner.id,
    assistantId: assistant.agentId,
    email: owner.email,
  });

  return {
    users: { owner },
    assistants: [assistant],
    credentials: {
      owner: { email: owner.email, password: 'testpass123', apiKey: owner.apiKey, userId: owner.id },
    },
  };
}

