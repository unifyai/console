import { describe, it, expect } from 'vitest';
import { resolveCanonicalWorkspaceCoordinator } from '@/lib/assistants/coordinatorIdentity';
import type { Assistant } from '@/types/assistants/assistant';

function buildAssistant(
  overrides: Partial<Assistant> &
    Pick<Assistant, 'agentId' | 'userId' | 'organizationId' | 'isCoordinator'>
): Assistant {
  return {
    ...overrides,
  } as Assistant;
}

describe('resolveCanonicalWorkspaceCoordinator', () => {
  it('returns null when org only has another users coordinator', () => {
    const assistants: Assistant[] = [
      buildAssistant({
        agentId: 'owner-coordinator',
        userId: 'owner-user',
        organizationId: 7,
        isCoordinator: true,
      }),
    ];

    const canonical = resolveCanonicalWorkspaceCoordinator(assistants, 'member-user', {
      type: 'organization',
      organizationId: 7,
    });

    expect(canonical).toBeNull();
  });

  it('returns the current users coordinator in org workspace', () => {
    const assistants: Assistant[] = [
      buildAssistant({
        agentId: 'owner-coordinator',
        userId: 'owner-user',
        organizationId: 7,
        isCoordinator: true,
      }),
      buildAssistant({
        agentId: 'member-coordinator',
        userId: 'member-user',
        organizationId: 7,
        isCoordinator: true,
      }),
    ];

    const canonical = resolveCanonicalWorkspaceCoordinator(assistants, 'member-user', {
      type: 'organization',
      organizationId: 7,
    });

    expect(canonical?.agentId).toBe('member-coordinator');
  });
});
