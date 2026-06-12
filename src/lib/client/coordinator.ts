/**
 * Client-side API functions for Coordinator endpoints.
 */

import { ResponseProps } from '@/types/common';

export interface CoordinatorTranscriptSeedResult {
  logEventId: number;
}

export async function seedCoordinatorOpener(
  coordinatorId: string | number,
  content: string
): Promise<CoordinatorTranscriptSeedResult | ResponseProps> {
  try {
    const res = await fetch('/api/coordinator-transcript-seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinatorId: String(coordinatorId), content }),
    });
    const contentType = res.headers.get('content-type');
    const data = contentType?.includes('application/json') ? await res.json() : {};

    if (!res.ok) {
      return {
        detail:
          data?.detail || data?.error || `Failed to seed Coordinator opener: ${res.statusText}`,
        status: res.status,
      };
    }

    return data as CoordinatorTranscriptSeedResult;
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Failed to seed Coordinator opener',
    };
  }
}

export type OnboardingSessionMedium = 'chat' | 'call';

export interface OnboardingSessionStartedResult {
  coordinatorId: string;
  /**
   * Whether Orchestra actually forwarded the event to Unity.
   *
   * ``false`` when the Coordinator is no longer in onboarding mode
   * (e.g. the user already skipped onboarding in another tab) — the
   * call is silently dropped server-side and the client doesn't
   * need to do anything special; the chat history will load
   * whatever messages already exist.
   */
  emitted: boolean;
}

/**
 * Fire the picker-resolution event so the Coordinator opens the
 * onboarding session with the right kind of message (intro on a
 * fresh transcript, recap on a resumed one). Orchestra derives the
 * completed-step snapshot server-side at emission time, so only the
 * medium travels. Best-effort: callers should NOT block UI on the
 * response — the event drives a background LLM run on the Unity
 * side whose output arrives via the normal chat-streaming channel.
 */
export async function notifyOnboardingSessionStarted(
  coordinatorId: string | number,
  medium: OnboardingSessionMedium
): Promise<OnboardingSessionStartedResult | ResponseProps> {
  try {
    const res = await fetch('/api/coordinator-onboarding-session-started', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinatorId: String(coordinatorId),
        medium,
      }),
    });
    const contentType = res.headers.get('content-type');
    const data = contentType?.includes('application/json') ? await res.json() : {};

    if (!res.ok) {
      return {
        detail:
          data?.detail ||
          data?.error ||
          `Failed to notify onboarding session start: ${res.statusText}`,
        status: res.status,
      };
    }

    return data as OnboardingSessionStartedResult;
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Failed to notify onboarding session start',
    };
  }
}
