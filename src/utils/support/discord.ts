/**
 * Discord webhook utilities for support tickets.
 *
 * Handles formatting and delivery of support ticket embeds via Discord
 * incoming webhooks.  In local development (no webhook URL configured),
 * messages are logged to the console instead so the full UI flow can
 * be exercised without a real Discord channel.
 *
 * Pattern mirrors: @/utils/assistants/api-utils.ts (pure helpers,
 * no server-action concerns).
 */

import type { SupportTicketPayload } from '@/types/support';

const COLOR_BLURPLE = 0x5865f2;

// =============================================================================
// Public API
// =============================================================================

export interface DiscordTicketOptions {
  webhookUrl: string;
  userEmail: string;
  payload: SupportTicketPayload;
  environment: string;
}

/**
 * Send a support ticket to Discord as a rich embed with an optional
 * screenshot attachment.
 *
 * When {@link webhookUrl} is empty the function falls back to local
 * logging and returns `true` so callers can test end-to-end without
 * configuring a real webhook.
 */
export async function sendSupportTicketToDiscord(options: DiscordTicketOptions): Promise<boolean> {
  const { webhookUrl, userEmail, payload, environment } = options;

  if (!webhookUrl) {
    logLocally(userEmail, payload, environment);
    return true;
  }

  const embed = buildEmbed(userEmail, payload, environment);
  return postToWebhook(webhookUrl, embed, payload.screenshotDataUrl);
}

// =============================================================================
// Environment detection
// =============================================================================

export function detectEnvironment(): string {
  const url = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  if (url.includes('localhost') || url.includes('127.0.0.1')) return 'LOCAL';
  if (url.includes('staging')) return 'STAGING';
  return 'PRODUCTION';
}

// =============================================================================
// Internals
// =============================================================================

function buildEmbed(userEmail: string, payload: SupportTicketPayload, environment: string) {
  return {
    title: `🎫 Support Ticket — ${environment}`,
    color: COLOR_BLURPLE,
    fields: [
      { name: 'User', value: userEmail, inline: true },
      { name: 'Page', value: payload.pageUrl || '/', inline: true },
      { name: 'Browser', value: truncate(payload.userAgent, 256), inline: false },
      { name: 'Description', value: truncate(payload.description, 1024), inline: false },
    ],
    ...(payload.screenshotDataUrl ? { image: { url: 'attachment://screenshot.png' } } : {}),
    footer: { text: new Date().toISOString() },
  };
}

async function postToWebhook(
  webhookUrl: string,
  embed: ReturnType<typeof buildEmbed>,
  screenshotDataUrl: string | null
): Promise<boolean> {
  const formData = new FormData();
  formData.append('payload_json', JSON.stringify({ embeds: [embed] }));

  if (screenshotDataUrl) {
    const base64 = screenshotDataUrl.split(',')[1];
    if (base64) {
      const buffer = Buffer.from(base64, 'base64');
      const blob = new Blob([buffer], { type: 'image/png' });
      formData.append('files[0]', blob, 'screenshot.png');
    }
  }

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
    });
    if (resp.status === 200 || resp.status === 204) {
      return true;
    }
    console.warn(
      `[support-ticket] Discord webhook returned ${resp.status}: ${await resp.text().catch(() => '')}`
    );
    return false;
  } catch (err) {
    console.warn('[support-ticket] Failed to send Discord notification:', err);
    return false;
  }
}

function logLocally(userEmail: string, payload: SupportTicketPayload, environment: string) {
  console.log(
    '[support-ticket] Local mode — Discord notification skipped.\n' +
      JSON.stringify(
        {
          environment,
          userEmail,
          description: payload.description,
          pageUrl: payload.pageUrl,
          hasScreenshot: !!payload.screenshotDataUrl,
        },
        null,
        2
      )
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1) + '…' : value;
}
