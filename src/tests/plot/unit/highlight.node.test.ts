/**
 * Highlight Logic Unit Tests
 *
 * Tests for bidirectional hover highlighting between plot and drawer.
 *
 * This tests:
 * - HighlightTarget type discrimination
 * - State transitions (none -> group -> datapoint -> none)
 * - Highlight logic helpers
 */

import { describe, it, expect } from 'vitest';
import type { HighlightTarget } from '@/types/interfaces/plot';

// =============================================================================
// HighlightTarget Type Tests
// =============================================================================

describe('HighlightTarget', () => {
  describe('type discrimination', () => {
    it('handles { type: "none" }', () => {
      const target: HighlightTarget = { type: 'none' };

      expect(target.type).toBe('none');
      expect('groupKey' in target).toBe(false);
      expect('datapointId' in target).toBe(false);
    });

    it('handles { type: "group", groupKey: "..." }', () => {
      const target: HighlightTarget = { type: 'group', groupKey: 'Category A' };

      expect(target.type).toBe('group');
      expect(target.groupKey).toBe('Category A');
    });

    it('handles { type: "datapoint", datapointId: "..." }', () => {
      const target: HighlightTarget = { type: 'datapoint', datapointId: 'dp-123' };

      expect(target.type).toBe('datapoint');
      expect(target.datapointId).toBe('dp-123');
    });
  });
});

// =============================================================================
// Highlight State Transitions Tests
// =============================================================================

describe('highlight state transitions', () => {
  /**
   * Helper to simulate state machine transitions
   */
  function createHighlightStateMachine() {
    let currentTarget: HighlightTarget = { type: 'none' };

    return {
      get current() {
        return currentTarget;
      },
      setHighlight(target: HighlightTarget) {
        currentTarget = target;
      },
      clearHighlight() {
        currentTarget = { type: 'none' };
      },
      isHighlighted(target: HighlightTarget): boolean {
        if (currentTarget.type !== target.type) return false;
        if (currentTarget.type === 'none') return true;
        if (currentTarget.type === 'group' && target.type === 'group') {
          return currentTarget.groupKey === target.groupKey;
        }
        if (currentTarget.type === 'datapoint' && target.type === 'datapoint') {
          return currentTarget.datapointId === target.datapointId;
        }
        return false;
      },
    };
  }

  it('none -> group -> none (hover and unhover)', () => {
    const machine = createHighlightStateMachine();

    // Initial state
    expect(machine.current.type).toBe('none');

    // Hover on group
    machine.setHighlight({ type: 'group', groupKey: 'Category A' });
    expect(machine.current.type).toBe('group');
    expect((machine.current as { type: 'group'; groupKey: string }).groupKey).toBe('Category A');

    // Unhover
    machine.clearHighlight();
    expect(machine.current.type).toBe('none');
  });

  it('none -> datapoint -> none (hover and unhover)', () => {
    const machine = createHighlightStateMachine();

    // Initial state
    expect(machine.current.type).toBe('none');

    // Hover on datapoint
    machine.setHighlight({ type: 'datapoint', datapointId: 'dp-123' });
    expect(machine.current.type).toBe('datapoint');
    expect((machine.current as { type: 'datapoint'; datapointId: string }).datapointId).toBe(
      'dp-123'
    );

    // Unhover
    machine.clearHighlight();
    expect(machine.current.type).toBe('none');
  });

  it('group -> different group (rapid hover)', () => {
    const machine = createHighlightStateMachine();

    // Hover on group A
    machine.setHighlight({ type: 'group', groupKey: 'A' });
    expect((machine.current as { type: 'group'; groupKey: string }).groupKey).toBe('A');

    // Rapidly move to group B (no unhover in between)
    machine.setHighlight({ type: 'group', groupKey: 'B' });
    expect((machine.current as { type: 'group'; groupKey: string }).groupKey).toBe('B');

    // Move to group C
    machine.setHighlight({ type: 'group', groupKey: 'C' });
    expect((machine.current as { type: 'group'; groupKey: string }).groupKey).toBe('C');
  });

  it('datapoint -> group (hover change)', () => {
    const machine = createHighlightStateMachine();

    // Hover on datapoint
    machine.setHighlight({ type: 'datapoint', datapointId: 'dp-1' });
    expect(machine.current.type).toBe('datapoint');

    // Move hover to group
    machine.setHighlight({ type: 'group', groupKey: 'A' });
    expect(machine.current.type).toBe('group');
  });

  it('group -> datapoint (hover change)', () => {
    const machine = createHighlightStateMachine();

    // Hover on group
    machine.setHighlight({ type: 'group', groupKey: 'A' });
    expect(machine.current.type).toBe('group');

    // Move hover to datapoint
    machine.setHighlight({ type: 'datapoint', datapointId: 'dp-1' });
    expect(machine.current.type).toBe('datapoint');
  });

  it('isHighlighted correctly identifies matching targets', () => {
    const machine = createHighlightStateMachine();

    // None state
    expect(machine.isHighlighted({ type: 'none' })).toBe(true);
    expect(machine.isHighlighted({ type: 'group', groupKey: 'A' })).toBe(false);

    // Group state
    machine.setHighlight({ type: 'group', groupKey: 'A' });
    expect(machine.isHighlighted({ type: 'group', groupKey: 'A' })).toBe(true);
    expect(machine.isHighlighted({ type: 'group', groupKey: 'B' })).toBe(false);
    expect(machine.isHighlighted({ type: 'datapoint', datapointId: 'dp-1' })).toBe(false);

    // Datapoint state
    machine.setHighlight({ type: 'datapoint', datapointId: 'dp-1' });
    expect(machine.isHighlighted({ type: 'datapoint', datapointId: 'dp-1' })).toBe(true);
    expect(machine.isHighlighted({ type: 'datapoint', datapointId: 'dp-2' })).toBe(false);
    expect(machine.isHighlighted({ type: 'group', groupKey: 'A' })).toBe(false);
  });
});

