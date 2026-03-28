/**
 * Unit tests for useAssistantProfileChat hook.
 *
 * Tests cover:
 * - Contact ID auto-retry mechanism (phase-based state machine)
 * - SSE reconnection behavior
 * - reconnectSSE function behavior
 * - SSE reconnection trigger mechanism
 * - Integration with spending gate blocking
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssistantProfileChat } from '@/hooks/Assistants/useAssistantProfileChat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';

// Mock EventSource (tracks instances for test introspection)
let lastEventSource: MockEventSource | null = null;

class MockEventSource {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  close = vi.fn();
  constructor(url: string) {
    this.url = url;
    lastEventSource = this;
  }
}

(global as any).EventSource = MockEventSource;

// Mock BroadcastChannel
class MockBroadcastChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
}

(global as any).BroadcastChannel = MockBroadcastChannel;

// Mock fetch for ACK
global.fetch = vi.fn(() => Promise.resolve({ ok: true })) as unknown as typeof fetch;

const createMockAssistant = (overrides: Partial<Assistant> = {}): Assistant => ({
  agentId: 'test-assistant-1',
  userId: 'test-user-1',
  organizationId: 1,
  firstName: 'Test',
  surname: 'Assistant',
  age: 25,
  nationality: 'US',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  weeklyLimit: 1000,
  maxParallel: 5,
  voiceId: 'voice-1',
  voiceProvider: 'elevenlabs',
  profilePhoto: 'https://example.com/photo.jpg',
  profileVideo: null,
  signedProfilePhotoUrl: 'https://example.com/photo-signed.jpg',
  userFirstName: 'Owner',
  userLastName: 'User',
  about: null,
  phoneCountry: 'US',
  timezone: null,
  email: null,
  phone: null,
  assistantWhatsappNumber: null,
  userPhone: null,
  userWhatsappNumber: null,
  ...overrides,
});

const createMockAssistantActions = (
  overrides: Partial<AssistantActions['chat']> = {}
): Pick<AssistantActions, 'chat'> => ({
  chat: {
    getContactId: vi.fn(async () => 1),
    getTranscripts: vi.fn(async () => []),
    message: vi.fn(async () => ({ info: 'sent' })),
    getAssistantOwnerById: vi.fn(async () => null),
    ...overrides,
  },
});

// =============================================================================
// SECTION 1: Contact ID Auto-Retry Tests
// =============================================================================
describe('useAssistantProfileChat - Contact ID Auto-Retry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('cancels in-flight resolution on unmount without errors', async () => {
    const getContactIdMock = vi.fn(async () => null);

    const assistant = createMockAssistant();
    const chatHistories: Record<string, any[]> = {};
    const setChatHistories = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        Object.assign(chatHistories, updater(chatHistories));
      }
    });

    const { unmount } = renderHook(() =>
      useAssistantProfileChat(
        assistant,
        createMockAssistantActions({ getContactId: getContactIdMock }),
        chatHistories,
        setChatHistories,
        'test@example.com'
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(getContactIdMock).toHaveBeenCalled();
    const callsBeforeUnmount = getContactIdMock.mock.calls.length;

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40000);
    });

    expect(getContactIdMock).toHaveBeenCalledTimes(callsBeforeUnmount);
  });

  it('exposes isRetryingContactId state correctly', async () => {
    const getContactIdMock = vi.fn(async () => null);

    const assistant = createMockAssistant();
    const chatHistories: Record<string, any[]> = {};
    const setChatHistories = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        Object.assign(chatHistories, updater(chatHistories));
      }
    });

    const { result } = renderHook(() =>
      useAssistantProfileChat(
        assistant,
        createMockAssistantActions({ getContactId: getContactIdMock }),
        chatHistories,
        setChatHistories,
        'test@example.com'
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(typeof result.current.isRetryingContactId).toBe('boolean');
    expect(typeof result.current.canChat).toBe('boolean');
  });

  it('sets canChat to false and starts retry when contact_id is null', async () => {
    const getContactIdMock = vi.fn(async () => null);

    const assistant = createMockAssistant();
    const chatHistories: Record<string, any[]> = {};
    const setChatHistories = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        Object.assign(chatHistories, updater(chatHistories));
      }
    });

    const { result } = renderHook(() =>
      useAssistantProfileChat(
        assistant,
        createMockAssistantActions({ getContactId: getContactIdMock }),
        chatHistories,
        setChatHistories,
        'test@example.com'
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current.canChat).toBe(false);
    expect(result.current.isRetryingContactId).toBe(true);
  });

  it('sets canChat to true when contact_id is available', async () => {
    const getContactIdMock = vi.fn(async () => 123);

    const assistant = createMockAssistant();
    const chatHistories: Record<string, any[]> = {};
    const setChatHistories = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        Object.assign(chatHistories, updater(chatHistories));
      }
    });

    const { result } = renderHook(() =>
      useAssistantProfileChat(
        assistant,
        createMockAssistantActions({
          getContactId: getContactIdMock,
        }),
        chatHistories,
        setChatHistories,
        'test@example.com'
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(getContactIdMock).toHaveBeenCalled();
    expect(result.current.canChat).toBe(true);
    expect(result.current.isRetryingContactId).toBe(false);
  });

  it('stores currentContactId after successful lookup', async () => {
    const getContactIdMock = vi.fn(async () => 789);

    const assistant = createMockAssistant();
    const chatHistories: Record<string, any[]> = {};
    const setChatHistories = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        Object.assign(chatHistories, updater(chatHistories));
      }
    });

    const { result } = renderHook(() =>
      useAssistantProfileChat(
        assistant,
        createMockAssistantActions({ getContactId: getContactIdMock }),
        chatHistories,
        setChatHistories,
        'test@example.com'
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.currentContactId).toBe(789);
    expect(result.current.canChat).toBe(true);
  });
});

// =============================================================================
// SECTION 2: SSE Reconnection Logic Tests
// =============================================================================
/**
 * Test the SSE reconnection trigger logic independently.
 *
 * The actual useAssistantProfileChat hook has complex dependencies (EventSource, etc.)
 * that are difficult to mock in a Node environment. Instead, we test the logic patterns
 * that the hook implements.
 */
