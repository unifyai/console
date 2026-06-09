import { describe, expect, it } from 'vitest';
import {
  mapFastBrainMoodToCreatureMood,
  parseMoodClassificationMessage,
} from '@/utils/assistants/martian-mood';

describe('martian mood utilities', () => {
  it('maps fast-brain mood labels to creature moods', () => {
    expect(mapFastBrainMoodToCreatureMood('neutral/happy')).toBe('happy');
    expect(mapFastBrainMoodToCreatureMood('apologetic/sad')).toBe('sad');
    expect(mapFastBrainMoodToCreatureMood('frustrated/angry')).toBe('frustrated');
    expect(mapFastBrainMoodToCreatureMood('bored')).toBe('happy');
  });

  it('parses current mood classification messages', () => {
    expect(
      parseMoodClassificationMessage(
        {
          type: 'mood_classification',
          mood: 'apologetic/sad',
          avatarMood: 'apologetic',
          turnIndex: 4,
        },
        3
      )
    ).toEqual({ mood: 'sad', turnIndex: 4 });
  });

  it('rejects stale turn indices', () => {
    expect(
      parseMoodClassificationMessage(
        {
          type: 'mood_classification',
          mood: 'bored',
          turnIndex: 4,
        },
        4
      )
    ).toBeNull();
  });

  it('rejects unknown mood values', () => {
    expect(
      parseMoodClassificationMessage(
        {
          type: 'mood_classification',
          mood: 'confused',
          turnIndex: 5,
        },
        4
      )
    ).toBeNull();
  });
});
