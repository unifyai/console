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

// Mock EventSource
class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  close = vi.fn();
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
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
