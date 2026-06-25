'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { ResponseProps } from '@/types/common';
import { UserDesktop } from '@/types/assistants/assistant';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';
import { resolveOwnerApiKeyForAssistant } from '@/lib/assistants/owner';
import { isSelfHost } from '@/lib/environment/environment';
import { dispatchUnitySystemEvent } from '@/lib/assistants/system-event';
import { extractTunnelId } from '@/utils/assistants/tunnel';

const LIVEVIEW_HEALTH_CHECK_TIMEOUT_MS = 5000;
const DEFAULT_SELF_HOST_DESKTOP_URL = 'http://127.0.0.1:8090';

function selfHostDesktopBrowserBase(): string {
  return (process.env.SELF_HOST_DESKTOP_URL?.trim() || DEFAULT_SELF_HOST_DESKTOP_URL).replace(
    /\/$/,
    ''
  );
}

function selfHostDesktopHealthBase(): string {
  const internal = process.env.SELF_HOST_DESKTOP_INTERNAL_URL?.trim();
  if (internal) {
    return internal.replace(/\/$/, '');
  }
  return selfHostDesktopBrowserBase();
}

async function resolveSelfHostLiveviewUrl(
  ownerId: string,
  organizationId: number | null
): Promise<{ liveviewUrl: string } | null> {
  const desktopBase = selfHostDesktopBrowserBase();
  const rawLiveviewUrl = `${desktopBase}/desktop/custom.html`;
  const ownerKey = await resolveOwnerApiKeyForAssistant(ownerId, organizationId);
  const urlObj = new URL(rawLiveviewUrl);
  urlObj.searchParams.set('password', ownerKey);
  const liveviewUrl = urlObj.toString();
  if (!(await isSelfHostDesktopHealthy())) {
    return null;
  }
  return { liveviewUrl };
}

async function isSelfHostDesktopHealthy(): Promise<boolean> {
  const healthBase = selfHostDesktopHealthBase();
  return isUrlReachable(`${healthBase}/desktop/vnc.html`);
}

async function isLiveviewReachable(liveviewUrl: string): Promise<boolean> {
  if (isSelfHost()) {
    return isSelfHostDesktopHealthy();
  }
  try {
    const urlObj = new URL(liveviewUrl);
    return isUrlReachable(`${urlObj.protocol}//${urlObj.host}/`);
  } catch {
    return false;
  }
}

async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVEVIEW_HEALTH_CHECK_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        // @ts-ignore — Node fetch supports this option in server actions
        rejectUnauthorized: false,
      });
      return resp.status < 500;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

