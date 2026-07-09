import { requireUserApiKey } from '@/lib/server-action-session';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';
import type { Assistant, DesktopMode } from '@/types/assistants/assistant';
import type { ResponseProps } from '@/types/common';

export interface ManagedDesktopStatus {
  desktopMode: DesktopMode | null;
  managedDesktopStatus: 'active' | 'grace_period' | 'disabled' | null;
  monthlyCost: number | null;
  managedDesktopEnabledAt?: string | null;
  managedDesktopGracePeriodStartedAt?: string | null;
}

export async function getManagedDesktopStatus(
  assistantId: number | string
): Promise<ResponseProps & { info?: ManagedDesktopStatus }> {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${getInternalApiBaseUrl()}/api/assistant/${assistantId}/managed-desktop`,
    { headers: { apiKey } }
  );
  const data = await response.json();
  if (!response.ok) {
    return { detail: data.detail ?? 'Failed to load Computer Use status' };
  }
  return { info: data.info };
}

export async function enableManagedDesktop(
  assistantId: number | string,
  desktopMode: DesktopMode
): Promise<ResponseProps & { assistant?: Assistant }> {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${getInternalApiBaseUrl()}/api/assistant/${assistantId}/managed-desktop`,
    {
      method: 'POST',
      headers: { apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ desktopMode }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    return { detail: data.detail ?? 'Failed to enable Computer Use' };
  }
  return { assistant: data.info };
}

export async function disableManagedDesktop(
  assistantId: number | string
): Promise<ResponseProps & { assistant?: Assistant }> {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${getInternalApiBaseUrl()}/api/assistant/${assistantId}/managed-desktop`,
    { method: 'DELETE', headers: { apiKey } }
  );
  const data = await response.json();
  if (!response.ok) {
    return { detail: data.detail ?? 'Failed to disable Computer Use' };
  }
  return { assistant: data.info };
}
