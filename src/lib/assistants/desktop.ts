'use server';

import { ResponseProps } from '@/types/common';
import { UserDesktop } from '@/types/assistants/assistant';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';
import { resolveOwnerApiKeyForAssistant } from '@/lib/assistants/owner';
import { isSelfHost } from '@/lib/environment/environment';
import { dispatchUnitySystemEvent } from '@/lib/assistants/system-event';

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

export const getLiveviewUrl = async () => {
  return async (
    assistantId: string,
    ownerId: string,
    organizationId: number | null
  ): Promise<{ liveviewUrl?: string } | ResponseProps> => {
    'use server';

    try {
      if (isSelfHost()) {
        const selfHostLiveview = await resolveSelfHostLiveviewUrl(ownerId, organizationId);
        if (selfHostLiveview) {
          return selfHostLiveview;
        }
      }

      const { resolveOrchestraApiKeyForServerOps } =
        await import('@/lib/auth/orchestra-server-key');
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
  };
};

export const buildLiveviewUrl = async () => {
  return async (
    rawUrl: string,
    ownerId: string,
    organizationId: number | null
  ): Promise<{ liveviewUrl: string }> => {
    'use server';
    const ownerKey = await resolveOwnerApiKeyForAssistant(ownerId, organizationId);
    const urlObj = new URL(rawUrl);
    urlObj.searchParams.set('password', ownerKey);
    return { liveviewUrl: urlObj.toString() };
  };
};

export const checkLiveviewHealth = async () => {
  return async (liveviewUrl: string): Promise<boolean> => {
    'use server';
    return isLiveviewReachable(liveviewUrl);
  };
};

export type SystemEventType =
  | 'assistant_screen_share_started'
  | 'assistant_screen_share_stopped'
  | 'user_screen_share_started'
  | 'user_screen_share_stopped'
  | 'user_remote_control_started'
  | 'user_remote_control_stopped'
  | 'user_webcam_started'
  | 'user_webcam_stopped';

export const sendSystemEvent = async () => {
  return async (
    assistantId: string,
    eventType: SystemEventType,
    message: string
  ): Promise<ResponseProps> => {
    'use server';

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
  };
};

export const getDesktopApiKey = async (apiKey: string) => {
  return async (): Promise<string> => {
    'use server';
    return apiKey;
  };
};

export const listUserDesktops = async (apiKey: string) => {
  return async (): Promise<UserDesktop[] | ResponseProps> => {
    'use server';

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
  };
};

export const linkDesktop = async (apiKey: string) => {
  return async (
    assistantId: string,
    desktopId: number,
    filesysSync: boolean = false
  ): Promise<ResponseProps> => {
    'use server';

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
  };
};

export const unlinkDesktop = async (apiKey: string) => {
  return async (assistantId: string): Promise<ResponseProps> => {
    'use server';

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
  };
};
