/**
 * Seed Scenario: Desktop Linked
 *
 * Exercises the per-user "link your desktop" flow and the N×M model where a
 * user can link their own machine to several of their assistants.
 *
 * **What it creates:**
 *   - 1 user ("owner") with billing account + API key + email login
 *   - 2 personal assistants ("Ada", "Alan")
 *   - 1 registered user desktop ("Owner's MacBook") linked to Ada only
 *
 * The desktop is linked to Ada but not Alan, so the linker UI shows Ada as
 * "currently linked" and Alan as unlinked-but-linkable (same machine, second
 * assistant) — the core N×M assertion.
 *
 * **Credentials:**
 *   - `owner` — full access
 */

import type { SeededState } from '../types';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  createUserDesktop,
  linkUserDesktop,
  seedChatInfrastructure,
  seedCoordinatorChatForUsers,
} from '../client';

export async function seedDesktopLinked(): Promise<SeededState> {
  const owner = createUser({ name: 'Desktop', lastName: 'Owner' });
  createEmailLogin({ userId: owner.id });

  const ada = createAssistant({
    userId: owner.id,
    firstName: 'Ada',
    surname: 'Lovelace',
  });
  const alan = createAssistant({
    userId: owner.id,
    firstName: 'Alan',
    surname: 'Turing',
  });

  await seedChatInfrastructure({
    apiKey: owner.apiKey,
    userId: owner.id,
    assistantId: ada.agentId,
    email: owner.email,
  });
  await seedChatInfrastructure({
    apiKey: owner.apiKey,
    userId: owner.id,
    assistantId: alan.agentId,
    email: owner.email,
  });

  await seedCoordinatorChatForUsers([owner]);

  const macbook = createUserDesktop({
    userId: owner.id,
    name: "Owner's MacBook",
    os: 'macos',
  });
  linkUserDesktop({
    assistantId: ada.agentId,
    desktopId: macbook.id,
    ownerUserId: owner.id,
  });

  return {
    users: { owner },
    assistants: [ada, alan],
    desktops: [macbook],
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
