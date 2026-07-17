/**
 * Seed Scenario: Data Log Grid
 *
 * Small Assistants Data-layer table for exercising LogGrid features
 * (column visibility, filters, sort, derived columns) without Prospects-scale data.
 *
 * Context: `{userId}/{assistantId}/Data/Demo/People`
 * Columns: name (str), city (str), score (int)
 */

import type { SeededState } from '../types';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  seedChatInfrastructure,
  orchestraFetch,
} from '../client';

const PEOPLE: Record<string, unknown>[] = [
  { name: 'Ada Lovelace', city: 'London', score: 95 },
  // Shared city with Ada so multi-row selection can collapse city into one value group
  { name: 'Alan Turing', city: 'London', score: 88 },
  { name: 'Grace Hopper', city: 'New York', score: 91 },
  { name: 'Katherine Johnson', city: 'Hampton', score: 97 },
  { name: 'Donald Knuth', city: 'Stanford', score: 84 },
  { name: 'Barbara Liskov', city: 'Boston', score: 90 },
  { name: 'Edsger Dijkstra', city: 'Amsterdam', score: 86 },
  { name: 'Margaret Hamilton', city: 'Cambridge', score: 93 },
];

export async function seedDataLogGrid(): Promise<SeededState> {
  const owner = createUser({ name: 'DataGrid', lastName: 'Owner' });
  createEmailLogin({ userId: owner.id });

  const assistant = createAssistant({
    userId: owner.id,
    firstName: 'Data',
    surname: 'Browser',
  });

  await seedChatInfrastructure({
    apiKey: owner.apiKey,
    userId: owner.id,
    assistantId: assistant.agentId,
    email: owner.email,
  });

  const context = `${owner.id}/${assistant.agentId}/Data/Demo/People`;
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context,
        entries: PEOPLE,
      }),
    },
    owner.apiKey
  );
  if (!res.ok) {
    throw new Error(`Failed to seed Data/Demo/People: ${res.status} ${await res.text()}`);
  }

  return {
    users: { owner },
    assistants: [assistant],
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