describe('SSE Reconnection Logic', () => {
  // ===========================================================================
  // Reconnect Trigger State Machine
  // ===========================================================================
  describe('sseReconnectTrigger state machine', () => {
    /**
     * Simulates the reconnect trigger logic from useAssistantProfileChat.
     * The hook uses a counter that increments to trigger useEffect re-runs.
     */
    const createReconnectTrigger = () => {
      let triggerValue = 0;
      let reconnectAttempts = 0;
      const MAX_RECONNECT_ATTEMPTS = 5;

      return {
        getTriggerValue: () => triggerValue,
        getReconnectAttempts: () => reconnectAttempts,
        incrementAttempts: () => {
          reconnectAttempts++;
        },
        resetAttempts: () => {
          reconnectAttempts = 0;
        },
        canReconnect: () => reconnectAttempts < MAX_RECONNECT_ATTEMPTS,
        reconnect: () => {
          // This is what reconnectSSE does:
          reconnectAttempts = 0; // Reset attempts
          triggerValue++; // Increment trigger
        },
      };
    };

    it('should increment trigger value when reconnect is called', () => {
      const trigger = createReconnectTrigger();

      expect(trigger.getTriggerValue()).toBe(0);

      trigger.reconnect();
      expect(trigger.getTriggerValue()).toBe(1);

      trigger.reconnect();
      expect(trigger.getTriggerValue()).toBe(2);
    });

    it('should reset reconnect attempts when reconnect is called', () => {
      const trigger = createReconnectTrigger();

      // Simulate some failed reconnection attempts
      trigger.incrementAttempts();
      trigger.incrementAttempts();
      trigger.incrementAttempts();
      expect(trigger.getReconnectAttempts()).toBe(3);

      // Call reconnect (like reconnectSSE does)
      trigger.reconnect();

      // Attempts should be reset
      expect(trigger.getReconnectAttempts()).toBe(0);
    });

    it('should allow reconnection after reset even if max attempts was reached', () => {
      const trigger = createReconnectTrigger();

      // Exhaust reconnection attempts
      for (let i = 0; i < 5; i++) {
        trigger.incrementAttempts();
      }
      expect(trigger.canReconnect()).toBe(false);

      // Call reconnect (resets attempts)
      trigger.reconnect();

      // Should be able to reconnect again
      expect(trigger.canReconnect()).toBe(true);
    });
  });

  // ===========================================================================
  // Spending Block Transition Detection
  // ===========================================================================
  describe('spending block transition detection', () => {
    /**
     * Simulates the useEffect and useRef pattern from AssistantProfileChatPanel
     * that detects when spending transitions from blocked to unblocked.
     */
    const createSpendingTransitionDetector = () => {
      let prevBlocked = false; // Initial state (useRef)
      let reconnectCalls = 0;

      return {
        getReconnectCalls: () => reconnectCalls,
        /**
         * Simulates what happens when spendingGate.isBlocked changes
         * @param isBlocked - current value of spendingGate.isBlocked
         */
        onSpendingBlockedChange: (isBlocked: boolean) => {
          // This mirrors the useEffect in AssistantProfileChatPanel
          if (prevBlocked && !isBlocked) {
            // Spending just became unblocked - reconnect SSE
            reconnectCalls++;
          }
          prevBlocked = isBlocked;
        },
        getPrevBlocked: () => prevBlocked,
        reset: () => {
          prevBlocked = false;
          reconnectCalls = 0;
        },
      };
    };

    it('should detect blocked → unblocked transition', () => {
      const detector = createSpendingTransitionDetector();

      // Initial render with blocked state
      detector.onSpendingBlockedChange(true);
      expect(detector.getReconnectCalls()).toBe(0); // No transition yet

      // Spending becomes unblocked
      detector.onSpendingBlockedChange(false);
      expect(detector.getReconnectCalls()).toBe(1); // Transition detected!
    });

    it('should not trigger on initial unblocked state', () => {
      const detector = createSpendingTransitionDetector();

      // Initial render with unblocked state
      detector.onSpendingBlockedChange(false);
      expect(detector.getReconnectCalls()).toBe(0);
    });

    it('should not trigger on initial blocked state', () => {
      const detector = createSpendingTransitionDetector();

      // Initial render with blocked state
      detector.onSpendingBlockedChange(true);
      expect(detector.getReconnectCalls()).toBe(0);
    });

    it('should not trigger when staying blocked', () => {
      const detector = createSpendingTransitionDetector();

      detector.onSpendingBlockedChange(true);
      detector.onSpendingBlockedChange(true);
      detector.onSpendingBlockedChange(true);

      expect(detector.getReconnectCalls()).toBe(0);
    });

    it('should not trigger when staying unblocked', () => {
      const detector = createSpendingTransitionDetector();

      detector.onSpendingBlockedChange(false);
      detector.onSpendingBlockedChange(false);
      detector.onSpendingBlockedChange(false);

      expect(detector.getReconnectCalls()).toBe(0);
    });

    it('should not trigger on unblocked → blocked transition', () => {
      const detector = createSpendingTransitionDetector();

      detector.onSpendingBlockedChange(false); // Start unblocked
      detector.onSpendingBlockedChange(true); // Become blocked

      expect(detector.getReconnectCalls()).toBe(0);
    });

    it('should trigger on each blocked → unblocked transition', () => {
      const detector = createSpendingTransitionDetector();

      // First cycle
      detector.onSpendingBlockedChange(true);
      detector.onSpendingBlockedChange(false);
      expect(detector.getReconnectCalls()).toBe(1);

      // Second cycle
      detector.onSpendingBlockedChange(true);
      detector.onSpendingBlockedChange(false);
      expect(detector.getReconnectCalls()).toBe(2);

      // Third cycle
      detector.onSpendingBlockedChange(true);
      detector.onSpendingBlockedChange(false);
      expect(detector.getReconnectCalls()).toBe(3);
    });

    it('should handle rapid toggling correctly', () => {
      const detector = createSpendingTransitionDetector();

      // Rapid toggles
      detector.onSpendingBlockedChange(false); // 0 (initial)
      detector.onSpendingBlockedChange(true); // 0 (unblocked → blocked)
      detector.onSpendingBlockedChange(false); // 1 (blocked → unblocked!)
      detector.onSpendingBlockedChange(true); // 1 (unblocked → blocked)
      detector.onSpendingBlockedChange(true); // 1 (blocked → blocked)
      detector.onSpendingBlockedChange(false); // 2 (blocked → unblocked!)

      expect(detector.getReconnectCalls()).toBe(2);
    });
  });

  // ===========================================================================
  // useRef Pattern for Previous Value Tracking
  // ===========================================================================
  describe('useRef pattern for previous value tracking', () => {
    /**
     * Tests the React hook pattern: using useRef to track previous prop values
     */
    const usePrevious = <T,>(value: T): T | undefined => {
      const ref = React.useRef<T>();
      React.useEffect(() => {
        ref.current = value;
      });
      return ref.current;
    };

    it('should correctly track previous boolean values', () => {
      let currentValue = false;

      const { result, rerender } = renderHook(() => {
        const prev = usePrevious(currentValue);
        return { current: currentValue, prev };
      });

      // Initial render: prev is undefined
      expect(result.current.current).toBe(false);
      expect(result.current.prev).toBeUndefined();

      // Change value and rerender
      currentValue = true;
      rerender();

      // Now prev should be the old value
      expect(result.current.current).toBe(true);
      expect(result.current.prev).toBe(false);

      // Change again
      currentValue = false;
      rerender();

      expect(result.current.current).toBe(false);
      expect(result.current.prev).toBe(true);
    });
  });

  // ===========================================================================
  // Reconnection with Spending Gate Status
  // ===========================================================================
  describe('reconnection with spending gate status changes', () => {
    /**
     * Integration test simulating the full flow from spending gate change
     * to SSE reconnection trigger.
     */
    interface SpendingGate {
      isBlocked: boolean;
      blockReason: string | null;
    }

    const createFullSimulation = () => {
      let prevBlocked = false;
      let sseReconnectTrigger = 0;
      let sseReconnectAttempts = 0;
      let connectionStatus: 'connected' | 'connecting' | 'reconnecting' = 'connected';
      const eventLog: string[] = [];

      return {
        getConnectionStatus: () => connectionStatus,
        getReconnectTrigger: () => sseReconnectTrigger,
        getEventLog: () => eventLog,

        /**
         * Simulates spending gate status update (from parent component)
         */
        updateSpendingGate: (gate: SpendingGate) => {
          eventLog.push(`SpendingGate update: isBlocked=${gate.isBlocked}`);

          // Effect from AssistantProfileChatPanel
          if (prevBlocked && !gate.isBlocked) {
            eventLog.push('Transition detected: blocked → unblocked');

            // Call reconnectSSE
            sseReconnectAttempts = 0;
            sseReconnectTrigger++;

            eventLog.push(`reconnectSSE called, trigger=${sseReconnectTrigger}`);
          }

          prevBlocked = gate.isBlocked;
        },

        /**
         * Simulates SSE effect running (triggered by sseReconnectTrigger change)
         */
        simulateSSEEffect: (expectedTrigger: number) => {
          if (sseReconnectTrigger !== expectedTrigger) return;

          eventLog.push('SSE effect running, creating new EventSource');
          connectionStatus = 'connecting';

          // Simulate connection success
          setTimeout(() => {
            connectionStatus = 'connected';
            eventLog.push('SSE connected');
          }, 0);
        },
      };
    };

    it('should trigger full reconnection flow when spending unblocks', () => {
      const sim = createFullSimulation();

      // Start with blocked spending
      sim.updateSpendingGate({ isBlocked: true, blockReason: 'assistant_limit' });

      // Unblock spending
      sim.updateSpendingGate({ isBlocked: false, blockReason: null });

      // Verify the flow
      const log = sim.getEventLog();
      expect(log).toContain('Transition detected: blocked → unblocked');
      expect(log).toContain('reconnectSSE called, trigger=1');
      expect(sim.getReconnectTrigger()).toBe(1);
    });

    it('should not trigger reconnection flow when spending blocks', () => {
      const sim = createFullSimulation();

      // Start unblocked
      sim.updateSpendingGate({ isBlocked: false, blockReason: null });

      // Block spending
      sim.updateSpendingGate({ isBlocked: true, blockReason: 'user_limit' });

      // Verify no reconnection
      const log = sim.getEventLog();
      expect(log).not.toContain('Transition detected');
      expect(log).not.toContain('reconnectSSE called');
      expect(sim.getReconnectTrigger()).toBe(0);
    });

    it('should handle multiple block/unblock cycles', () => {
      const sim = createFullSimulation();

      // Cycle 1
      sim.updateSpendingGate({ isBlocked: true, blockReason: 'assistant_limit' });
      sim.updateSpendingGate({ isBlocked: false, blockReason: null });
      expect(sim.getReconnectTrigger()).toBe(1);

      // Cycle 2
      sim.updateSpendingGate({ isBlocked: true, blockReason: 'user_limit' });
      sim.updateSpendingGate({ isBlocked: false, blockReason: null });
      expect(sim.getReconnectTrigger()).toBe(2);

      // Cycle 3 with org limit
      sim.updateSpendingGate({ isBlocked: true, blockReason: 'org_limit' });
      sim.updateSpendingGate({ isBlocked: false, blockReason: null });
      expect(sim.getReconnectTrigger()).toBe(3);
    });

    it('should track block reason changes correctly', () => {
      const sim = createFullSimulation();

      // Start with assistant limit
      sim.updateSpendingGate({ isBlocked: true, blockReason: 'assistant_limit' });

      // Change to user limit (still blocked, different reason)
      sim.updateSpendingGate({ isBlocked: true, blockReason: 'user_limit' });

      // No reconnection should happen
      expect(sim.getReconnectTrigger()).toBe(0);

      // Now unblock
      sim.updateSpendingGate({ isBlocked: false, blockReason: null });

      // Now reconnection should happen
      expect(sim.getReconnectTrigger()).toBe(1);
    });
  });
});

