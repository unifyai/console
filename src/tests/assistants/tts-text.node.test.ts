import { describe, it, expect } from 'vitest';
import { normalizeElevenLabsTwinPronunciation } from '@/utils/assistants/tts-text';

describe('normalizeElevenLabsTwinPronunciation', () => {
  it.each([
    ['Say T-W1N now.', 'Say Twin now.'],
    ['Say t-w1n now.', 'Say Twin now.'],
    ['T-W1N and t-W1n', 'Twin and Twin'],
    ['Almost T-W1 but not done', 'Almost T-W1 but not done'],
  ])('rewrites %j to %j', (input, expected) => {
    expect(normalizeElevenLabsTwinPronunciation(input)).toBe(expected);
  });
});
