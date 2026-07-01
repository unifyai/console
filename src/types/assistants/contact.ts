/**
 * Types for assistant contact details and billing.
 *
 * These types mirror the backend `AssistantContactCostRead` schema from
 * `orchestra/web/api/admin/schema.py` and support the contact creation flow.
 */

export type ContactType = 'email' | 'phone' | 'whatsapp' | 'discord';

/**
 * Email provider stored on `assistant.emailProvider` for BYOD-connected
 * mailboxes.  Platform provisioning (`@unify.ai` / MS365 tenant) was retired,
 * so the value always reflects a user-connected account.
 */
export type EmailProvider = 'google_workspace' | 'microsoft_365';

/** OAuth provider identifier used by the connect/granted-features endpoints. */
export type OAuthProvider = 'google' | 'microsoft';

/**
 * A single contact cost row from the `contact_type_costs` table.
 * Returned by GET /v0/admin/billing/contact-costs.
 */
export interface AssistantContactCost {
  id: number;
  contactType: ContactType;
  provider: string | null;
  countryCode: string | null;
  monthlyCost: number;
  oneTimeCost: number;
}

interface CostEntry {
  monthlyCost: number;
  oneTimeCost: number;
}

/**
 * Keyed map of monthly + one-time costs per contact type.
 * Used by the UI to display pricing without hardcoding values.
 *
 * Email contacts are BYOD-only and never billed, so `email` is always zero
 * and is kept only so callers can index `contactCosts[contactType]` uniformly.
 */
export interface ContactCosts {
  phone: CostEntry;
  email: CostEntry;
  whatsapp: CostEntry;
  discord: CostEntry;
}

/**
 * Payload for creating a new contact detail via POST /assistant/{id}/contact.
 * Mirrors the backend `AssistantContactCreate` schema.
 *
 * Email contacts are BYOD-only and are created through the OAuth connect
 * flow (`POST /assistant/{id}/connect`), not this endpoint, so no email-
 * specific fields are needed here.
 */
export interface AssistantContactCreatePayload {
  contactType: ContactType;
  // Phone-specific
  phoneCountry?: string;
}

/**
 * Response from GET /assistant/{id}/granted-features.
 * Describes which OAuth provider is connected and what features are granted.
 */
export interface GrantedFeaturesResponse {
  provider: OAuthProvider | null;
  features: string[];
  requiredFeatures?: string[];
  connectedAccountEmail?: string | null;
}
