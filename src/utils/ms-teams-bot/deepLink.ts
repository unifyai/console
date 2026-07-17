/**
 * Deep link that opens a 1:1 chat with the Unify Microsoft Teams bot so the
 * user can send it a first message.
 *
 * The Unify Teams bot is reply-only: it cannot open a conversation, so during
 * onboarding the user has to message it first (that inbound seeds the
 * conversation reference the bot needs before it can reply). This builds the
 * link the "Send your first message to T-W1N on Teams" checklist row opens.
 *
 * When the public Teams app catalog id is configured we prefer the app
 * add/launch link (`l/app/<catalogId>`): it prompts the one-time personal
 * "Add" for users who don't yet have the bot in their personal scope and then
 * lands them in the chat. Otherwise we fall back to the direct bot-chat link
 * (`l/chat/0/0?users=28:<botAppId>`) built from the install's Bot Framework
 * app id, which opens the chat directly for users who already added the app.
 */

/**
 * Public (non-secret) Teams app catalog id — the manifest `id` GUID of the
 * published Unify Teams app. Optional: when unset the chat link is built from
 * the install's bot app id instead.
 */
export const MS_TEAMS_APP_CATALOG_ID =
  process.env.NEXT_PUBLIC_MS_TEAMS_APP_CATALOG_ID?.trim() || null;

const TEAMS_DEEP_LINK_BASE = 'https://teams.microsoft.com/l';

export interface MsTeamsChatDeepLinkArgs {
  /** Manifest catalog id GUID (preferred; enables the add/launch variant). */
  catalogId?: string | null;
  /** Bot Framework (MSA) app id from the tenant install (fallback). */
  botAppId?: string | null;
  /** Optional compose-box prefill for the chat link variant. */
  prefill?: string;
}

/**
 * Returns a Teams deep link, or `null` when neither id is available (in which
 * case the checklist row should stay unwired rather than open a broken link).
 */
export function buildMsTeamsChatDeepLink(args: MsTeamsChatDeepLinkArgs): string | null {
  const catalogId = args.catalogId?.trim();
  if (catalogId) {
    return `${TEAMS_DEEP_LINK_BASE}/app/${encodeURIComponent(catalogId)}`;
  }
  const botAppId = args.botAppId?.trim();
  if (botAppId) {
    // The `28:` prefix marks a bot recipient; keep the colon literal (Teams
    // expects the documented `users=28:<id>` form) and only encode the id.
    let link = `${TEAMS_DEEP_LINK_BASE}/chat/0/0?users=28:${encodeURIComponent(botAppId)}`;
    if (args.prefill) {
      link += `&message=${encodeURIComponent(args.prefill)}`;
    }
    return link;
  }
  return null;
}
