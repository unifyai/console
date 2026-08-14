'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { ResponseProps } from '@/types/common';
import { UserDesktop } from '@/types/assistants/assistant';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import { getAdaptersBaseUrl, getInternalApiBaseUrl } from '@/utils/assistants/api-utils';
import { resolveOwnerApiKeyForAssistant } from '@/lib/assistants/owner';
import { resolveDesktopViewerGrant } from '@/lib/assistants/desktopAccess';
import { isSelfHost } from '@/lib/environment/environment';
import { dispatchUnitySystemEvent } from '@/lib/assistants/system-event';
import { extractTunnelId } from '@/utils/assistants/tunnel';
import { getCurrentUser } from '@/lib/user/user';
import {
  type DesktopSessionScope,
  findScopedStartupLiveviewLog,
  liveviewHealthProbeUrl,
  readLogEntryField,
} from '@/lib/assistants/desktopSessionScope';

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
  const probeUrl = liveviewHealthProbeUrl(liveviewUrl);
  if (!probeUrl) {
    return false;
  }
  return isUrlReachable(probeUrl);
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
  organizationId: number | null,
  sessionScope?: DesktopSessionScope | null
): Promise<{ liveviewUrl?: string } | ResponseProps> {
  try {
    const grant = await resolveDesktopViewerGrant(assistantId, ownerId);
    if (!grant.allowed) {
      return { detail: grant.detail };
    }
    // Self-host publishes no per-session password, so this path can only
    // authenticate with the owner's own key -- owner-only, or it would hand that
    // key to every participant on the call.
    if (isSelfHost() && grant.isOwner) {
      const selfHostLiveview = await resolveSelfHostLiveviewUrl(ownerId, organizationId);
      if (selfHostLiveview) {
        return selfHostLiveview;
      }
    }

    const { resolveOrchestraApiKeyForServerOps } = await import('@/lib/auth/orchestra-server-key');
    const sharedUnifyKey = await resolveOrchestraApiKeyForServerOps();
    if (!sharedUnifyKey) {
      console.error('[getLiveviewUrl] Server configuration error: Orchestra API key is not set.');
      return { detail: 'Server configuration error: Orchestra admin key not found.' };
    }

    const internalApiBaseUrl = getInternalApiBaseUrl();

    const filter = `user_id == '${ownerId}' and assistant_id == '${assistantId}'`;

    const url = new URL(`${internalApiBaseUrl}/api/logs`);
    url.searchParams.append('projectName', 'AssistantJobs');
    url.searchParams.append('context', 'startup_events');
    url.searchParams.append('filter', filter);
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
    const scopedLog = findScopedStartupLiveviewLog(logsResponse.logs as LogProps[], sessionScope);
    const liveviewUrlValue = scopedLog?.entries?.liveviewUrl || scopedLog?.entries?.liveview_url;

    if (scopedLog && scopedLog.entries && typeof liveviewUrlValue === 'string') {
      const publishedPassword = readLogEntryField(
        scopedLog.entries,
        'liveview_password',
        'liveviewPassword'
      );
      // The published password is scoped to this desktop session. The fallback
      // is the owner's own Orchestra API key, so it may only ever go back to the
      // owner -- a participant with no published password is refused rather
      // than handed a credential that outlives the call.
      const hasPublishedPassword =
        typeof publishedPassword === 'string' && Boolean(publishedPassword.trim());
      if (!hasPublishedPassword && !grant.isOwner) {
        return {
          detail: 'This desktop session cannot be shared with other people on the call.',
        };
      }
      const password = hasPublishedPassword
        ? (publishedPassword as string)
        : await resolveOwnerApiKeyForAssistant(ownerId, organizationId);
      const urlObj = new URL(liveviewUrlValue);
      urlObj.searchParams.set('password', password);
      return { liveviewUrl: urlObj.toString() };
    }

    if (isSelfHost() && grant.isOwner) {
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
/**
 * Stamp the liveview password onto a URL the caller already holds (from an
 * ``assistant_desktop_ready`` event).
 *
 * ``rawUrl`` comes from the client, so the owner-key fallback is restricted to
 * the owner themselves: stamping that key onto an arbitrary caller-supplied URL
 * would hand the owner's Orchestra credential to whoever chose the URL. With a
 * password supplied there is no secret to lose -- the caller already had it.
 */
export async function buildLiveviewUrl(
  rawUrl: string,
  ownerId: string,
  organizationId: number | null,
  password?: string | null
): Promise<{ liveviewUrl: string }> {
  let resolvedPassword = password?.trim() || '';
  if (!resolvedPassword) {
    const caller = await getCurrentUser();
    if (caller?.id !== ownerId) {
      throw new Error('This desktop session cannot be opened without its session password.');
    }
    resolvedPassword = await resolveOwnerApiKeyForAssistant(ownerId, organizationId);
  }
  const urlObj = new URL(rawUrl);
  urlObj.searchParams.set('password', resolvedPassword);
  return { liveviewUrl: urlObj.toString() };
}
export async function checkLiveviewHealth(liveviewUrl: string): Promise<boolean> {
  return isLiveviewReachable(liveviewUrl);
}

/**
 * Best-effort: ask adapters to start (or resume) the assistant's runtime so its
 * desktop VM can come up. Mirrors Orchestra's internal ``wake_up_assistant``
 * call — a ``200`` only means the wakeup webhook was accepted; desktop
 * readiness still arrives asynchronously via ``assistant_desktop_ready`` or
 * ``getLiveviewUrl``.
 */
export async function wakeAssistantSession(assistantId: string): Promise<ResponseProps> {
  try {
    await requireUserApiKey();
    const parsedId = Number.parseInt(assistantId, 10);
    if (!Number.isFinite(parsedId)) {
      return { detail: 'Invalid assistant id.' };
    }

    const adminKey = process.env.ORCHESTRA_ADMIN_KEY;
    if (!adminKey) {
      return { detail: 'Server configuration error: admin key not set.' };
    }

    if (!process.env.LOCAL_ADAPTERS_URL && !process.env.UNITY_ADAPTERS_URL && isSelfHost()) {
      return { info: 'Self-host runtime start skipped (no adapters configured).' };
    }

    const wakeUpUrl = `${getAdaptersBaseUrl({
      localAdaptersUrl: process.env.LOCAL_ADAPTERS_URL,
    })}/assistant/wakeup`;
    const wakeUpParams = new URLSearchParams();
    wakeUpParams.set('assistant_id', String(parsedId));
    const response = await fetch(wakeUpUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminKey}` },
      body: wakeUpParams,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => 'Failed to start assistant session.');
      return { detail };
    }
    return { info: 'Assistant session start requested.' };
  } catch (e: unknown) {
    console.error(
      `[wakeAssistantSession] Failed to wake assistant ${assistantId}:`,
      e instanceof Error ? e.message : e
    );
    return {
      detail: e instanceof Error ? e.message : 'Failed to start assistant session.',
    };
  }
}
export type SystemEventType =
  | 'assistant_screen_share_started'
  | 'assistant_screen_share_stopped'
  | 'user_screen_share_started'
  | 'user_screen_share_stopped'
  | 'user_remote_control_started'
  | 'user_remote_control_stopped'
  | 'user_webcam_started'
  | 'user_webcam_stopped'
  | 'user_filesys_access_started'
  | 'user_filesys_access_stopped';

/**
 * Best-effort: tell a running assistant session that the user just changed
 * filesystem-access consent for their linked desktop, so in-flight reads/
 * writebacks stop (or resume) immediately rather than on the next session
 * load. The Orchestra mutation is authoritative; this never blocks it, so a
 * dispatch failure is logged and swallowed. The event targets the desktop
 * owner's link via the current user's id (== Orchestra's owner_user_id).
 */
async function dispatchFilesysAccessEvent(assistantId: string, enabled: boolean): Promise<void> {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;
    if (!userId) return;
    await dispatchUnitySystemEvent({
      assistantId: parseInt(assistantId, 10),
      eventType: enabled ? 'user_filesys_access_started' : 'user_filesys_access_stopped',
      message: enabled ? 'User enabled filesystem access.' : 'User disabled filesystem access.',
      extraEventFields: { userId },
    });
  } catch (e: unknown) {
    console.warn(
      '[desktop] filesystem-access event dispatch failed (continuing):',
      e instanceof Error ? e.message : e
    );
  }
}

/**
 * Best-effort: ask adapters to publish a full assistant-update refresh so a
 * running session absorbs Orchestra's current `user_desktops` map (os,
 * filesys_sync, SFTP tunnel coordinates) for this link without waiting for
 * the assistant to restart. Mirrors `wakeAssistantSession`'s adapters
 * webhook call. The Orchestra desktop mutation above is authoritative, so a
 * dispatch failure here is logged and swallowed, matching
 * `dispatchFilesysAccessEvent`'s posture.
 */
async function dispatchAssistantUpdateRefresh(assistantId: string): Promise<void> {
  try {
    const adminKey = process.env.ORCHESTRA_ADMIN_KEY;
    if (!adminKey) return;
    const parsedId = Number.parseInt(assistantId, 10);
    if (!Number.isFinite(parsedId)) return;

    if (!process.env.LOCAL_ADAPTERS_URL && !process.env.UNITY_ADAPTERS_URL && isSelfHost()) {
      return;
    }

    const updateUrl = `${getAdaptersBaseUrl({
      localAdaptersUrl: process.env.LOCAL_ADAPTERS_URL,
    })}/assistant/update`;
    const params = new URLSearchParams();
    params.set('assistant_id', String(parsedId));
    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminKey}` },
      body: params,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => 'Failed to refresh assistant session.');
      console.warn(`[desktop] assistant-update refresh failed (${response.status}): ${detail}`);
    }
  } catch (e: unknown) {
    console.warn(
      '[desktop] assistant-update refresh dispatch failed (continuing):',
      e instanceof Error ? e.message : e
    );
  }
}

