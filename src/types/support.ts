/**
 * Support ticket types.
 *
 * Follows the same pattern as @/types/billing.ts and
 * @/types/assistants/assistant.ts.
 */

// =============================================================================
// Payload (client → server action)
// =============================================================================

export interface SupportTicketPayload {
  /** User-provided description of the issue */
  description: string;
  /** Base64 data-URL of the page screenshot, or null if capture failed */
  screenshotDataUrl: string | null;
  /** Pathname the user was on when the ticket was filed */
  pageUrl: string;
  /** Browser user-agent string */
  userAgent: string;
}

// =============================================================================
// Result (server action → client)
// =============================================================================

export interface SupportTicketResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// Error response (mirrors BillingErrorResponse for type-guard consistency)
// =============================================================================

export interface SupportErrorResponse {
  detail: string;
}

export function isSupportError(response: unknown): response is SupportErrorResponse {
  return typeof response === 'object' && response !== null && 'detail' in response;
}