// =============================================================================
// Highlight Helper Functions
// =============================================================================

describe('highlight helper functions', () => {
  /**
   * Determines if an element should be visible based on highlight state
   */
  function shouldBeVisible(
    elementGroup: string | undefined,
    elementId: string | undefined,
    highlightTarget: HighlightTarget,
    hasGroupBy: boolean
  ): boolean {
    // No highlight - everything visible
    if (highlightTarget.type === 'none') {
      return true;
    }

    // Group highlight - only elements in that group visible
    if (highlightTarget.type === 'group') {
      if (!hasGroupBy) return true; // Ungrouped charts ignore group highlight
      return elementGroup === highlightTarget.groupKey;
    }

    // Datapoint highlight - only that specific element visible
    if (highlightTarget.type === 'datapoint') {
      return elementId === highlightTarget.datapointId;
    }

    return true;
  }

  /**
   * Calculates opacity based on highlight state
   */
  function calculateOpacity(
    elementGroup: string | undefined,
    elementId: string | undefined,
    highlightTarget: HighlightTarget,
    hasGroupBy: boolean
  ): number {
    if (!shouldBeVisible(elementGroup, elementId, highlightTarget, hasGroupBy)) {
      return hasGroupBy ? 0 : 0.2; // Grouped: hide, Ungrouped: dim
    }
    return 1;
  }

  describe('shouldBeVisible', () => {
    it('returns true for all elements when no highlight', () => {
      const target: HighlightTarget = { type: 'none' };

      expect(shouldBeVisible('A', 'dp-1', target, true)).toBe(true);
      expect(shouldBeVisible('B', 'dp-2', target, true)).toBe(true);
      expect(shouldBeVisible(undefined, 'dp-3', target, false)).toBe(true);
    });

    it('returns true only for matching group when group highlight', () => {
      const target: HighlightTarget = { type: 'group', groupKey: 'A' };

      expect(shouldBeVisible('A', 'dp-1', target, true)).toBe(true);
      expect(shouldBeVisible('B', 'dp-2', target, true)).toBe(false);
      expect(shouldBeVisible('C', 'dp-3', target, true)).toBe(false);
    });

    it('ignores group highlight for ungrouped charts', () => {
      const target: HighlightTarget = { type: 'group', groupKey: 'A' };

      // hasGroupBy = false means ungrouped chart
      expect(shouldBeVisible(undefined, 'dp-1', target, false)).toBe(true);
      expect(shouldBeVisible(undefined, 'dp-2', target, false)).toBe(true);
    });

    it('returns true only for matching datapoint when datapoint highlight', () => {
      const target: HighlightTarget = { type: 'datapoint', datapointId: 'dp-1' };

      expect(shouldBeVisible('A', 'dp-1', target, true)).toBe(true);
      expect(shouldBeVisible('A', 'dp-2', target, true)).toBe(false);
      expect(shouldBeVisible('B', 'dp-3', target, true)).toBe(false);
    });
  });

  describe('calculateOpacity', () => {
    it('returns 1 for all elements when no highlight', () => {
      const target: HighlightTarget = { type: 'none' };

      expect(calculateOpacity('A', 'dp-1', target, true)).toBe(1);
      expect(calculateOpacity('B', 'dp-2', target, true)).toBe(1);
    });

    it('returns 0 for non-matching groups (grouped charts)', () => {
      const target: HighlightTarget = { type: 'group', groupKey: 'A' };

      expect(calculateOpacity('A', 'dp-1', target, true)).toBe(1);
      expect(calculateOpacity('B', 'dp-2', target, true)).toBe(0);
    });

    it('returns 0.2 for non-matching elements (ungrouped charts)', () => {
      const target: HighlightTarget = { type: 'datapoint', datapointId: 'dp-1' };

      expect(calculateOpacity(undefined, 'dp-1', target, false)).toBe(1);
      expect(calculateOpacity(undefined, 'dp-2', target, false)).toBe(0.2);
    });

    it('returns 1 for matching datapoint', () => {
      const target: HighlightTarget = { type: 'datapoint', datapointId: 'dp-1' };

      expect(calculateOpacity('A', 'dp-1', target, true)).toBe(1);
    });
  });
});

