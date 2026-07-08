'use client';

import * as React from 'react';
import type { CoordinatorStatePatch } from '@/lib/assistants/coordinatorState';
import {
  APPS_CONNECT_RETURN_ARM_TIMEOUT_MS,
  schedulePostIntegrationConnectRefetches,
  shouldReturnToChatAfterAppsConnect,
  subscribeIntegrationConnectSettled,
} from '@/lib/assistants/coordinatorIntegrationConnect';
import { subscribeOAuthComplete } from '@/utils/assistants/oauth';

interface UseCoordinatorAppsConnectFlowOptions {
  coordinatorId: string | number | null | undefined;
  enabled: boolean;
  completedStepIds: readonly string[] | undefined;
  refreshAssistants: (background?: boolean) => void;
  refetchCoordinatorOnboardingState: () => Promise<void>;
  updateCoordinatorOnboardingState: (patch: CoordinatorStatePatch) => Promise<unknown>;
  onOpenChatSection: () => void;
}

export interface UseCoordinatorAppsConnectFlowResult {
  beginAppsConnectFlow: () => void;
  onConnectSettled: () => void;
  appsConnectSettling: boolean;
}

export function useCoordinatorAppsConnectFlow(
  options: UseCoordinatorAppsConnectFlowOptions
): UseCoordinatorAppsConnectFlowResult {
  const {
    coordinatorId,
    enabled,
    completedStepIds,
    refreshAssistants,
    refetchCoordinatorOnboardingState,
    updateCoordinatorOnboardingState,
    onOpenChatSection,
  } = options;

  const armedRef = React.useRef(false);
  const disarmTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchCleanupRef = React.useRef<(() => void) | null>(null);
  const [appsConnectSettling, setAppsConnectSettling] = React.useState(false);

  const disarm = React.useCallback(() => {
    armedRef.current = false;
    setAppsConnectSettling(false);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
    if (refetchCleanupRef.current) {
      refetchCleanupRef.current();
      refetchCleanupRef.current = null;
    }
  }, []);

  const beginAppsConnectFlow = React.useCallback(() => {
    if (!enabled || coordinatorId == null) return;
    armedRef.current = true;
    setAppsConnectSettling(false);
    if (disarmTimerRef.current) clearTimeout(disarmTimerRef.current);
    disarmTimerRef.current = setTimeout(() => {
      disarm();
    }, APPS_CONNECT_RETURN_ARM_TIMEOUT_MS);
    void updateCoordinatorOnboardingState({ onboardingStep: 'apps' });
  }, [coordinatorId, disarm, enabled, updateCoordinatorOnboardingState]);

  const onConnectSettled = React.useCallback(() => {
    if (!enabled || coordinatorId == null || !armedRef.current) return;
    setAppsConnectSettling(true);
    if (refetchCleanupRef.current) refetchCleanupRef.current();
    refetchCleanupRef.current = schedulePostIntegrationConnectRefetches({
      coordinatorId,
      refreshAssistants,
      refetchCoordinatorOnboardingState,
      includeParityWarning: true,
    });
  }, [coordinatorId, enabled, refreshAssistants, refetchCoordinatorOnboardingState]);

  React.useEffect(() => {
    if (!enabled || coordinatorId == null) return;
    if (
      !shouldReturnToChatAfterAppsConnect({
        armed: armedRef.current,
        completedStepIds: completedStepIds ?? [],
      })
    ) {
      return;
    }
    onOpenChatSection();
    disarm();
  }, [completedStepIds, coordinatorId, disarm, enabled, onOpenChatSection]);

  React.useEffect(() => {
    if (!enabled || coordinatorId == null) return;
    const unsubscribeOAuth = subscribeOAuthComplete((detail) => {
      if (detail.kind === 'workspace') return;
      onConnectSettled();
    });
    const unsubscribeSettled = subscribeIntegrationConnectSettled((detail) => {
      if (String(detail.assistantId) !== String(coordinatorId)) return;
      onConnectSettled();
    });
    return () => {
      unsubscribeOAuth();
      unsubscribeSettled();
      disarm();
    };
  }, [coordinatorId, disarm, enabled, onConnectSettled]);

  return {
    beginAppsConnectFlow,
    onConnectSettled,
    appsConnectSettling,
  };
}