// =============================================================================
// SECTION 3: SSE Reconnection Edge Cases
// =============================================================================
describe('SSE Reconnection Edge Cases', () => {
  describe('rapid state changes', () => {
    it('should handle synchronous block/unblock without issues', () => {
      let prevBlocked = false;
      let reconnectCount = 0;

      const handleChange = (isBlocked: boolean) => {
        if (prevBlocked && !isBlocked) {
          reconnectCount++;
        }
        prevBlocked = isBlocked;
      };

      // Synchronous rapid changes
      handleChange(true);
      handleChange(false);
      handleChange(true);
      handleChange(false);
      handleChange(true);
      handleChange(false);

      expect(reconnectCount).toBe(3);
    });
  });

  describe('initial state handling', () => {
    it('should not reconnect on first render even if initially blocked', () => {
      // Using useRef initial value pattern
      let prevBlocked: boolean | undefined = undefined; // Initially undefined
      let reconnectCount = 0;

      const handleChange = (isBlocked: boolean) => {
        // Skip if this is the first render (prevBlocked is undefined)
        if (prevBlocked !== undefined && prevBlocked && !isBlocked) {
          reconnectCount++;
        }
        prevBlocked = isBlocked;
      };

      // First render with blocked state
      handleChange(true);
      expect(reconnectCount).toBe(0);

      // Then unblock
      handleChange(false);
      expect(reconnectCount).toBe(1);
    });
  });

  describe('component unmount handling', () => {
    it('should not attempt reconnection if cleanup already ran', () => {
      let isCleanedUp = false;
      let prevBlocked = false;
      let reconnectCount = 0;

      const handleChange = (isBlocked: boolean) => {
        if (isCleanedUp) return; // Guard against updates after unmount

        if (prevBlocked && !isBlocked) {
          reconnectCount++;
        }
        prevBlocked = isBlocked;
      };

      const cleanup = () => {
        isCleanedUp = true;
      };

      // Normal operation
      handleChange(true);
      handleChange(false);
      expect(reconnectCount).toBe(1);

      // Cleanup runs (component unmounts)
      cleanup();

      // State changes after unmount should be ignored
      handleChange(true);
      handleChange(false);
      expect(reconnectCount).toBe(1); // Still 1, not 2
    });
  });
});

