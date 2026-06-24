import { describe, expect, it } from 'vitest';
import {
  mapFastBrainMoodToUnityMood,
  parseMoodClassificationMessage,
} from '@/utils/assistants/unity-mood';

describe('unity mood utilities', () => {
  it('maps fast-brain mood labels to unity moods', () => {
    expect(mapFastBrainMoodToUnityMood('neutral/happy')).toBe('happy');
    expect(mapFastBrainMoodToUnityMood('apologetic/sad')).toBe('sad');
    expect(mapFastBrainMoodToUnityMood('frustrated/angry')).toBe('frustrated');
    expect(mapFastBrainMoodToUnityMood('bored')).toBe('happy');
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
