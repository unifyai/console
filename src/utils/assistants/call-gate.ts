/**
 * Whether the call button is available, and why not when it isn't.
 *
 * Every call surface — human DM, team room, group room — shares one call engine,
 * so they all have to answer the same question about it. They were each
 * answering it with their own hand-written condition list and their own tooltip
 * ladder, which drifted: the room surfaces disabled the button while the engine
 * was mid-connect but had no tooltip branch for that case, so the single most
 * likely reason to be disabled rendered as a generic "not available" that
 * explained nothing. Deriving both the flag and the reason from one place makes
 * that kind of gap impossible rather than merely unlikely.
 */

/** The call the engine is currently on, as far as gating cares. */
export interface ActiveCallScope {
  teamId?: number | null;
  groupId?: number | null;
}

export interface CallGateInputs {
  /** Deployment-level feature availability (LiveKit + TTS + STT). */
  voiceCallsEnabled: boolean;
  /** An assistant 1:1 call holds the engine; a room call cannot share it. */
  hasActiveAssistantCall: boolean;
  /** The engine is dialling or ringing — briefly true, and latches on failure. */
  isConnecting: boolean;
  isConnected: boolean;
  activeCall: ActiveCallScope | null;
}

export interface CallGate {
  disabled: boolean;
  /** Always populated: a disabled control with no explanation is a dead end. */
  tooltip: string;
}

/** What the user is trying to call, which only changes the wording. */
export type CallTarget =
  | { kind: 'human' }
  | { kind: 'team'; teamId: number }
  | { kind: 'group'; groupId: number };

function targetNoun(target: CallTarget): string {
  return target.kind === 'human' ? 'teammate' : `${target.kind} call`;
}

/** True when the engine's current call *is* the one this button would start. */
function alreadyInThisCall(target: CallTarget, activeCall: ActiveCallScope | null): boolean {
  if (!activeCall) return false;
  if (target.kind === 'team') return activeCall.teamId === target.teamId;
  if (target.kind === 'group') return activeCall.groupId === target.groupId;
  // A human DM has no room id to compare, so any live call is "another call".
  return false;
}

export function resolveCallGate(target: CallTarget, inputs: CallGateInputs): CallGate {
  const { voiceCallsEnabled, hasActiveAssistantCall, isConnecting, isConnected, activeCall } =
    inputs;

  if (!voiceCallsEnabled) {
    return { disabled: true, tooltip: 'Voice calls are not configured' };
  }
  if (hasActiveAssistantCall) {
    const suffix =
      target.kind === 'human'
        ? 'before calling a teammate'
        : `before starting a ${target.kind} call`;
    return { disabled: true, tooltip: `End the assistant call ${suffix}` };
  }
  // Ordered above the connected checks: a stuck connect is the case that used
  // to fall through every tooltip branch and leave the button unexplained.
  if (isConnecting) {
    return { disabled: true, tooltip: 'Connecting…' };
  }
  if (isConnected && alreadyInThisCall(target, activeCall)) {
    return { disabled: true, tooltip: 'Already in this call' };
  }
  if (isConnected) {
    return { disabled: true, tooltip: 'Already in a call' };
  }
  return {
    disabled: false,
    tooltip: target.kind === 'human' ? 'Start voice call' : `Start ${targetNoun(target)}`,
  };
}
