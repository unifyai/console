/**
 * Seed Scenario: Personal Workspace
 *
 * Creates a single user with a personal assistant (no organization).
 * The simplest scenario — useful for testing personal workspace features.
 *
 * **What it creates:**
 *   - 1 user ("owner") with billing account + API key
 *   - 1 personal assistant (organization_id = NULL)
 *   - 1 user ("returningOwner") whose Coordinator is still onboarding
 *     but already has a BYOD workspace connected — for walking the
 *     "resume onboarding with pre-completed steps" flow
 *
 * **Credentials:**
 *   - `owner` — full access
 *   - `returningOwner` — Coordinator onboarding with workspace done
 */

import type { SeededState } from '../types';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  connectWorkspaceEmail,
  seedChatInfrastructure,
  seedCoordinatorChatForUsers,
  seedSecretsViaOrchestra,
  dbExecBlock,
} from '../client';

export async function seedPersonalWorkspace(): Promise<SeededState> {
  const owner = createUser({ name: 'Personal', lastName: 'Owner' });
  createEmailLogin({ userId: owner.id });

  // A returning user mid-onboarding: their Coordinator already holds a
  // user-provisioned workspace mailbox (the row the workspace OAuth
  // callback writes), so Orchestra derives the ``workspace`` step as
  // complete and both the checklist and the unity's opener must pick
  // up from "connect your apps" instead of re-pitching the workspace.
  const returningOwner = createUser({ name: 'Returning', lastName: 'Owner' });
  createEmailLogin({ userId: returningOwner.id });
  if (returningOwner.coordinator) {
    connectWorkspaceEmail({ assistantId: returningOwner.coordinator.agentId });
  }

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

  // An assistant with a connected Google Workspace account (Drive scope
  // granted) plus an empty file-access allowlist, so the workspace file
  // picker is reachable locally via DevQuickLogin.
  const driveAssistant = createAssistant({
    userId: owner.id,
    firstName: 'Grace',
    surname: 'Hopper',
  });
  connectWorkspaceEmail({
    assistantId: driveAssistant.agentId,
    email: `grace-${owner.id}@example.com`,
  });
  dbExecBlock(`
INSERT INTO assistant_secrets (user_id, agent_id, secret_name, secret_value)
VALUES
  ('${owner.id}', ${driveAssistant.agentId}, 'GOOGLE_GRANTED_SCOPES', 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email'),
  ('${owner.id}', ${driveAssistant.agentId}, 'GOOGLE_ACCESS_TOKEN', 'seed-google-access-token')
ON CONFLICT (agent_id, secret_name) DO UPDATE SET secret_value = EXCLUDED.secret_value;
INSERT INTO assistant_workspace_file_access (agent_id, provider, default_allow, decisions)
VALUES (${driveAssistant.agentId}, 'google', false, '[]'::jsonb)
ON CONFLICT (agent_id, provider) DO UPDATE SET default_allow = EXCLUDED.default_allow, decisions = EXCLUDED.decisions;
`);

  // Make the auto-provisioned personal Coordinator chat-ready.
  await seedCoordinatorChatForUsers([owner]);

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
    users: { owner, returningOwner },
    assistants: [assistant, driveAssistant],
    secrets,
    credentials: {
      owner: {
        email: owner.email,
        password: 'testpass123',
        apiKey: owner.apiKey,
        userId: owner.id,
      },
      returningOwner: {
        email: returningOwner.email,
        password: 'testpass123',
        apiKey: returningOwner.apiKey,
        userId: returningOwner.id,
      },
    },
  };
}
