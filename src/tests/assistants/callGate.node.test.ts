/**
 * Whether the call button is offered, and what it says when it isn't.
 *
 * The regression covered here: human DM, team and group surfaces each carried
 * their own hand-written disable condition and their own tooltip ladder, and
 * they had drifted apart. The room surfaces disabled the button while the shared
 * engine was mid-connect but had no tooltip branch for that state, so the most
 * likely reason to be disabled rendered as a generic "Voice calls are not
 * available" — a dead control that explained nothing and left a reload as the
 * only way forward.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveCallGate,
  type CallGateInputs,
  type CallTarget,
} from '@/utils/assistants/call-gate';

const READY: CallGateInputs = {
  voiceCallsEnabled: true,
  hasActiveAssistantCall: false,
  isConnecting: false,
  isConnected: false,
  activeCall: null,
};

const TARGETS: CallTarget[] = [
  { kind: 'human' },
  { kind: 'team', teamId: 56 },
  { kind: 'group', groupId: 9 },
];

const gate = (target: CallTarget, overrides: Partial<CallGateInputs> = {}) =>
  resolveCallGate(target, { ...READY, ...overrides });

describe('resolveCallGate', () => {
  it('offers the call when the engine is free', () => {
    for (const target of TARGETS) {
      expect(gate(target).disabled, target.kind).toBe(false);
    }
  });

  it('never leaves a disabled button without a reason', () => {
    const blockers: Partial<CallGateInputs>[] = [
      { voiceCallsEnabled: false },
      { hasActiveAssistantCall: true },
      { isConnecting: true },
      { isConnected: true },
    ];

    for (const target of TARGETS) {
      for (const blocker of blockers) {
        const result = gate(target, blocker);
        expect(result.disabled, `${target.kind} ${JSON.stringify(blocker)}`).toBe(true);
        expect(result.tooltip.trim(), `${target.kind} ${JSON.stringify(blocker)}`).not.toBe('');
      }
    }
  });

  it('explains a mid-connect engine instead of going quiet', () => {
    /** The exact gap: this state disabled rooms with no tooltip branch. */
    for (const target of TARGETS) {
      expect(gate(target, { isConnecting: true }).tooltip, target.kind).toBe('Connecting…');
    }
  });

  it('names the deployment gap when voice calls are not configured', () => {
    expect(gate({ kind: 'team', teamId: 56 }, { voiceCallsEnabled: false }).tooltip).toBe(
      'Voice calls are not configured'
    );
  });

  it('tells the user which call to end, in the target’s own words', () => {
    const blocked = { hasActiveAssistantCall: true };

    expect(gate({ kind: 'human' }, blocked).tooltip).toBe(
      'End the assistant call before calling a teammate'
    );
    expect(gate({ kind: 'team', teamId: 56 }, blocked).tooltip).toBe(
      'End the assistant call before starting a team call'
    );
    expect(gate({ kind: 'group', groupId: 9 }, blocked).tooltip).toBe(
      'End the assistant call before starting a group call'
    );
  });

  it('distinguishes being in this call from being in another', () => {
    const inTeam56 = { isConnected: true, activeCall: { teamId: 56, groupId: null } };

    expect(gate({ kind: 'team', teamId: 56 }, inTeam56).tooltip).toBe('Already in this call');
    expect(gate({ kind: 'team', teamId: 99 }, inTeam56).tooltip).toBe('Already in a call');
    expect(gate({ kind: 'group', groupId: 9 }, inTeam56).tooltip).toBe('Already in a call');
  });

  it('treats any live call as another call for a human DM', () => {
    /** A DM has no room id to compare against, so it can never be "this" call. */
    const result = gate(
      { kind: 'human' },
      { isConnected: true, activeCall: { teamId: null, groupId: null } }
    );

    expect(result.tooltip).toBe('Already in a call');
  });

  it('reports a mid-connect engine ahead of a stale connected flag', () => {
    /** Ordering matters: connecting is the transient, actionable state. */
    const result = gate(
      { kind: 'team', teamId: 56 },
      { isConnecting: true, isConnected: true, activeCall: { teamId: 56, groupId: null } }
    );

    expect(result.tooltip).toBe('Connecting…');
  });

  it('applies the same conditions to every surface', () => {
    /** The drift itself: one surface gating on state another ignored. */
    const blockers: Partial<CallGateInputs>[] = [
      { voiceCallsEnabled: false },
      { hasActiveAssistantCall: true },
      { isConnecting: true },
    ];

    for (const blocker of blockers) {
      const decisions = TARGETS.map((target) => gate(target, blocker).disabled);
      expect(new Set(decisions).size, JSON.stringify(blocker)).toBe(1);
    }
  });
});
