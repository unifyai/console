'use server';

import { ResponseProps } from '@/types/common';
import { UserDesktop } from '@/types/assistants/assistant';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import { getAdaptersPrefix } from '@/utils/assistants/api-utils';
import { resolveOwnerApiKeyForAssistant } from '@/lib/assistants/owner';

const LIVEVIEW_HEALTH_CHECK_TIMEOUT_MS = 5000;

async function isLiveviewReachable(liveviewUrl: string): Promise<boolean> {
  try {
    const urlObj = new URL(liveviewUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}/`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVEVIEW_HEALTH_CHECK_TIMEOUT_MS);
    try {
      const resp = await fetch(baseUrl, {
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
      const sharedUnifyKey = process.env.SHARED_UNIFY_KEY;
      if (!sharedUnifyKey) {
        console.error('[getLiveviewUrl] Server configuration error: SHARED_UNIFY_KEY is not set.');
        return { detail: 'Server configuration error: Shared key not found.' };
      }

      const nextAuthUrl = process.env.NEXTAUTH_URL;
      if (!nextAuthUrl) {
        console.error('[getLiveviewUrl] Server configuration error: NEXTAUTH_URL is not set.');
        return { detail: 'Server configuration error: Application URL not found.' };
      }

      const filterExpr = `user_id == '${ownerId}' and assistant_id == '${assistantId}'`;

      const url = new URL(`${nextAuthUrl}/api/logs`);
      url.searchParams.append('projectName', 'AssistantJobs');
      url.searchParams.append('context', 'startup_events');
      url.searchParams.append('filterExpr', filterExpr);

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
    message: string,
    deployEnv?: string | null
  ): Promise<ResponseProps> => {
    'use server';

    const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
    if (!ADMIN_KEY) {
      console.error(
        '[sendSystemEvent] Server configuration error: ORCHESTRA_ADMIN_KEY is not set.'
      );
      return { detail: 'Server configuration error.' };
    }

    const orchestraUrl = process.env.ORCHESTRA_URL || '';
    const isStaging = orchestraUrl.includes('staging') || orchestraUrl.includes('localhost') || orchestraUrl.includes('127.0.0.1');

    const prefix = getAdaptersPrefix(deployEnv, isStaging);
    const webhookUrl = `https://unity-adapters-${prefix}ky4ja5fxna-uc.a.run.app/unity/system-event`;

    // API expects snake_case - convert camelCase to snake_case
    const payload = camelToSnakeObject({
      assistantId: parseInt(assistantId),
      eventType: eventType,
      message: message,
    });

    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error(`[sendSystemEvent] Webhook error (${webhookResponse.status}): ${errorText}`);
        return { detail: `Failed to send system event: ${errorText}` };
      }

      return { info: 'System event sent successfully.' };
    } catch (error: any) {
      console.error('[sendSystemEvent] Error calling webhook:', error.message);
      return { detail: 'Failed to connect to system event service.' };
    }
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
