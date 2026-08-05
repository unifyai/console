/**
 * Resolving who a room message addresses from the text that was sent.
 *
 * The regression covered here: mentions were only recorded when picked from the
 * autocomplete dropdown, so typing "@Ada" by hand submitted an empty list. Once
 * the runtime started using mentions to decide whose turn it is, that gap made
 * an assistant stand down from a message addressed straight at it — the signal
 * was trustworthy only for people who happened to use the picker.
 */
import { describe, expect, it } from 'vitest';
import { resolveMentionsInText } from '@/utils/assistants/chat-mentions';
import type { ChatMention } from '@/types/orgChat';

const LILA: ChatMention = { kind: 'assistant', id: '8034', name: 'Lila Down' };
const ADA: ChatMention = { kind: 'assistant', id: '22', name: 'Ada' };
const ADA_CHEN: ChatMention = { kind: 'user', id: 'u-ada-chen', name: 'Ada Chen' };
const JULIA: ChatMention = { kind: 'user', id: 'u-julia', name: 'Julia Goh' };

const CANDIDATES = [LILA, ADA, ADA_CHEN, JULIA];

const ids = (mentions: ChatMention[]) => mentions.map((m) => m.id);

describe('resolveMentionsInText', () => {
  it('resolves a hand-typed mention the picker never recorded', () => {
    const found = resolveMentionsInText('@Lila Down hey, how are you?', CANDIDATES);

    expect(ids(found)).toEqual(['8034']);
  });

  it('keeps the kind, which is how the runtime recognises itself', () => {
    /** Self-detection matches on kind === 'assistant' AND id. */
    const [found] = resolveMentionsInText('@Lila Down ping', CANDIDATES);

    expect(found.kind).toBe('assistant');
    expect(found.id).toBe('8034');
  });

  it('prefers the longer name when one is a prefix of another', () => {
    const found = resolveMentionsInText('@Ada Chen can you look?', CANDIDATES);

    expect(ids(found)).toEqual(['u-ada-chen']);
  });

  it('still resolves the shorter name on its own', () => {
    const found = resolveMentionsInText('@Ada can you look?', CANDIDATES);

    expect(ids(found)).toEqual(['22']);
  });

  it('resolves both when both are named', () => {
    const found = resolveMentionsInText('@Ada Chen and @Ada, thoughts?', CANDIDATES);

    expect(ids(found).sort()).toEqual(['22', 'u-ada-chen'].sort());
  });

  it('reports mentions in the order they appear', () => {
    const found = resolveMentionsInText('@Julia Goh and @Lila Down', CANDIDATES);

    expect(ids(found)).toEqual(['u-julia', '8034']);
  });

  it('does not repeat a name mentioned twice', () => {
    const found = resolveMentionsInText('@Ada ping, @Ada again', CANDIDATES);

    expect(ids(found)).toEqual(['22']);
  });

  it('ignores an @ that matches nobody', () => {
    expect(resolveMentionsInText('@Nobody hello', CANDIDATES)).toEqual([]);
  });

  it('ignores a bare name with no @', () => {
    /** Otherwise talking *about* someone would read as talking *to* them. */
    expect(resolveMentionsInText('Ada said the numbers were off', CANDIDATES)).toEqual([]);
  });

  it('returns nothing for a thread with no candidates', () => {
    /** A 1:1 has no roster to mention and nothing to arbitrate. */
    expect(resolveMentionsInText('@Ada hello', undefined)).toEqual([]);
    expect(resolveMentionsInText('@Ada hello', [])).toEqual([]);
  });

  it('handles empty content without throwing', () => {
    expect(resolveMentionsInText('', CANDIDATES)).toEqual([]);
  });

  it('skips candidates that have no name to match on', () => {
    const nameless: ChatMention = { kind: 'user', id: 'u-x' };

    expect(resolveMentionsInText('@ hello', [nameless])).toEqual([]);
  });
});
