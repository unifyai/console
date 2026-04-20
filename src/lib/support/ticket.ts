/**
 * Support ticket server action.
 *
 * Unlike billing/usage actions which need a per-user API key captured
 * at page render time, this action only needs the Discord webhook URL
 * (a server-wide env var) and the session (read at call time).  It can
 * therefore be imported directly by client components — no factory or
 * prop-threading required.
 *
 * Pattern mirrors: @/lib/user/user.ts  (getCurrentUser — imported
 * directly from client components like TopNav).
 */

'use server';

import { sendSupportTicketToDiscord, detectEnvironment } from '@/utils/support/discord';
import { getSession } from '@/lib/user/user';
import type { SupportTicketPayload, SupportTicketResult } from '@/types/support';

// =============================================================================
// Rate limiting (in-memory, per-user — mirrors orchestra billing_notifications)
// =============================================================================

const COOLDOWN_MS = 5 * 60 * 1000;
const cooldowns = new Map<string, number>();

// =============================================================================
// Validation
// =============================================================================

const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024; // ~3 MB decoded PNG

function validatePayload(payload: SupportTicketPayload): string | null {
  if (!payload.description?.trim()) {
    return 'Please describe the issue.';
  }
  if (payload.description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description must be under ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  if (payload.screenshotDataUrl && payload.screenshotDataUrl.length > MAX_SCREENSHOT_BYTES) {
    return 'Screenshot is too large — please try again without it.';
  }
  return null;
}

// =============================================================================
// Server action
// =============================================================================

export async function submitSupportTicket(
  payload: SupportTicketPayload
): Promise<SupportTicketResult> {
  // ── Auth ────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session?.user?.email) {
    return { success: false, error: 'You must be signed in to submit a ticket.' };
  }
  const email = session.user.email;

  // ── Rate limit ─────────────────────────────────────────────────────
  const lastSubmitted = cooldowns.get(email) ?? 0;
  const elapsed = Date.now() - lastSubmitted;
  if (elapsed < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return {
      success: false,
      error: `Please wait ${waitSec}s before submitting another ticket.`,
    };
  }

  // ── Validate ───────────────────────────────────────────────────────
  const validationError = validatePayload(payload);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // ── Send ───────────────────────────────────────────────────────────
  const webhookUrl = process.env.DISCORD_SUPPORT_WEBHOOK_URL ?? '';
  const environment = detectEnvironment();

  const sent = await sendSupportTicketToDiscord({
    webhookUrl,
    userEmail: email,
    payload,
    environment,
  });

  if (!sent) {
    return { success: false, error: 'Failed to deliver the ticket — please try again.' };
  }

  cooldowns.set(email, Date.now());
  return { success: true };
}
