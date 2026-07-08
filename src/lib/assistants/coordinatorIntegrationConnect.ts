import { listProviderIntegrationConnections } from '@/lib/client/integrations';
import { fetchCoordinatorState } from '@/lib/assistants/coordinatorState';

export const INTEGRATION_CONNECT_SETTLED_EVENT = 'unify:integration-connect-settled';

export const APPS_CONNECT_RETURN_ARM_TIMEOUT_MS = 15 * 60 * 1000;

export const POST_INTEGRATION_CONNECT_REFETCH_DELAYS_MS = [1500, 3000] as const;

export type IntegrationConnectSettledDetail = {
  assistantId: string;
  authMode: 'oauth' | 'api_key';
};

export function shouldReturnToChatAfterAppsConnect(args: {
  armed: boolean;
  completedStepIds: readonly string[];
}): boolean {
  return args.armed && args.completedStepIds.includes('apps');
}

export function broadcastIntegrationConnectSettled(detail: IntegrationConnectSettledDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<IntegrationConnectSettledDetail>(INTEGRATION_CONNECT_SETTLED_EVENT, {
      detail,
    })
  );
}

export function subscribeIntegrationConnectSettled(
  handler: (detail: IntegrationConnectSettledDetail) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<IntegrationConnectSettledDetail>).detail;
    if (!detail?.assistantId) return;
    handler(detail);
  };
  window.addEventListener(INTEGRATION_CONNECT_SETTLED_EVENT, listener);
  return () => window.removeEventListener(INTEGRATION_CONNECT_SETTLED_EVENT, listener);
}

export async function warnIfAppsDerivationMismatch(coordinatorId: string | number): Promise<void> {
  try {
    const [state, connections] = await Promise.all([
      fetchCoordinatorState(coordinatorId),
      listProviderIntegrationConnections({
        ownerScope: 'assistant',
        assistantId: coordinatorId,
      }),
    ]);
    const connected = connections.filter((connection) => connection.status === 'connected');
    if (connected.length > 0 && !state.completedStepIds.includes('apps')) {
      console.warn(
        '[onboarding] Connected integration exists but apps is not in completedStepIds',
        {
          coordinatorId: String(coordinatorId),
          connectionIds: connected.map((connection) => connection.id),
          completedStepIds: state.completedStepIds,
        }
      );
    }
  } catch (error) {
    console.warn('[onboarding] Failed apps derivation parity check', error);
  }
}

export function schedulePostIntegrationConnectRefetches(args: {
  coordinatorId: string | number | null;
  refreshAssistants: (background?: boolean) => void;
  refetchCoordinatorOnboardingState: () => Promise<void>;
  includeParityWarning?: boolean;
}): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const refetch = () => {
    args.refreshAssistants(false);
    void args.refetchCoordinatorOnboardingState();
  };
  refetch();
  for (const delayMs of POST_INTEGRATION_CONNECT_REFETCH_DELAYS_MS) {
    timers.push(
      setTimeout(() => {
        refetch();
        if (args.includeParityWarning && delayMs === 3000 && args.coordinatorId != null) {
          void warnIfAppsDerivationMismatch(args.coordinatorId);
        }
      }, delayMs)
    );
  }
  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}