export async function getLiveviewUrl(
  assistantId: string,
  ownerId: string,
  organizationId: number | null
): Promise<{ liveviewUrl?: string } | ResponseProps> {
  try {
    if (isSelfHost()) {
      const selfHostLiveview = await resolveSelfHostLiveviewUrl(ownerId, organizationId);
      if (selfHostLiveview) {
        return selfHostLiveview;
      }
    }

    const { resolveOrchestraApiKeyForServerOps } = await import('@/lib/auth/orchestra-server-key');
    const sharedUnifyKey = await resolveOrchestraApiKeyForServerOps();
    if (!sharedUnifyKey) {
      console.error('[getLiveviewUrl] Server configuration error: Orchestra API key is not set.');
      return { detail: 'Server configuration error: Shared key not found.' };
    }

    const internalApiBaseUrl = getInternalApiBaseUrl();

    const filterExpr = `user_id == '${ownerId}' and assistant_id == '${assistantId}'`;

    const url = new URL(`${internalApiBaseUrl}/api/logs`);
    url.searchParams.append('projectName', 'AssistantJobs');
    url.searchParams.append('context', 'startup_events');
    url.searchParams.append('filterExpr', filterExpr);
    url.searchParams.append('limit', '10');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        apiKey: sharedUnifyKey,
      },
      cache: 'no-store',
    });

    if (response.status === 404) {
      return { detail: 'No active session found for this assistant.' };
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data.detail ||
        `Failed to get session details: ${response.statusText} (Status: ${response.status})`;
      console.error(
        `[getLiveviewUrl] Error from logs API. Status: ${response.status}, Body:`,
        JSON.stringify(data, null, 2)
      );
      return { detail: errorMessage };
    }

    const logsResponse = data as LogsResponseProps;
    const latestLog = (logsResponse.logs as LogProps[])?.[0];

    const liveviewUrlValue = latestLog?.entries?.liveviewUrl || latestLog?.entries?.liveview_url;

    if (latestLog && latestLog.entries && typeof liveviewUrlValue === 'string') {
      const ownerKey = await resolveOwnerApiKeyForAssistant(ownerId, organizationId);
      const urlObj = new URL(liveviewUrlValue);
      urlObj.searchParams.set('password', ownerKey);
      return { liveviewUrl: urlObj.toString() };
    }

    if (isSelfHost()) {
      const selfHostLiveview = await resolveSelfHostLiveviewUrl(ownerId, organizationId);
      if (selfHostLiveview) {
        return selfHostLiveview;
      }
    }

    return { detail: 'Liveview URL not yet available.' };
  } catch (error) {
    console.error(
      `[getLiveviewUrl] An unexpected error occurred while fetching session URL for assistant ${assistantId}:`,
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown server error occurred while fetching session URL.';
    return { detail: errorMessage };
  }
}
export async function buildLiveviewUrl(
  rawUrl: string,
  ownerId: string,
  organizationId: number | null
): Promise<{ liveviewUrl: string }> {
  const ownerKey = await resolveOwnerApiKeyForAssistant(ownerId, organizationId);
  const urlObj = new URL(rawUrl);
  urlObj.searchParams.set('password', ownerKey);
  return { liveviewUrl: urlObj.toString() };
}
export async function checkLiveviewHealth(liveviewUrl: string): Promise<boolean> {
  return isLiveviewReachable(liveviewUrl);
}
export type SystemEventType =
  | 'assistant_screen_share_started'
  | 'assistant_screen_share_stopped'
  | 'user_screen_share_started'
  | 'user_screen_share_stopped'
  | 'user_remote_control_started'
  | 'user_remote_control_stopped'
  | 'user_webcam_started'
  | 'user_webcam_stopped';

