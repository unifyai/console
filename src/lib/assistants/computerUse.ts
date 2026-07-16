'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';
import type { Assistant, DesktopMode } from '@/types/assistants/assistant';
import type { ResponseProps } from '@/types/common';

export interface ManagedDesktopIPRotation {
  id: string;
  state: string;
  error?: string | null;
  oldAddress?: string | null;
  candidateAddress?: string | null;
  rollbackExpiresAt?: string | null;
  requestedAt: string;
  completedAt?: string | null;
}

export interface ManagedDesktopNetworkIdentity {
  gcpAddressName?: string | null;
  address?: string | null;
  region?: string | null;
  hostname?: string | null;
  state: string;
  activeOperation?: string | null;
  rotation?: ManagedDesktopIPRotation | null;
}

export interface NetworkIdentity {
  address: string | null;
  region: string | null;
  hostname: string | null;
  state: string | null;
  activeOperation: string | null;
}

export interface NetworkIdentityRotation {
  address?: string | null;
  region?: string | null;
  hostname?: string | null;
  state?: string | null;
  activeOperation?: string | null;
}

export interface ManagedDesktopStatus {
  desktopMode: DesktopMode | null;
  managedDesktopStatus: 'active' | 'grace_period' | 'disabled' | null;
  monthlyCost: number | null;
  managedDesktopEnabledAt?: string | null;
  managedDesktopGracePeriodStartedAt?: string | null;
  networkIdentity?: NetworkIdentity | null;
}

function mapRotation(value: Record<string, unknown>): ManagedDesktopIPRotation {
  return {
    id: String(value.id),
    state: String(value.state),
    error: typeof value.error === 'string' ? value.error : null,
    oldAddress:
      typeof (value.oldAddress ?? value.old_address) === 'string'
        ? String(value.oldAddress ?? value.old_address)
        : null,
    candidateAddress:
      typeof (value.candidateAddress ?? value.candidate_address) === 'string'
        ? String(value.candidateAddress ?? value.candidate_address)
        : null,
    rollbackExpiresAt:
      typeof (value.rollbackExpiresAt ?? value.rollback_expires_at) === 'string'
        ? String(value.rollbackExpiresAt ?? value.rollback_expires_at)
        : null,
    requestedAt: String(value.requestedAt ?? value.requested_at),
    completedAt:
      typeof (value.completedAt ?? value.completed_at) === 'string'
        ? String(value.completedAt ?? value.completed_at)
        : null,
  };
}

function mapManagedDesktopStatus(value: Record<string, unknown>): ManagedDesktopStatus {
  const identity =
    (value.networkIdentity ?? value.network_identity) &&
    typeof (value.networkIdentity ?? value.network_identity) === 'object'
      ? ((value.networkIdentity ?? value.network_identity) as Record<string, unknown>)
      : null;
  return {
    desktopMode: (value.desktopMode ?? value.desktop_mode) as DesktopMode | null,
    managedDesktopStatus:
      ((value.managedDesktopStatus ??
        value.managed_desktop_status) as ManagedDesktopStatus['managedDesktopStatus']) ?? null,
    monthlyCost:
      typeof (value.monthlyCost ?? value.monthly_cost) === 'number'
        ? Number(value.monthlyCost ?? value.monthly_cost)
        : null,
    managedDesktopEnabledAt:
      typeof (value.managedDesktopEnabledAt ?? value.managed_desktop_enabled_at) === 'string'
        ? String(value.managedDesktopEnabledAt ?? value.managed_desktop_enabled_at)
        : null,
    managedDesktopGracePeriodStartedAt:
      typeof (
        value.managedDesktopGracePeriodStartedAt ?? value.managed_desktop_grace_period_started_at
      ) === 'string'
        ? String(
            value.managedDesktopGracePeriodStartedAt ??
              value.managed_desktop_grace_period_started_at
          )
        : null,
    networkIdentity: identity
      ? {
          address: typeof identity.address === 'string' ? identity.address : null,
          region: typeof identity.region === 'string' ? identity.region : null,
          hostname: typeof identity.hostname === 'string' ? identity.hostname : null,
          state: typeof identity.state === 'string' ? identity.state : null,
          activeOperation:
            typeof (identity.activeOperation ?? identity.active_operation) === 'string'
              ? String(identity.activeOperation ?? identity.active_operation)
              : null,
        }
      : null,
  };
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
  return { info: mapManagedDesktopStatus(data.info ?? {}) };
}

export async function rotateManagedDesktopNetworkIdentity(
  assistantId: number | string
): Promise<ResponseProps & { info?: NetworkIdentityRotation }> {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${getInternalApiBaseUrl()}/api/assistant/${assistantId}/managed-desktop/network-identity/rotate`,
    { method: 'POST', headers: { apiKey } }
  );
  const data = await response.json();
  if (!response.ok) {
    return { detail: data.detail ?? 'Failed to start IP rotation' };
  }
  const rotation = mapRotation(data.info ?? {});
  return {
    info: {
      address: rotation.candidateAddress,
      state: rotation.state,
      activeOperation: rotation.state === 'error' ? null : 'rotate',
    },
  };
}

export async function getManagedDesktopNetworkIdentityRotation(
  assistantId: number | string
): Promise<ResponseProps & { info?: NetworkIdentityRotation }> {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${getInternalApiBaseUrl()}/api/assistant/${assistantId}/managed-desktop/network-identity/rotation`,
    { headers: { apiKey } }
  );
  const data = await response.json();
  if (!response.ok) {
    return { detail: data.detail ?? 'Failed to load network identity rotation status' };
  }
  const rotation = mapRotation(data.info ?? {});
  return {
    info: {
      address: rotation.candidateAddress,
      state: rotation.state,
      activeOperation:
        rotation.state === 'error' || rotation.state === 'rollback_pending' ? null : 'rotate',
    },
  };
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