export async function sendSystemEvent(
  assistantId: string,
  eventType: SystemEventType,
  message: string,
  extraEventFields?: Record<string, unknown>
): Promise<ResponseProps> {
  const result = await dispatchUnitySystemEvent({
    assistantId: parseInt(assistantId),
    eventType,
    message,
    extraEventFields,
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
    await dispatchFilesysAccessEvent(assistantId, filesysSync);
    await dispatchAssistantUpdateRefresh(assistantId);
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
    await dispatchFilesysAccessEvent(assistantId, false);
    await dispatchAssistantUpdateRefresh(assistantId);
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
 * Best-effort delete of a single tunnel from the relay registry. Never throws:
 * an orphaned tunnel idles and expires on its own, so teardown failure must not
 * block desktop deletion.
 */
async function deleteTunnelById(apiKey: string, tunnelId: string): Promise<void> {
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

/**
 * Best-effort teardown of the managed tunnels backing a desktop. A device has
 * two independent relay tunnels: the HTTP tunnel encoded in its registered
 * `url`, and a separate raw-TCP SFTP tunnel identified by `sftpTunnelId`. Both
 * are removed so neither lingers in the relay registry after deletion.
 */
async function teardownDesktopTunnel(
  apiKey: string,
  url?: string,
  sftpTunnelId?: string | null
): Promise<void> {
  const httpTunnelId = extractTunnelId(url);
  if (!httpTunnelId && !sftpTunnelId) return;

  const hasCommsUrl =
    !!process.env.COMMUNICATION_URL ||
    !!process.env.UNITY_COMMS_URL ||
    !!process.env.LOCAL_ADAPTERS_URL ||
    !!process.env.UNITY_ADAPTERS_URL;
  if (!hasCommsUrl) return;

  if (httpTunnelId) await deleteTunnelById(apiKey, httpTunnelId);
  if (sftpTunnelId) await deleteTunnelById(apiKey, sftpTunnelId);
}

export async function deleteUserDesktop(
  desktopId: number,
  url?: string,
  linkedAssistantIds: number[] = [],
  sftpTunnelId?: string | null
): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  const orchestraUrl = process.env.ORCHESTRA_URL;
  if (!orchestraUrl) {
    return { detail: 'Server configuration error: ORCHESTRA_URL is not set.' };
  }

  // Tear down the managed tunnels first (best-effort) so the user's desktop list
  // never lingers pointing at dead tunnels. The Orchestra delete below is the
  // authoritative step whose result drives success/failure.
  await teardownDesktopTunnel(apiKey, url, sftpTunnelId);

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
    // Deleting the desktop tears down every assistant's link + key server-side;
    // tell each linked assistant's running session so in-flight filesystem
    // access stops immediately rather than on the next session load.
    for (const aid of linkedAssistantIds) {
      await dispatchFilesysAccessEvent(String(aid), false);
      await dispatchAssistantUpdateRefresh(String(aid));
    }
    return { info: 'Desktop deleted' };
  } catch (e: unknown) {
    console.error('[deleteUserDesktop] Error:', e instanceof Error ? e.message : e);
    return { detail: 'Failed to connect to backend' };
  }
}
