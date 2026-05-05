/**
 * useAssistantOnboardingSummaries — derives onboarding completion
 * summaries for many assistants at once.
 *
 * Consumed by the assistant list to badge rows that still have setup
 * work outstanding (a small "needs attention" dot). The
 * single-assistant hook (`useAssistantOnboardingState`) already does
 * this for the currently-profiled assistant, but rendering its full
 * groups for every list row would be wasteful — this hook computes
 * just the counts using the same `summarizeOnboarding` helper the
 * panel uses internally, so the badge can never disagree with the
 * panel.
 *
 * Reactive freshness:
 *   - Re-reads on `storage` events so resolving a step in the panel
 *     immediately clears the dot from the list (the panel writes to
 *     localStorage; storage events fire across same-document tabs in
 *     modern browsers via our internal write path because we use a
 *     small re-poll bump on every assistantIds change too).
 *   - Re-derives whenever any of the per-assistant context inputs
 *     change (new chat message, new call, etc.).
 */

'use client';

import * as React from 'react';
import type { Assistant } from '@/types/assistants/assistant';
import {
  ONBOARDING_STATE_CHANGE_EVENT,
  type OnboardingDerivationContext,
  type OnboardingPersistedState,
  type OnboardingSummary,
  readOnboardingState,
  summarizeOnboarding,
} from './useAssistantOnboardingState';

export interface AssistantOnboardingSummariesInput {
  /** Assistants to summarize. Non-owned ones are skipped (returned `undefined`). */
  assistants: Assistant[];
  /** Strict-creator id used to gate the badge — non-owners don't see it. */
  currentUserId: string | null;
  /** Logged-in user has a phone on profile (gates the phoneOnProfile step). */
  hasUserPhoneNumber: boolean;
  /** Per-assistant chat-derived context. Missing entries default to "no chat history". */
  perAssistantChat?: Record<string, { hasUserMessage: boolean; latestUserMessageAt: Date | null }>;
  /** Per-assistant call-derived context. Missing entries default to "no call history". */
  perAssistantCalls?: Record<string, { hasHistoricalCall: boolean }>;
}

export type AssistantOnboardingSummaryMap = Record<string, OnboardingSummary | undefined>;

export function useAssistantOnboardingSummaries(
  input: AssistantOnboardingSummariesInput
): AssistantOnboardingSummaryMap {
  const { assistants, currentUserId, hasUserPhoneNumber, perAssistantChat, perAssistantCalls } =
    input;

  // Bumped to force a re-read of localStorage when an external write
  // happens (other tab, panel resolves a step, etc.).
  const [storageBump, setStorageBump] = React.useState(0);

  // Respect the global "onboarding off" kill switch — if the panel
  // wouldn't render the roadmap, the list shouldn't dot-flag the
  // assistant either. Used by other E2E suites to silence onboarding
  // discovery surfaces during unrelated tests.
  const [globalDisabled, setGlobalDisabled] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setGlobalDisabled(
        window.localStorage.getItem('console:assistants:onboarding:disabled') === 'true'
      );
    } catch {
      /* ignore */
    }
  }, [storageBump]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      // Cheap filter — only re-derive for our own keys.
      if (!e.key || !e.key.startsWith('console:assistants:onboarding:state:')) return;
      setStorageBump((n) => n + 1);
    };
    // Same-document writes don't fire `storage` — listen to our own
    // custom event so resolving a step in the panel updates the dot
    // on the list immediately.
    const onLocalChange = () => setStorageBump((n) => n + 1);
    window.addEventListener('storage', onStorage);
    window.addEventListener(ONBOARDING_STATE_CHANGE_EVENT, onLocalChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ONBOARDING_STATE_CHANGE_EVENT, onLocalChange);
    };
  }, []);

  // Read persisted state for every owned assistant. We do this on
  // every input change rather than caching per-id because the cost is
  // O(assistants) localStorage reads — tiny in practice.
  const persistedById = React.useMemo<Record<string, OnboardingPersistedState>>(() => {
    if (typeof window === 'undefined') return {};
    const out: Record<string, OnboardingPersistedState> = {};
    for (const a of assistants) {
      if (currentUserId && a.userId !== currentUserId) continue;
      out[a.agentId] = readOnboardingState(a.agentId);
    }
    return out;
    // storageBump is a side-channel signal (not consumed in the body)
    // that forces a re-read whenever a same-doc or cross-tab write
    // bumps it. The exhaustive-deps lint can't see that intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistants, currentUserId, storageBump]);

  const summaries = React.useMemo<AssistantOnboardingSummaryMap>(() => {
    const out: AssistantOnboardingSummaryMap = {};
    if (globalDisabled) return out;
    for (const a of assistants) {
      if (currentUserId && a.userId !== currentUserId) {
        // Non-owners get no entry — caller treats undefined as
        // "don't badge".
        out[a.agentId] = undefined;
        continue;
      }
      const chat = perAssistantChat?.[a.agentId];
      const calls = perAssistantCalls?.[a.agentId];
      const ctx: OnboardingDerivationContext = {
        hasUserMessage: !!chat?.hasUserMessage,
        hasHistoricalCall: !!calls?.hasHistoricalCall,
        hasUserPhoneNumber,
        latestUserMessageAt: chat?.latestUserMessageAt ?? null,
      };
      out[a.agentId] = summarizeOnboarding(a, ctx, persistedById[a.agentId] ?? {});
    }
    return out;
  }, [
    assistants,
    currentUserId,
    hasUserPhoneNumber,
    perAssistantChat,
    perAssistantCalls,
    persistedById,
    globalDisabled,
  ]);

  // Same-document writes don't trigger `storage` events (those only
  // fire across tabs). Bump on assistant list changes too so list
  // navigation refreshes the summaries — cheap and pragmatic.
  React.useEffect(() => {
    setStorageBump((n) => n + 1);
  }, [assistants.length]);

  return summaries;
}