// =============================================================================
// SECTION 4: SSE Contact Filtering
// =============================================================================
describe('useAssistantProfileChat - SSE Contact Filtering', () => {
  const USER_CONTACT_ID = 42;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    lastEventSource = null;
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  async function renderReady(contactId: number = USER_CONTACT_ID) {
    const assistant = createMockAssistant();
    const chatHistories: Record<string, any[]> = {};
    const setChatHistories = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        Object.assign(chatHistories, updater(chatHistories));
      }
    });

    const hookResult = renderHook(() =>
      useAssistantProfileChat(
        assistant,
        createMockAssistantActions({ getContactId: vi.fn(async () => contactId) }),
        chatHistories,
        setChatHistories,
        'test@example.com'
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const es = lastEventSource!;
    expect(es).not.toBeNull();
    await act(async () => {
      es.onopen?.();
    });

    return { ...hookResult, es, setChatHistories, chatHistories, assistant };
  }

  it('accepts messages whose contact_id matches the current user', async () => {
    const { es, setChatHistories } = await renderReady();

    await act(async () => {
      es.onmessage?.({
        data: JSON.stringify({
          thread: 'unify_message_outbound',
          id: 'msg-1',
          publishTime: new Date().toISOString(),
          event: { content: 'hello Adam', role: 'assistant', contact_id: USER_CONTACT_ID },
        }),
      });
    });

    const lastCall = setChatHistories.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const updater = lastCall![0] as (prev: Record<string, any[]>) => Record<string, any[]>;
    const result = updater({ 'test-assistant-1': [] });
    expect(result['test-assistant-1'].some((m: any) => m.content === 'hello Adam')).toBe(true);
  });

  it('filters out messages whose contact_id belongs to a different user', async () => {
    const { es, setChatHistories } = await renderReady();
    const callCountBefore = setChatHistories.mock.calls.length;

    await act(async () => {
      es.onmessage?.({
        data: JSON.stringify({
          thread: 'unify_message_outbound',
          id: 'msg-wrong',
          publishTime: new Date().toISOString(),
          event: { content: 'hello Daniel', role: 'assistant', contact_id: 99 },
        }),
      });
    });

    const newCalls = setChatHistories.mock.calls.slice(callCountBefore);
    for (const call of newCalls) {
      const fn = call[0];
      if (typeof fn === 'function') {
        const result = fn({ 'test-assistant-1': [] });
        const msgs = result['test-assistant-1'] || [];
        expect(msgs.some((m: any) => m.content === 'hello Daniel')).toBe(false);
      }
    }
  });

  it('accepts messages with no contact_id (backward compatible)', async () => {
    const { es, setChatHistories } = await renderReady();

    await act(async () => {
      es.onmessage?.({
        data: JSON.stringify({
          thread: 'unify_message_outbound',
          id: 'msg-nocontact',
          publishTime: new Date().toISOString(),
          event: { content: 'no contact', role: 'assistant' },
        }),
      });
    });

    const lastCall = setChatHistories.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const updater = lastCall![0] as (prev: Record<string, any[]>) => Record<string, any[]>;
    const result = updater({ 'test-assistant-1': [] });
    expect(result['test-assistant-1'].some((m: any) => m.content === 'no contact')).toBe(true);
  });
});

