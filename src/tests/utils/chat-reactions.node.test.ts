import { describe, expect, it } from 'vitest';
import { applyReactionUpdate } from '@/utils/assistants/chat-reactions';

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
