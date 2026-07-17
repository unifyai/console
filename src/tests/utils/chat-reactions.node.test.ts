import { describe, expect, it } from 'vitest';
import { applyOrgReactionUpdate, applyReactionUpdate } from '@/utils/assistants/chat-reactions';

describe('applyReactionUpdate', () => {
  it('adds, changes, and removes reactions for one contact', () => {
    let reactions = applyReactionUpdate(undefined, 2, '👍');
    expect(reactions).toEqual([expect.objectContaining({ contactId: 2, emoji: '👍' })]);

    reactions = applyReactionUpdate(reactions, 2, '❤️');
    expect(reactions[0].emoji).toBe('❤️');

    reactions = applyReactionUpdate(reactions, 2, '❤️');
    expect(reactions).toEqual([]);
  });
});

describe('applyOrgReactionUpdate', () => {
  it('adds, changes, and removes reactions for one user', () => {
    let reactions = applyOrgReactionUpdate(undefined, 'user-a', '👍');
    expect(reactions).toEqual([expect.objectContaining({ userId: 'user-a', emoji: '👍' })]);

    reactions = applyOrgReactionUpdate(reactions, 'user-a', '❤️');
    expect(reactions[0].emoji).toBe('❤️');

    reactions = applyOrgReactionUpdate(reactions, 'user-a', '❤️');
    expect(reactions).toEqual([]);
  });
});
