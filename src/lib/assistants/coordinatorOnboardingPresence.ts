import type { AssistantStatus } from '@/types/assistants/assistant';

export interface CoordinatorOnboardingPresenceContext {
  canonicalCoordinatorId: string | number | null;
  showCoordinatorOnboardingIntro: boolean;
  awaitingCoordinatorChatIntro: boolean;
}

export function shouldOptimisticallyShowCoordinatorOnline(
  assistantId: string,
  ctx: CoordinatorOnboardingPresenceContext
): boolean {
  if (ctx.canonicalCoordinatorId === null) return false;
  if (assistantId !== String(ctx.canonicalCoordinatorId)) return false;
  return ctx.showCoordinatorOnboardingIntro || ctx.awaitingCoordinatorChatIntro;
}

export function displayAssistantPresenceStatus(
  status: AssistantStatus | null | undefined,
  assistantId: string,
  ctx: CoordinatorOnboardingPresenceContext
): AssistantStatus | null {
  if (!shouldOptimisticallyShowCoordinatorOnline(assistantId, ctx)) {
    return status ?? null;
  }
  if (status?.running === true) {
    return status;
  }
  return { running: true, jobName: status?.jobName ?? null };
}

export function buildDisplayedAssistantStatuses(
  statuses: Map<string, AssistantStatus | null>,
  ctx: CoordinatorOnboardingPresenceContext
): Map<string, AssistantStatus | null> {
  if (!ctx.showCoordinatorOnboardingIntro && !ctx.awaitingCoordinatorChatIntro) {
    return statuses;
  }
  if (ctx.canonicalCoordinatorId === null) {
    return statuses;
  }

  const coordinatorId = String(ctx.canonicalCoordinatorId);
  const existing = statuses.get(coordinatorId);
  if (existing?.running === true) {
    return statuses;
  }

  const next = new Map(statuses);
  next.set(coordinatorId, displayAssistantPresenceStatus(existing, coordinatorId, ctx));
  return next;
}
