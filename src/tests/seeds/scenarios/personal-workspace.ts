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
import {
  createUser,
  createAssistant,
  createEmailLogin,
  seedChatInfrastructure,
  seedSecretsViaOrchestra,
} from '../client';

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

  const secrets = await seedSecretsViaOrchestra({
    apiKey: owner.apiKey,
    userId: owner.id,
    assistantId: assistant.agentId,
    secrets: [
      { name: 'OPENAI_API_KEY', value: 'sk-test-openai-key-123' },
      {
        name: 'aws/prod/ACCESS_KEY',
        value: 'AKIAIOSFODNN7EXAMPLE',
        description: 'Production AWS access key',
      },
      { name: 'aws/prod/SECRET_KEY', value: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
      { name: 'aws/staging/ACCESS_KEY', value: 'AKIAI44QH8DHBEXAMPLE' },
      {
        name: 'stripe/SECRET_KEY',
        value: 'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
        description: 'Stripe test secret key',
      },
      { name: 'stripe/WEBHOOK_SECRET', value: 'whsec_test_secret_123' },
    ],
  });

  return {
    users: { owner },
    assistants: [assistant],
    secrets,
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