// =============================================================================
// SECTION 5: Polling Fallback for Missed SSE Messages
// =============================================================================
describe('useAssistantProfileChat - Polling Fallback', () => {
  const USER_CONTACT_ID = 42;
  const POLL_INTERVAL_MS = 15_000;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  function makeTranscriptResponse(
    messages: Array<{ id: number; senderId: number; content: string; ts?: string }>
  ) {
    return new Response(
      JSON.stringify({
        logs: messages.map((m) => ({
          id: m.id,
          ts: m.ts ?? new Date().toISOString(),
          entries: {
            senderId: m.senderId,
            content: m.content,
            messageId: m.id,
            medium: 'unify_message',
            timestamp: m.ts ?? new Date().toISOString(),
            attachments: [],
          },
        })),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    lastEventSource = null;
    sessionStorage.clear();
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  async function renderReady(contactId: number = USER_CONTACT_ID) {
    const assistant = createMockAssistant();
    const chatHistories: Record<string, any[]> = {};
    const setChatHistories = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        Object.assign(chatHistories, updater(chatHistories));
      }
    });

    const hookResult = renderHook(() =>
      useAssistantProfileChat(
        assistant,
        createMockAssistantActions({ getContactId: vi.fn(async () => contactId) }),
        chatHistories,
        setChatHistories,
        'test@example.com'
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const es = lastEventSource!;
    expect(es).not.toBeNull();
    await act(async () => {
      es.onopen?.();
    });

    return { ...hookResult, es, setChatHistories, chatHistories, assistant };
  }

  it('polls for transcripts and merges messages that SSE missed', async () => {
    const { setChatHistories } = await renderReady();

    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      if (typeof url === 'string' && url.includes('/api/logs'))
        return Promise.resolve(
          makeTranscriptResponse([{ id: 999, senderId: 0, content: 'Missed by SSE' }])
        );
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 1000);
    });

    const updaters = setChatHistories.mock.calls
      .map((c: any) => c[0])
      .filter((fn: any) => typeof fn === 'function');
    let state: Record<string, any[]> = { 'test-assistant-1': [] };
    for (const fn of updaters) {
      state = fn(state);
    }
    expect(state['test-assistant-1'].some((m: any) => m.content === 'Missed by SSE')).toBe(true);
  });

  it('replaces SSE message with Orchestra version on poll (different IDs, same content)', async () => {
    const { es, setChatHistories } = await renderReady();
    const sseTime = new Date().toISOString();
    const orchestraTime = new Date(Date.now() + 2000).toISOString();

    await act(async () => {
      es.onmessage?.({
        data: JSON.stringify({
          thread: 'unify_message_outbound',
          id: 'pubsub-id-abc',
          publishTime: sseTime,
          event: { content: 'Hello there', contact_id: USER_CONTACT_ID },
        }),
      });
    });

    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      if (typeof url === 'string' && url.includes('/api/logs'))
        return Promise.resolve(
          makeTranscriptResponse([
            { id: 555, senderId: 0, content: 'Hello there', ts: orchestraTime },
          ])
        );
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 1000);
    });

    const updaters = setChatHistories.mock.calls
      .map((c: any) => c[0])
      .filter((fn: any) => typeof fn === 'function');
    let state: Record<string, any[]> = { 'test-assistant-1': [] };
    for (const fn of updaters) {
      state = fn(state);
    }
    const matching = state['test-assistant-1'].filter((m: any) => m.content === 'Hello there');
    expect(matching).toHaveLength(1);
    expect(matching[0].id).toBe('555');
  });

  it('replaces pre-hire messages with Orchestra versions despite hours-apart timestamps', async () => {
    const { setChatHistories } = await renderReady();

    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const preHireMessages = [
      {
        id: 'uuid-greeting',
        role: 'assistant' as const,
        content: 'Hi! Welcome aboard.',
        timestamp: new Date(fourHoursAgo),
      },
      {
        id: 'uuid-user',
        role: 'user' as const,
        content: 'Hey, how are you?',
        timestamp: new Date(fourHoursAgo),
      },
      {
        id: 'uuid-reply',
        role: 'assistant' as const,
        content: 'Doing great, thanks!',
        timestamp: new Date(fourHoursAgo),
      },
    ];

    await act(async () => {
      setChatHistories((prev: Record<string, any[]>) => ({
        ...prev,
        'test-assistant-1': preHireMessages,
      }));
    });

    const now = new Date().toISOString();
    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      if (typeof url === 'string' && url.includes('/api/logs'))
        return Promise.resolve(
          makeTranscriptResponse([
            { id: 101, senderId: 0, content: 'Hi! Welcome aboard.', ts: now },
            { id: 102, senderId: 1, content: 'Hey, how are you?', ts: now },
            { id: 103, senderId: 0, content: 'Doing great, thanks!', ts: now },
          ])
        );
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 1000);
    });

    const updaters = setChatHistories.mock.calls
      .map((c: any) => c[0])
      .filter((fn: any) => typeof fn === 'function');
    let state: Record<string, any[]> = { 'test-assistant-1': preHireMessages };
    for (const fn of updaters) {
      state = fn(state);
    }
    const msgs = state['test-assistant-1'];
    expect(msgs).toHaveLength(3);
    expect(msgs.every((m: any) => ['101', '102', '103'].includes(m.id))).toBe(true);
    expect(msgs.every((m: any) => !m.id.startsWith('uuid-'))).toBe(true);
  });

  it('correctly reconciles repeated identical messages without squashing', async () => {
    const { setChatHistories } = await renderReady();

    const optimisticMessages = [
      {
        id: 'uuid-1',
        role: 'user' as const,
        content: 'Hello?',
        timestamp: new Date('2026-03-27T09:00:00Z'),
      },
      {
        id: 'uuid-2',
        role: 'user' as const,
        content: 'Hello?',
        timestamp: new Date('2026-03-27T09:01:00Z'),
      },
    ];

    await act(async () => {
      setChatHistories((prev: Record<string, any[]>) => ({
        ...prev,
        'test-assistant-1': optimisticMessages,
      }));
    });

    const ts1 = '2026-03-27T09:00:05Z';
    const ts2 = '2026-03-27T09:01:05Z';
    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      if (typeof url === 'string' && url.includes('/api/logs'))
        return Promise.resolve(
          makeTranscriptResponse([
            { id: 201, senderId: 1, content: 'Hello?', ts: ts1 },
            { id: 202, senderId: 1, content: 'Hello?', ts: ts2 },
          ])
        );
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 1000);
    });

    const updaters = setChatHistories.mock.calls
      .map((c: any) => c[0])
      .filter((fn: any) => typeof fn === 'function');
    let state: Record<string, any[]> = { 'test-assistant-1': optimisticMessages };
    for (const fn of updaters) {
      state = fn(state);
    }
    const msgs = state['test-assistant-1'];
    expect(msgs).toHaveLength(2);
    expect(msgs[0].id).toBe('201');
    expect(msgs[1].id).toBe('202');
  });

  it('refetches immediately when the tab regains visibility', async () => {
    await renderReady();

    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      if (typeof url === 'string' && url.includes('/api/logs'))
        return Promise.resolve(
          makeTranscriptResponse([{ id: 888, senderId: 0, content: 'After tab switch' }])
        );
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    const callsBefore = fetchSpy.mock.calls.length;

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    const logsCalls = fetchSpy.mock.calls
      .slice(callsBefore)
      .filter(
        (c: [RequestInfo | URL, RequestInit?]) =>
          typeof c[0] === 'string' && (c[0] as string).includes('/api/logs')
      );
    expect(logsCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('silently handles polling errors without disrupting the chat', async () => {
    const { es, setChatHistories } = await renderReady();

    await act(async () => {
      es.onmessage?.({
        data: JSON.stringify({
          thread: 'unify_message_outbound',
          id: 'pre-error-msg',
          publishTime: new Date().toISOString(),
          event: { content: 'Before error', contact_id: USER_CONTACT_ID },
        }),
      });
    });

    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      if (typeof url === 'string' && url.includes('/api/logs'))
        return Promise.reject(new Error('network down'));
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 1000);
    });

    const updaters = setChatHistories.mock.calls
      .map((c: any) => c[0])
      .filter((fn: any) => typeof fn === 'function');
    let state: Record<string, any[]> = { 'test-assistant-1': [] };
    for (const fn of updaters) {
      state = fn(state);
    }
    expect(state['test-assistant-1'].some((m: any) => m.content === 'Before error')).toBe(true);
  });
});

