/**
 * Unit tests for src/hooks/Assistants/useCallSounds.ts
 *
 * Verifies that the hook correctly manages Audio elements for
 * ringing (looped) and hangup (one-shot) call sounds.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCallSounds } from '@/hooks/Assistants/useCallSounds';

// ── Mock audio imports ─────────────────────────────────────────────

vi.mock('@/public/sounds/call-ringing.mp3', () => ({
  default: '/sounds/call-ringing.mp3',
}));

vi.mock('@/public/sounds/call-end.mp3', () => ({
  default: '/sounds/call-end.mp3',
}));

// ── Mock HTMLAudioElement ──────────────────────────────────────────

interface MockAudio {
  src: string;
  loop: boolean;
  volume: number;
  currentTime: number;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

let audioInstances: MockAudio[];

beforeEach(() => {
  audioInstances = [];

  // Must be a regular function (not arrow) so `new Audio(...)` works
  globalThis.Audio = function (this: MockAudio, src?: string) {
    this.src = src || '';
    this.loop = false;
    this.volume = 1;
    this.currentTime = 0;
    this.play = vi.fn().mockResolvedValue(undefined);
    this.pause = vi.fn();
    audioInstances.push(this);
  } as any;
});

// ── Tests ──────────────────────────────────────────────────────────

describe('useCallSounds', () => {
  describe('startRinging', () => {
    it(
      'creates an Audio element with the ringing source and plays it',
      {
        meta: {
          alias: 'Sound-StartRinging',
          scenario: 'Ringing starts',
          behavior: 'Audio element is created with loop=true and play() is called',
        },
      },
      () => {
        const { result } = renderHook(() => useCallSounds());

        act(() => {
          result.current.startRinging();
        });

        expect(audioInstances).toHaveLength(1);
        expect(audioInstances[0].src).toBe('/sounds/call-ringing.mp3');
        expect(audioInstances[0].loop).toBe(true);
        expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
      }
    );

    it(
      'reuses the same Audio element on subsequent calls',
      {
        meta: {
          alias: 'Sound-ReuseRingingAudio',
          scenario: 'startRinging called twice',
          behavior: 'Only one Audio element is created',
        },
      },
      () => {
        const { result } = renderHook(() => useCallSounds());

        act(() => {
          result.current.startRinging();
          result.current.startRinging();
        });

        expect(audioInstances).toHaveLength(1);
        expect(audioInstances[0].play).toHaveBeenCalledTimes(2);
      }
    );

    it(
      'resets currentTime before playing',
      {
        meta: {
          alias: 'Sound-ResetTime',
          scenario: 'startRinging called',
          behavior: 'currentTime is set to 0 so playback starts from the beginning',
        },
      },
      () => {
        const { result } = renderHook(() => useCallSounds());

        act(() => {
          result.current.startRinging();
        });

        expect(audioInstances[0].currentTime).toBe(0);
      }
    );

    it(
      'sets volume to 0.35',
      {
        meta: {
          alias: 'Sound-RingingVolume',
          scenario: 'Ringing audio is created',
          behavior: 'Volume is set to a moderate level',
        },
      },
      () => {
        const { result } = renderHook(() => useCallSounds());

        act(() => {
          result.current.startRinging();
        });

        expect(audioInstances[0].volume).toBe(0.5);
      }
    );
  });

  describe('stopRinging', () => {
    it(
      'pauses the audio and resets currentTime',
      {
        meta: {
          alias: 'Sound-StopRinging',
          scenario: 'Ringing is stopped',
          behavior: 'Audio is paused and currentTime reset to 0',
        },
      },
      () => {
        const { result } = renderHook(() => useCallSounds());

        act(() => {
          result.current.startRinging();
        });

        act(() => {
          result.current.stopRinging();
        });

        expect(audioInstances[0].pause).toHaveBeenCalledTimes(1);
        expect(audioInstances[0].currentTime).toBe(0);
      }
    );

    it(
      'is a no-op if ringing was never started',
      {
        meta: {
          alias: 'Sound-StopNoop',
          scenario: 'stopRinging called when not ringing',
          behavior: 'No errors thrown',
        },
      },
      () => {
        const { result } = renderHook(() => useCallSounds());

        // Should not throw
        act(() => {
          result.current.stopRinging();
        });

        expect(audioInstances).toHaveLength(0);
      }
    );
  });

  describe('playHangup', () => {
    it(
      'creates an Audio element with the end-call source and plays it',
      {
        meta: {
          alias: 'Sound-PlayHangup',
          scenario: 'Call ends',
          behavior: 'Hangup audio is created and played',
        },
      },
      () => {
        const { result } = renderHook(() => useCallSounds());

        act(() => {
          result.current.playHangup();
        });

        expect(audioInstances).toHaveLength(1);
        expect(audioInstances[0].src).toBe('/sounds/call-end.mp3');
        expect(audioInstances[0].loop).toBe(false);
        expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
      }
    );

    it(
      'reuses the same Audio element on subsequent calls',
      {
        meta: {
          alias: 'Sound-ReuseHangupAudio',
          scenario: 'playHangup called twice',
          behavior: 'Only one Audio element is created',
        },
      },
      () => {
        const { result } = renderHook(() => useCallSounds());

        act(() => {
          result.current.playHangup();
          result.current.playHangup();
        });

        expect(audioInstances).toHaveLength(1);
        expect(audioInstances[0].play).toHaveBeenCalledTimes(2);
      }
    );

    it(
      'sets volume to 0.75',
      {
        meta: {
          alias: 'Sound-HangupVolume',
          scenario: 'Hangup audio is created',
          behavior: 'Volume is set to a moderate level',
        },
      },
      () => {
        const { result } = renderHook(() => useCallSounds());

        act(() => {
          result.current.playHangup();
        });

        expect(audioInstances[0].volume).toBe(0.5);
      }
    );
  });

  describe('Separate audio elements', () => {
    it(
      'uses different Audio elements for ringing and hangup',
      {
        meta: {
          alias: 'Sound-SeparateElements',
          scenario: 'Both ringing and hangup are used',
          behavior: 'Two distinct Audio elements are created',
        },
      },
      () => {
        const { result } = renderHook(() => useCallSounds());

        act(() => {
          result.current.startRinging();
          result.current.playHangup();
        });

        expect(audioInstances).toHaveLength(2);
        expect(audioInstances[0].src).toBe('/sounds/call-ringing.mp3');
        expect(audioInstances[1].src).toBe('/sounds/call-end.mp3');
      }
    );
  });

  describe('Cleanup', () => {
    it(
      'pauses all audio elements on unmount',
      {
        meta: {
          alias: 'Sound-Cleanup',
          scenario: 'Component unmounts while ringing',
          behavior: 'All audio elements are paused',
        },
      },
      () => {
        const { result, unmount } = renderHook(() => useCallSounds());

        act(() => {
          result.current.startRinging();
          result.current.playHangup();
        });

        unmount();

        expect(audioInstances[0].pause).toHaveBeenCalled();
        expect(audioInstances[1].pause).toHaveBeenCalled();
      }
    );

    it(
      'handles unmount without any audio operations gracefully',
      {
        meta: {
          alias: 'Sound-CleanupNoOps',
          scenario: 'Component unmounts before any audio was played',
          behavior: 'No errors thrown',
        },
      },
      () => {
        const { unmount } = renderHook(() => useCallSounds());

        // Should not throw
        unmount();

        expect(audioInstances).toHaveLength(0);
      }
    );
  });
});
