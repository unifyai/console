import {
  disconnectProviderIntegration,
  listProviderIntegrationConnections,
  requestUnityIntegrationToolsSync,
} from '@/lib/client/integrations';
import { fetchCoordinatorState } from '@/lib/assistants/coordinatorState';
import type { IntegrationConnection } from '@/types/integrations';

export const APPS_ONBOARDING_STEP_ID = 'apps';

export const INTEGRATION_CONNECT_SETTLED_EVENT = 'unify:integration-connect-settled';
export const INTEGRATION_DISCONNECT_SETTLED_EVENT = 'unify:integration-disconnect-settled';

export const APPS_CONNECT_RETURN_ARM_TIMEOUT_MS = 15 * 60 * 1000;

export const POST_INTEGRATION_CONNECT_REFETCH_DELAYS_MS = [1500, 3000] as const;

export type IntegrationConnectSettledDetail = {
  assistantId: string;
  authMode: 'oauth' | 'api_key';
};

export type IntegrationDisconnectSettledDetail = {
  assistantId: string;
  reason: 'apps_step_reset';
  connectionIds: readonly string[];
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

export function broadcastIntegrationDisconnectSettled(
  detail: IntegrationDisconnectSettledDetail
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<IntegrationDisconnectSettledDetail>(INTEGRATION_DISCONNECT_SETTLED_EVENT, {
      detail,
    })
  );
}

export function subscribeIntegrationDisconnectSettled(
  handler: (detail: IntegrationDisconnectSettledDetail) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<IntegrationDisconnectSettledDetail>).detail;
    if (!detail?.assistantId) return;
    handler(detail);
  };
  window.addEventListener(INTEGRATION_DISCONNECT_SETTLED_EVENT, listener);
  return () => window.removeEventListener(INTEGRATION_DISCONNECT_SETTLED_EVENT, listener);
}

export async function disconnectConnectedIntegrationsForAppsReset(args: {
  coordinatorId: string | number;
}): Promise<readonly string[]> {
  const connections = await listProviderIntegrationConnections({
    ownerScope: 'assistant',
    assistantId: args.coordinatorId,
  });
  const connected = connections.filter(
    (connection: IntegrationConnection) => connection.status === 'connected'
  );
  if (connected.length === 0) return [];

  const disconnectedIds: string[] = [];
  for (const connection of connected) {
    await disconnectProviderIntegration(connection.id);
    await requestUnityIntegrationToolsSync({
      assistantId: args.coordinatorId,
      connection,
      reason: 'disconnected',
    }).catch((error) => {
      console.warn(
        '[onboarding] Failed Unity integration tool sync after apps reset disconnect',
        error
      );
    });
    disconnectedIds.push(connection.id);
  }
  return disconnectedIds;
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