// =============================================================================
// ID Generation for Highlights
// =============================================================================

describe('highlight ID generation', () => {
  /**
   * Generates a unique ID for a datapoint based on its values
   */
  function generateDatapointId(
    group: string | undefined,
    xValue: string | number,
    yValue: string | number
  ): string {
    const prefix = group ? `${group}-` : '';
    return `${prefix}${xValue}-${yValue}`;
  }

  it('generates ID without group', () => {
    expect(generateDatapointId(undefined, '2024-01-15', 100)).toBe('2024-01-15-100');
    expect(generateDatapointId(undefined, 10, 20)).toBe('10-20');
  });

  it('generates ID with group', () => {
    expect(generateDatapointId('A', '2024-01-15', 100)).toBe('A-2024-01-15-100');
    expect(generateDatapointId('gpt-4o', 'Day 1', 50)).toBe('gpt-4o-Day 1-50');
  });

  it('handles special characters in values', () => {
    expect(generateDatapointId('Group A', '2024-01-15', 99.99)).toBe('Group A-2024-01-15-99.99');
  });

  it('generates consistent IDs for same inputs', () => {
    const id1 = generateDatapointId('A', 10, 20);
    const id2 = generateDatapointId('A', 10, 20);
    expect(id1).toBe(id2);
  });

  it('generates different IDs for different groups', () => {
    const id1 = generateDatapointId('A', 10, 20);
    const id2 = generateDatapointId('B', 10, 20);
    expect(id1).not.toBe(id2);
  });
});

// =============================================================================
// Highlight Transition Timing
// =============================================================================

describe('highlight transition behavior', () => {
  /**
   * Simulates D3 transition behavior
   */
  interface TransitionState {
    opacity: number;
    transitionDuration: number;
    interrupted: boolean;
  }

  function createTransitionSimulator() {
    let state: TransitionState = {
      opacity: 1,
      transitionDuration: 0,
      interrupted: false,
    };

    return {
      get state() {
        return { ...state };
      },
      startTransition(targetOpacity: number, duration: number) {
        state = {
          opacity: targetOpacity,
          transitionDuration: duration,
          interrupted: false,
        };
      },
      interrupt() {
        state.interrupted = true;
      },
    };
  }

  it('interrupts previous transition before starting new one', () => {
    const sim = createTransitionSimulator();

    // Start first transition
    sim.startTransition(0.5, 200);
    expect(sim.state.opacity).toBe(0.5);
    expect(sim.state.interrupted).toBe(false);

    // Interrupt and start new transition
    sim.interrupt();
    expect(sim.state.interrupted).toBe(true);

    sim.startTransition(1, 200);
    expect(sim.state.opacity).toBe(1);
    expect(sim.state.interrupted).toBe(false);
  });

  it('uses consistent transition duration', () => {
    const HIGHLIGHT_TRANSITION_MS = 200;
    const sim = createTransitionSimulator();

    sim.startTransition(0, HIGHLIGHT_TRANSITION_MS);
    expect(sim.state.transitionDuration).toBe(200);

    sim.startTransition(1, HIGHLIGHT_TRANSITION_MS);
    expect(sim.state.transitionDuration).toBe(200);
  });
});