export async function sendSystemEvent(
  assistantId: string,
  eventType: SystemEventType,
  message: string
): Promise<ResponseProps> {
  const result = await dispatchUnitySystemEvent({
    assistantId: parseInt(assistantId),
    eventType,
    message,
  });

  if (!result.ok) {
    console.error(`[sendSystemEvent] Webhook error (${result.status}): ${result.detail}`);
    return { detail: `Failed to send system event: ${result.detail}` };
  }
  return { info: 'System event sent successfully.' };
}
export async function getDesktopApiKey(): Promise<string> {
  const apiKey = await requireUserApiKey();
  return apiKey;
}
export async function listUserDesktops(): Promise<UserDesktop[] | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const orchestraUrl = process.env.ORCHESTRA_URL;
  if (!orchestraUrl) {
    return { detail: 'Server configuration error: ORCHESTRA_URL is not set.' };
  }

  try {
    const response = await fetch(`${orchestraUrl}/v0/desktop`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return (data as ResponseProps) || { detail: 'Failed to list desktops' };
    }

    const desktops = data?.info ?? data;
    return snakeToCamelObject(desktops) as UserDesktop[];
  } catch (e: unknown) {
    console.error('[listUserDesktops] Error:', e instanceof Error ? e.message : e);
    return { detail: 'Failed to connect to backend' };
  }
}
export async function linkDesktop(
  assistantId: string,
  desktopId: number,
  filesysSync: boolean = false
): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  const orchestraUrl = process.env.ORCHESTRA_URL;
  if (!orchestraUrl) {
    return { detail: 'Server configuration error: ORCHESTRA_URL is not set.' };
  }

  try {
    const response = await fetch(`${orchestraUrl}/v0/desktop/link`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        camelToSnakeObject({
          assistantId: parseInt(assistantId, 10),
          desktopId,
          filesysSync,
        })
      ),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return (data as ResponseProps) || { detail: 'Failed to link desktop' };
    }
    return { info: 'Desktop linked successfully' };
  } catch (e: unknown) {
    console.error('[linkDesktop] Error:', e instanceof Error ? e.message : e);
    return { detail: 'Failed to connect to backend' };
  }
}
export async function unlinkDesktop(assistantId: string): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  const orchestraUrl = process.env.ORCHESTRA_URL;
  if (!orchestraUrl) {
    return { detail: 'Server configuration error: ORCHESTRA_URL is not set.' };
  }

  try {
    const response = await fetch(`${orchestraUrl}/v0/desktop/link/${parseInt(assistantId, 10)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return (data as ResponseProps) || { detail: 'Failed to unlink desktop' };
    }
    return { info: 'Desktop unlinked' };
  } catch (e: unknown) {
    console.error('[unlinkDesktop] Error:', e instanceof Error ? e.message : e);
    return { detail: 'Failed to connect to backend' };
  }
}

export async function renameUserDesktop(
  desktopId: number,
  name: string
): Promise<UserDesktop | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const orchestraUrl = process.env.ORCHESTRA_URL;
  if (!orchestraUrl) {
    return { detail: 'Server configuration error: ORCHESTRA_URL is not set.' };
  }

  try {
    const response = await fetch(`${orchestraUrl}/v0/desktop/${desktopId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(camelToSnakeObject({ name })),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return (data as ResponseProps) || { detail: 'Failed to rename desktop' };
    }
    const desktop = data?.info ?? data;
    return snakeToCamelObject(desktop) as UserDesktop;
  } catch (e: unknown) {
    console.error('[renameUserDesktop] Error:', e instanceof Error ? e.message : e);
    return { detail: 'Failed to connect to backend' };
  }
}

/**
 * Best-effort teardown of the managed tunnel backing a desktop. Removes the
 * tunnel from the relay registry so the public URL stops resolving. Never
 * throws: an orphaned tunnel idles and expires on its own, so teardown failure
 * must not block desktop deletion.
 */
async function teardownDesktopTunnel(apiKey: string, url?: string): Promise<void> {
  const tunnelId = extractTunnelId(url);
  if (!tunnelId) return;

  const hasCommsUrl =
    !!process.env.COMMUNICATION_URL ||
    !!process.env.UNITY_COMMS_URL ||
    !!process.env.LOCAL_ADAPTERS_URL ||
    !!process.env.UNITY_ADAPTERS_URL;
  if (!hasCommsUrl) return;

  try {
    const { createCommunicationClient } = await import('@/lib/communication/client');
    const client = createCommunicationClient(apiKey);
    await client.delete(`/infra/tunnel/${tunnelId}`);
  } catch (e: unknown) {
    console.warn(
      `[deleteUserDesktop] Tunnel teardown for ${tunnelId} failed (continuing):`,
      e instanceof Error ? e.message : e
    );
  }
}

export async function deleteUserDesktop(desktopId: number, url?: string): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  const orchestraUrl = process.env.ORCHESTRA_URL;
  if (!orchestraUrl) {
    return { detail: 'Server configuration error: ORCHESTRA_URL is not set.' };
  }

  // Tear down the managed tunnel first (best-effort) so the user's desktop list
  // never lingers pointing at a dead tunnel. The Orchestra delete below is the
  // authoritative step whose result drives success/failure.
  await teardownDesktopTunnel(apiKey, url);

  try {
    const response = await fetch(`${orchestraUrl}/v0/desktop/${desktopId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return (data as ResponseProps) || { detail: 'Failed to delete desktop' };
    }
    return { info: 'Desktop deleted' };
  } catch (e: unknown) {
    console.error('[deleteUserDesktop] Error:', e instanceof Error ? e.message : e);
    return { detail: 'Failed to connect to backend' };
  }
}
