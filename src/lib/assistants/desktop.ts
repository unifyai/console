'use server';

import { ResponseProps } from '@/types/common';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { camelToSnakeObject } from '@/utils/casing';

const MAX_LIVEVIEW_URL_RETRIES = 15;
const LIVEVIEW_URL_RETRY_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getLiveviewUrl = async (userId: string, userApiKey: string) => {
  return async (assistantId: string): Promise<{ liveviewUrl?: string } | ResponseProps> => {
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

      const filterExpr = `user_id == '${userId}' and assistant_id == '${assistantId}' and running == 'true'`;

      const url = new URL(`${nextAuthUrl}/api/logs`);
      url.searchParams.append('projectName', 'AssistantJobs');
      url.searchParams.append('context', 'startup_events');
      url.searchParams.append('filterExpr', filterExpr);

      for (let attempt = 1; attempt <= MAX_LIVEVIEW_URL_RETRIES; attempt++) {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            apiKey: sharedUnifyKey, // Use the shared key for the internal proxy request
          },
          cache: 'no-store',
        });

        if (response.status === 404) {
          if (attempt === MAX_LIVEVIEW_URL_RETRIES) {
            console.warn(
              `[getLiveviewUrl] Max retries reached. No active session found for assistant ${assistantId} (404 Not Found).`
            );
            return {
              detail: 'No active session found for this assistant. Please try again in a moment.',
            };
          }
          await sleep(LIVEVIEW_URL_RETRY_DELAY_MS);
          continue;
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
          return { detail: errorMessage }; // Break on definitive errors
        }

        const logsResponse = data as LogsResponseProps;
        const latestLog = (logsResponse.logs as LogProps[])?.[0];

        // Note: The orchestra client transforms snake_case to camelCase, so liveview_url becomes liveviewUrl
        // Also check for snake_case in case the transformation didn't happen
        const liveviewUrlValue =
          latestLog?.entries?.liveviewUrl || latestLog?.entries?.liveview_url;

        if (latestLog && latestLog.entries && typeof liveviewUrlValue === 'string') {
          let liveviewUrl = liveviewUrlValue;

          const urlObj = new URL(liveviewUrl);
          urlObj.searchParams.set('password', userApiKey); // Use the user's key for the VNC password

          const finalUrl = urlObj.toString();

          return { liveviewUrl: finalUrl };
        }

        // If we got a 200 OK but the log wasn't there/complete, wait and retry.
        if (attempt < MAX_LIVEVIEW_URL_RETRIES) {
          await sleep(LIVEVIEW_URL_RETRY_DELAY_MS);
        }
      }

      console.warn(
        `[getLiveviewUrl] No logs with a valid 'liveviewUrl' found for assistant ${assistantId} after ${MAX_LIVEVIEW_URL_RETRIES} attempts. The assistant might still be starting up.`
      );
      return {
        detail:
          'Could not find an active remote control session. The assistant might still be starting up.',
      };
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

export const sendSystemEvent = async () => {
  return async (
    assistantId: string,
    eventType: 'pause_actor' | 'resume_actor',
    message: string
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
    const isStaging = orchestraUrl.includes('staging');

    const webhookUrl = `https://unity-adapters-${isStaging ? 'staging-' : ''}ky4ja5fxna-uc.a.run.app/unity/system-event`;

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
