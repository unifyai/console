/**
 * Unit tests for useDesktopReady hook.
 *
 * Tests the three detection mechanisms:
 * 1. sessionStorage — synchronous read during state initialization
 * 2. BroadcastChannel — real-time cross-tab notification
 * 3. Fallback poll via getLiveviewUrl — for standalone tabs without SSE
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDesktopReady } from '@/hooks/Assistants/useDesktopReady';

// ---------------------------------------------------------------------------
// BroadcastChannel mock (jsdom does not implement it)
// ---------------------------------------------------------------------------

type BroadcastListener = (e: MessageEvent) => void;

const broadcastChannels = new Map<string, Set<BroadcastListener>>();

class MockBroadcastChannel {
  name: string;
  onmessage: BroadcastListener | null = null;

  constructor(name: string) {
    this.name = name;
    if (!broadcastChannels.has(name)) {
      broadcastChannels.set(name, new Set());
    }
  }

  postMessage(data: unknown) {
    const listeners = broadcastChannels.get(this.name);
    if (!listeners) return;
    const event = { data } as MessageEvent;
    listeners.forEach((listener) => listener(event));
  }

  close() {
    const listeners = broadcastChannels.get(this.name);
    if (listeners && this.onmessage) {
      listeners.delete(this.onmessage);
    }
  }

  // Hook the onmessage setter to register in the channel set
  set _onmessage(fn: BroadcastListener | null) {
    const listeners = broadcastChannels.get(this.name);
    if (listeners && this.onmessage) {
      listeners.delete(this.onmessage);
    }
    this.onmessage = fn;
    if (listeners && fn) {
      listeners.add(fn);
    }
  }
}

// Proxy to capture onmessage assignment
const BroadcastChannelProxy = new Proxy(MockBroadcastChannel, {
  construct(Target, args) {
    const instance = new Target(...(args as [string]));
    return new Proxy(instance, {
      set(obj, prop, value) {
        if (prop === 'onmessage') {
          const listeners = broadcastChannels.get(obj.name);
          if (listeners && obj.onmessage) listeners.delete(obj.onmessage);
          obj.onmessage = value;
          if (listeners && value) listeners.add(value);
          return true;
        }
        return Reflect.set(obj, prop, value);
      },
    });
  },
});

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  broadcastChannels.clear();
  (globalThis as any).BroadcastChannel = BroadcastChannelProxy;
});

afterEach(() => {
  delete (globalThis as any).BroadcastChannel;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simulateBroadcast(assistantId: string, data: Record<string, unknown> = {}) {
  const channelName = `assistant-desktop-ready-${assistantId}`;
  const listeners = broadcastChannels.get(channelName);
  if (!listeners) return;
  const event = { data } as MessageEvent;
  listeners.forEach((listener) => listener(event));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDesktopReady', () => {
  describe('sessionStorage detection', () => {
    it('resolves immediately when sessionStorage has the desktop-ready entry', () => {
      sessionStorage.setItem('desktop-ready-42', JSON.stringify({}));

      const { result } = renderHook(() => useDesktopReady('42', undefined));

      expect(result.current.isDesktopReady).toBe(true);
    });

    it('extracts liveview_url from the stored event payload', () => {
      sessionStorage.setItem(
        'desktop-ready-42',
        JSON.stringify({ liveview_url: 'https://vm.example.com' })
      );

      const { result } = renderHook(() => useDesktopReady('42', undefined));

      expect(result.current.isDesktopReady).toBe(true);
      expect(result.current.eventLiveviewUrl).toBe('https://vm.example.com');
    });

    it('handles camelCase liveviewUrl field', () => {
      sessionStorage.setItem(
        'desktop-ready-42',
        JSON.stringify({ liveviewUrl: 'https://vm.example.com' })
      );

      const { result } = renderHook(() => useDesktopReady('42', undefined));

      expect(result.current.eventLiveviewUrl).toBe('https://vm.example.com');
    });

    it('stays false when sessionStorage is empty', () => {
      const { result } = renderHook(() => useDesktopReady('42', undefined));

      expect(result.current.isDesktopReady).toBe(false);
      expect(result.current.eventLiveviewUrl).toBeNull();
    });

    it('re-reads sessionStorage when assistantId changes', () => {
      sessionStorage.setItem('desktop-ready-99', JSON.stringify({}));

      const { result, rerender } = renderHook(({ id }) => useDesktopReady(id, undefined), {
        initialProps: { id: '42' as string | undefined },
      });

      expect(result.current.isDesktopReady).toBe(false);

      rerender({ id: '99' });
      expect(result.current.isDesktopReady).toBe(true);
    });
  });

  describe('initialValue passthrough', () => {
    it('respects initialValue=true even without sessionStorage', () => {
      const { result } = renderHook(() => useDesktopReady('42', undefined, true));

      expect(result.current.isDesktopReady).toBe(true);
    });

    it('resets to false when assistantId changes and no storage entry exists', () => {
      sessionStorage.setItem('desktop-ready-42', JSON.stringify({}));

      const { result, rerender } = renderHook(({ id }) => useDesktopReady(id, undefined, false), {
        initialProps: { id: '42' as string | undefined },
      });

      expect(result.current.isDesktopReady).toBe(true);

      // Switch to 99 which has no storage — should reset to false
      rerender({ id: '99' });
      expect(result.current.isDesktopReady).toBe(false);
    });
  });

  describe('BroadcastChannel detection', () => {
    it('sets ready when a broadcast message is received', async () => {
      const { result } = renderHook(() => useDesktopReady('42', undefined));

      expect(result.current.isDesktopReady).toBe(false);

      act(() => {
        simulateBroadcast('42', { liveview_url: 'https://vm.example.com' });
      });

      expect(result.current.isDesktopReady).toBe(true);
      expect(result.current.eventLiveviewUrl).toBe('https://vm.example.com');
    });

    it('ignores broadcasts for other assistants', () => {
      const { result } = renderHook(() => useDesktopReady('42', undefined));

      act(() => {
        simulateBroadcast('99', {});
      });

      expect(result.current.isDesktopReady).toBe(false);
    });

    it('stops listening after desktop is ready', () => {
      sessionStorage.setItem('desktop-ready-42', JSON.stringify({}));

      const { result } = renderHook(() => useDesktopReady('42', undefined));

      expect(result.current.isDesktopReady).toBe(true);
      // BroadcastChannel effect should not open (isDesktopReady guard)
      expect(broadcastChannels.get('assistant-desktop-ready-42')?.size ?? 0).toBe(0);
    });
  });

  describe('fallback poll via getLiveviewUrl', () => {
    it('resolves when getLiveviewUrl returns a URL', async () => {
      const mockGetUrl = vi.fn().mockResolvedValue({
        liveviewUrl: 'https://liveview.example.com',
      });

      const { result } = renderHook(() => useDesktopReady('42', mockGetUrl));

      await waitFor(() => {
        expect(result.current.isDesktopReady).toBe(true);
      });

      expect(mockGetUrl).toHaveBeenCalledWith('42');
    });

    it('stays false when getLiveviewUrl returns a detail error', async () => {
      const mockGetUrl = vi.fn().mockResolvedValue({
        detail: 'No active session found',
      });

      const { result } = renderHook(() => useDesktopReady('42', mockGetUrl));

      // Give the async poll a tick to resolve
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isDesktopReady).toBe(false);
    });

    it('stays false when getLiveviewUrl throws', async () => {
      const mockGetUrl = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDesktopReady('42', mockGetUrl));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isDesktopReady).toBe(false);
    });

    it('does not poll when already ready from sessionStorage', async () => {
      sessionStorage.setItem('desktop-ready-42', JSON.stringify({}));

      const mockGetUrl = vi.fn().mockResolvedValue({
        liveviewUrl: 'https://liveview.example.com',
      });

      renderHook(() => useDesktopReady('42', mockGetUrl));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockGetUrl).not.toHaveBeenCalled();
    });

    it('does not poll when assistantId is undefined', async () => {
      const mockGetUrl = vi.fn().mockResolvedValue({
        liveviewUrl: 'https://liveview.example.com',
      });

      renderHook(() => useDesktopReady(undefined, mockGetUrl));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockGetUrl).not.toHaveBeenCalled();
    });
  });

  describe('no fetchAssistantStatus dependency', () => {
    it('does not require assistant status to resolve — getLiveviewUrl alone is sufficient', async () => {
      const mockGetUrl = vi.fn().mockResolvedValue({
        liveviewUrl: 'https://liveview.example.com',
      });

      const { result } = renderHook(() => useDesktopReady('42', mockGetUrl));

      await waitFor(() => {
        expect(result.current.isDesktopReady).toBe(true);
      });
    });
  });
});