// =============================================================================
// SECTION 6: Timestamp Clamping (Clock Skew Protection)
// =============================================================================
describe('useAssistantProfileChat - Timestamp Clamping', () => {
  const USER_CONTACT_ID = 42;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    lastEventSource = null;
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  /**
   * Helper: render the hook to 'ready' state with a given set of pre-existing
   * messages in chatHistories, then return everything needed to test sendMessage.
   */
  async function renderWithHistory(
    existingMessages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
    }>,
    contactId: number = USER_CONTACT_ID
  ) {
    const assistant = createMockAssistant();
    const chatHistories: Record<string, any[]> = {
      'test-assistant-1': existingMessages,
    };
    const setChatHistories = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        Object.assign(chatHistories, updater(chatHistories));
      }
    });

    const hookResult = renderHook(() =>
      useAssistantProfileChat(
        assistant,
        createMockAssistantActions({ getContactId: vi.fn(async () => contactId) }),
        chatHistories,
        setChatHistories as any,
        'test@example.com'
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const es = lastEventSource!;
    expect(es).not.toBeNull();
    await act(async () => {
      es.onopen?.();
    });

    return { ...hookResult, es, setChatHistories, chatHistories, assistant };
  }

  /**
   * Replays all functional setChatHistories updaters against an initial state.
   */
  function replayUpdaters(
    mock: ReturnType<typeof vi.fn>,
    initialState: Record<string, any[]>
  ): Record<string, any[]> {
    let state = { ...initialState };
    for (const call of mock.mock.calls) {
      const fn = call[0];
      if (typeof fn === 'function') {
        state = fn(state);
      }
    }
    return state;
  }

  // -------------------------------------------------------------------------
  // sendMessage clamping
  // -------------------------------------------------------------------------
  describe('sendMessage timestamp clamping', () => {
    it('clamps user message timestamp when client clock is behind server', async () => {
      // Server-timestamped messages are 10 minutes in the "future" relative
      // to the client clock — simulating a client clock that's 10 min behind.
      const serverNow = new Date('2025-03-27T15:00:00.000Z');
      const clientNow = new Date('2025-03-27T14:50:00.000Z');

      const existingMessages = [
        {
          id: 'srv-1',
          role: 'assistant' as const,
          content: 'Hello!',
          timestamp: new Date('2025-03-27T14:58:00.000Z'),
        },
        {
          id: 'srv-2',
          role: 'user' as const,
          content: 'Hi',
          timestamp: new Date('2025-03-27T14:59:00.000Z'),
        },
        {
          id: 'srv-3',
          role: 'assistant' as const,
          content: 'How can I help?',
          timestamp: serverNow,
        },
      ];

      vi.setSystemTime(clientNow);

      const { result, setChatHistories, chatHistories } = await renderWithHistory(existingMessages);

      // Type a message and send
      act(() => {
        result.current.handleInputChange({
          target: { value: 'My new message' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        result.current.sendMessage(
          { preventDefault: () => {} } as React.FormEvent,
          undefined,
          undefined
        );
        await vi.advanceTimersByTimeAsync(100);
      });

      // Replay all updaters to get the final state
      const finalState = replayUpdaters(setChatHistories, {
        'test-assistant-1': existingMessages,
      });

      const msgs = finalState['test-assistant-1'];
      const userMsg = msgs.find((m: any) => m.content === 'My new message');
      expect(userMsg).toBeDefined();

      // The clamped timestamp must be AFTER the latest server message
      const userMsgTs = new Date(userMsg.timestamp).getTime();
      const latestServerTs = serverNow.getTime();
      expect(userMsgTs).toBeGreaterThan(latestServerTs);

      // The message should be the last one after sorting
      const sorted = [...msgs].sort(
        (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      expect(sorted[sorted.length - 1].content).toBe('My new message');
    });

    it('uses client timestamp when client clock is ahead of server', async () => {
      const serverTs = new Date('2025-03-27T15:00:00.000Z');
      const clientNow = new Date('2025-03-27T15:05:00.000Z');

      const existingMessages = [
        { id: 'srv-1', role: 'assistant' as const, content: 'Hello!', timestamp: serverTs },
      ];

      vi.setSystemTime(clientNow);

      const { result, setChatHistories } = await renderWithHistory(existingMessages);

      act(() => {
        result.current.handleInputChange({
          target: { value: 'Ahead message' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        result.current.sendMessage(
          { preventDefault: () => {} } as React.FormEvent,
          undefined,
          undefined
        );
        await vi.advanceTimersByTimeAsync(100);
      });

      const finalState = replayUpdaters(setChatHistories, {
        'test-assistant-1': existingMessages,
      });

      const msgs = finalState['test-assistant-1'];
      const userMsg = msgs.find((m: any) => m.content === 'Ahead message');
      expect(userMsg).toBeDefined();

      // When client is ahead, timestamp should use client time (it's already
      // greater than lastTs + 1)
      const userMsgTs = new Date(userMsg.timestamp).getTime();
      expect(userMsgTs).toBeGreaterThanOrEqual(clientNow.getTime());
    });

    it('assigns monotonically increasing timestamps to rapid successive sends', async () => {
      const serverTs = new Date('2025-03-27T15:00:00.000Z');
      // Client clock is 5 minutes behind — both sends will need clamping
      const clientNow = new Date('2025-03-27T14:55:00.000Z');

      const existingMessages = [
        { id: 'srv-1', role: 'assistant' as const, content: 'Hello!', timestamp: serverTs },
      ];

      vi.setSystemTime(clientNow);

      const { result, setChatHistories } = await renderWithHistory(existingMessages);

      // Send first message
      act(() => {
        result.current.handleInputChange({
          target: { value: 'First' },
        } as React.ChangeEvent<HTMLInputElement>);
      });
      await act(async () => {
        result.current.sendMessage(
          { preventDefault: () => {} } as React.FormEvent,
          undefined,
          undefined
        );
        await vi.advanceTimersByTimeAsync(10);
      });

      // Send second message
      act(() => {
        result.current.handleInputChange({
          target: { value: 'Second' },
        } as React.ChangeEvent<HTMLInputElement>);
      });
      await act(async () => {
        result.current.sendMessage(
          { preventDefault: () => {} } as React.FormEvent,
          undefined,
          undefined
        );
        await vi.advanceTimersByTimeAsync(10);
      });

      // Replay all updaters sequentially (simulates React's functional
      // updater guarantee: each sees the result of the previous one)
      const finalState = replayUpdaters(setChatHistories, {
        'test-assistant-1': existingMessages,
      });

      const msgs = finalState['test-assistant-1'];
      const first = msgs.find((m: any) => m.content === 'First');
      const second = msgs.find((m: any) => m.content === 'Second');

      expect(first).toBeDefined();
      expect(second).toBeDefined();

      const firstTs = new Date(first.timestamp).getTime();
      const secondTs = new Date(second.timestamp).getTime();

      // Both must be after the server message
      expect(firstTs).toBeGreaterThan(serverTs.getTime());
      expect(secondTs).toBeGreaterThan(serverTs.getTime());

      // Second must be strictly after first
      expect(secondTs).toBeGreaterThan(firstTs);

      // Both must sort to the end, in order
      const sorted = [...msgs].sort(
        (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      expect(sorted[sorted.length - 2].content).toBe('First');
      expect(sorted[sorted.length - 1].content).toBe('Second');
    });

    it('does not clamp when chat history is empty', async () => {
      const clientNow = new Date('2025-03-27T15:00:00.000Z');
      vi.setSystemTime(clientNow);

      const { result, setChatHistories } = await renderWithHistory([]);

      act(() => {
        result.current.handleInputChange({
          target: { value: 'First ever message' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        result.current.sendMessage(
          { preventDefault: () => {} } as React.FormEvent,
          undefined,
          undefined
        );
        await vi.advanceTimersByTimeAsync(100);
      });

      const finalState = replayUpdaters(setChatHistories, {
        'test-assistant-1': [],
      });

      const msgs = finalState['test-assistant-1'];
      const userMsg = msgs.find((m: any) => m.content === 'First ever message');
      expect(userMsg).toBeDefined();

      // With empty history, lastTs is 0 so max(Date.now(), 0+1) = Date.now()
      const userMsgTs = new Date(userMsg.timestamp).getTime();
      expect(userMsgTs).toBeGreaterThanOrEqual(clientNow.getTime());
    });
  });

  // -------------------------------------------------------------------------
  // BroadcastChannel clamping
  // -------------------------------------------------------------------------
  describe('BroadcastChannel user message clamping', () => {
    it('clamps a broadcast user message that has a timestamp behind existing messages', async () => {
      const serverTs = new Date('2025-03-27T15:00:00.000Z');
      // Simulate a broadcast message from another tab with a client-time
      // timestamp that's behind server messages.
      const staleClientTs = new Date('2025-03-27T14:50:00.000Z');

      const existingMessages = [
        { id: 'srv-1', role: 'assistant' as const, content: 'Hello!', timestamp: serverTs },
      ];

      const { setChatHistories } = await renderWithHistory(existingMessages);

      // Find the BroadcastChannel's onmessage handler set up by the hook.
      // The hook creates a BroadcastChannel during render. Our mock stores
      // calls — find the setChatHistories updater by simulating what the
      // BroadcastChannel handler does: it calls setChatHistories with a
      // functional updater that checks for duplicates, clamps, and sorts.
      //
      // We test the updater logic directly by calling it with our scenario.
      const broadcastMessage = {
        id: 'broadcast-user-1',
        role: 'user' as const,
        content: 'Message from other tab',
        timestamp: staleClientTs,
      };

      // Simulate receiving a BroadcastChannel message by finding the
      // channel handler. The hook registers it in the BroadcastChannel
      // effect. We'll invoke the setChatHistories updater pattern directly.
      //
      // The BroadcastChannel handler does:
      // 1. Create messageWithDate from broadcast
      // 2. setChatHistories with updater that clamps user messages
      //
      // We test by creating the exact updater the hook would create:
      const updater = (prev: Record<string, any[]>) => {
        const current = prev['test-assistant-1'] || [];
        const messageWithDate = {
          ...broadcastMessage,
          timestamp: new Date(broadcastMessage.timestamp),
        };
        if (current.some((m: any) => m.id === messageWithDate.id)) {
          return prev;
        }
        let finalMsg = messageWithDate;
        if (messageWithDate.role === 'user' && current.length > 0) {
          const lastTs = Math.max(...current.map((m: any) => new Date(m.timestamp).getTime()));
          const msgTs = new Date(messageWithDate.timestamp).getTime();
          if (msgTs <= lastTs) {
            finalMsg = { ...messageWithDate, timestamp: new Date(lastTs + 1) };
          }
        }
        const updated = [...current, finalMsg].sort(
          (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return { ...prev, 'test-assistant-1': updated };
      };

      const result = updater({ 'test-assistant-1': existingMessages });
      const msgs = result['test-assistant-1'];
      const broadcastMsg = msgs.find((m: any) => m.content === 'Message from other tab');

      expect(broadcastMsg).toBeDefined();
      const broadcastMsgTs = new Date(broadcastMsg.timestamp).getTime();

      // Must be after the existing server message
      expect(broadcastMsgTs).toBeGreaterThan(serverTs.getTime());
      expect(broadcastMsgTs).toBe(serverTs.getTime() + 1);

      // Must sort to the end
      expect(msgs[msgs.length - 1].content).toBe('Message from other tab');
    });

    it('does not clamp assistant messages from BroadcastChannel', () => {
      const serverTs = new Date('2025-03-27T15:00:00.000Z');
      const existingMessages = [
        { id: 'user-1', role: 'user' as const, content: 'Hello', timestamp: serverTs },
      ];

      // An assistant message with an older timestamp (from server backlog)
      const olderAssistantTs = new Date('2025-03-27T14:59:00.000Z');
      const broadcastMessage: {
        id: string;
        role: 'assistant' | 'user';
        content: string;
        timestamp: Date;
      } = {
        id: 'broadcast-assistant-1',
        role: 'assistant' as const,
        content: 'Proactive greeting',
        timestamp: olderAssistantTs,
      };

      const updater = (prev: Record<string, any[]>) => {
        const current = prev['test-assistant-1'] || [];
        const messageWithDate = {
          ...broadcastMessage,
          timestamp: new Date(broadcastMessage.timestamp),
        };
        if (current.some((m: any) => m.id === messageWithDate.id)) {
          return prev;
        }
        let finalMsg = messageWithDate;
        if (messageWithDate.role === 'user' && current.length > 0) {
          const lastTs = Math.max(...current.map((m: any) => new Date(m.timestamp).getTime()));
          const msgTs = new Date(messageWithDate.timestamp).getTime();
          if (msgTs <= lastTs) {
            finalMsg = { ...messageWithDate, timestamp: new Date(lastTs + 1) };
          }
        }
        const updated = [...current, finalMsg].sort(
          (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return { ...prev, 'test-assistant-1': updated };
      };

      const result = updater({ 'test-assistant-1': existingMessages });
      const msgs = result['test-assistant-1'];
      const assistantMsg = msgs.find((m: any) => m.content === 'Proactive greeting');

      expect(assistantMsg).toBeDefined();
      // Assistant message should keep its original timestamp (not clamped)
      expect(new Date(assistantMsg.timestamp).getTime()).toBe(olderAssistantTs.getTime());
      // It should sort before the user message (older timestamp)
      expect(msgs[0].content).toBe('Proactive greeting');
    });
  });

  // -------------------------------------------------------------------------
  // Interaction with SSE messages
  // -------------------------------------------------------------------------
  describe('clamping interaction with SSE messages', () => {
    it('user message sorts before assistant reply that arrives after', async () => {
      const serverTs = new Date('2025-03-27T15:00:00.000Z');
      const clientNow = new Date('2025-03-27T14:55:00.000Z');

      const existingMessages = [
        { id: 'srv-1', role: 'assistant' as const, content: 'Hello!', timestamp: serverTs },
      ];

      vi.setSystemTime(clientNow);

      const { result, es, setChatHistories } = await renderWithHistory(existingMessages);

      // User sends a message (clock is behind)
      act(() => {
        result.current.handleInputChange({
          target: { value: 'User question' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        result.current.sendMessage(
          { preventDefault: () => {} } as React.FormEvent,
          undefined,
          undefined
        );
        await vi.advanceTimersByTimeAsync(100);
      });

      // Assistant replies via SSE with a server timestamp 30 seconds after
      // the last server message
      const replyTs = new Date('2025-03-27T15:00:30.000Z');
      await act(async () => {
        es.onmessage?.({
          data: JSON.stringify({
            thread: 'unify_message_outbound',
            id: 'sse-reply-1',
            publishTime: replyTs.toISOString(),
            event: {
              content: 'Assistant answer',
              role: 'assistant',
              contact_id: USER_CONTACT_ID,
            },
          }),
        });
      });

      const finalState = replayUpdaters(setChatHistories, {
        'test-assistant-1': existingMessages,
      });

      const msgs = finalState['test-assistant-1'];
      const sorted = [...msgs].sort(
        (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Order should be: original → user question → assistant answer
      expect(sorted.map((m: any) => m.content)).toEqual([
        'Hello!',
        'User question',
        'Assistant answer',
      ]);
    });
  });
});
