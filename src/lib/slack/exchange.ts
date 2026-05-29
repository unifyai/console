/**
 * Slack OAuth v2 helpers — authorize-URL builder and code exchange.
 *
 * Unlike the assistant-Integrations flow (Employment Hero, Salesforce,
 * Webex), Slack uses a **single platform app** owned by Unify, so the
 * ``client_id`` / ``client_secret`` are env vars on Console itself,
 * not values pulled from assistant secrets.
 *
 * The scope set here MUST stay in sync with the Slack app manifest
 * (``settings.event_subscriptions.bot_events`` + ``oauth_config.scopes.bot``)
 * — Slack rejects authorize requests whose scopes are not declared in
 * the manifest, and the comms-side ``slack_events_webhook`` assumes
 * the bot has the channel/im/group history scopes when it forwards
 * inbound events.
 */

import 'server-only';

import type { SlackInstallOwner } from '@/types/slack/install';

/**
 * Bot scopes requested at OAuth time. The list mirrors the manifest
 * exactly so the user-consent screen and the eventually-stored
 * ``scopes`` column on ``slack_installs`` line up.
 */
export const SLACK_BOT_SCOPES = [
  'app_mentions:read',
  'channels:history',
  'groups:history',
  'im:history',
  'im:read',
  'im:write',
  'mpim:history',
  'mpim:read',
  'chat:write',
  'users:read',
  'team:read',
  'files:read',
] as const;

function consoleUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONSOLE_URL ?? process.env.NEXTAUTH_URL ?? '';
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_CONSOLE_URL (or NEXTAUTH_URL) must be set so the Slack callback can be built.'
    );
  }
  return url.replace(/\/$/, '');
}

export function getSlackCallbackUrl(): string {
  return `${consoleUrl()}/oauth/slack/callback`;
}

function getSlackClientId(): string {
  const id = process.env.SLACK_CLIENT_ID;
  if (!id) {
    throw new Error('SLACK_CLIENT_ID is not set — required to start the Slack OAuth flow.');
  }
  return id;
}

function getSlackClientSecret(): string {
  const secret = process.env.SLACK_CLIENT_SECRET;
  if (!secret) {
    throw new Error('SLACK_CLIENT_SECRET is not set — required to complete the Slack OAuth flow.');
  }
  return secret;
}

/**
 * Build the Slack authorize URL the browser should navigate to.
 *
 * Slack rejects unknown ``redirect_uri`` values silently (the user
 * sees a generic error), so the URL passed here must already be
 * registered in the Slack app manifest's ``oauth_config.redirect_urls``.
 */
export function buildSlackAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    /* eslint-disable @typescript-eslint/naming-convention -- Slack OAuth requires snake_case query params. */
    client_id: getSlackClientId(),
    scope: SLACK_BOT_SCOPES.join(','),
    redirect_uri: getSlackCallbackUrl(),
    state,
    /* eslint-enable @typescript-eslint/naming-convention */
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Shape of the body Console hands to Orchestra's
 * ``POST /v0/admin/slack/install`` after a successful exchange. Kept
 * snake_case so callers can pass it through verbatim without an
 * extra round of casing conversion in admin proxies.
 */
export interface SlackInstallUpsertBody {
  /* eslint-disable @typescript-eslint/naming-convention -- Orchestra wire format. */
  organization_id?: number | null;
  user_id?: string | null;
  slack_team_id: string;
  slack_app_id: string;
  bot_user_id: string;
  bot_access_token: string;
  slack_team_name?: string | null;
  enterprise_id?: string | null;
  installer_user_id?: string | null;
  scopes?: string | null;
  /* eslint-enable @typescript-eslint/naming-convention */
}

/**
 * Exchange a Slack OAuth ``code`` for the bot token + workspace
 * metadata and shape the result into the Orchestra upsert body.
 *
 * Slack returns errors in-band (HTTP 200 with ``{ ok: false,
 * error: ... }``) so checking ``ok`` is mandatory — a non-2xx status
 * by itself is not enough.
 */
export async function exchangeSlackCode(args: {
  code: string;
  owner: SlackInstallOwner;
}): Promise<SlackInstallUpsertBody> {
  const { code, owner } = args;
  const body = new URLSearchParams({
    /* eslint-disable @typescript-eslint/naming-convention -- Slack OAuth requires snake_case body. */
    client_id: getSlackClientId(),
    client_secret: getSlackClientSecret(),
    code,
    redirect_uri: getSlackCallbackUrl(),
    /* eslint-enable @typescript-eslint/naming-convention */
  });
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Slack token endpoint returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    /* eslint-disable @typescript-eslint/naming-convention */
    app_id?: string;
    bot_user_id?: string;
    access_token?: string;
    scope?: string;
    team?: { id?: string; name?: string };
    enterprise?: { id?: string; name?: string } | null;
    authed_user?: { id?: string };
    /* eslint-enable @typescript-eslint/naming-convention */
  };
  if (!data.ok) {
    throw new Error(`Slack OAuth exchange failed: ${data.error ?? 'unknown_error'}`);
  }
  if (!data.team?.id || !data.app_id || !data.bot_user_id || !data.access_token) {
    throw new Error('Slack OAuth response missing required fields.');
  }
  return {
    /* eslint-disable @typescript-eslint/naming-convention -- Orchestra wire format. */
    organization_id: owner.kind === 'org' ? owner.orgId : null,
    user_id: owner.kind === 'user' ? owner.userId : null,
    slack_team_id: data.team.id,
    slack_team_name: data.team.name ?? null,
    slack_app_id: data.app_id,
    bot_user_id: data.bot_user_id,
    bot_access_token: data.access_token,
    enterprise_id: data.enterprise?.id ?? null,
    installer_user_id: data.authed_user?.id ?? null,
    scopes: data.scope ?? null,
    /* eslint-enable @typescript-eslint/naming-convention */
  };
}
