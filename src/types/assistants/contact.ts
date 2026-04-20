/**
 * Types for assistant contact details and billing.
 *
 * These types mirror the backend `AssistantContactCostRead` schema from
 * `orchestra/web/api/admin/schema.py` and support the contact creation flow.
 */

export type ContactType = 'email' | 'phone' | 'whatsapp' | 'discord';

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
 */
export interface ContactCosts {
  phone: CostEntry;
  email: CostEntry;
  whatsapp: CostEntry;
  discord: CostEntry;
  /** Per-provider email costs (e.g. google_workspace, microsoft_365). */
  emailByProvider: Record<string, CostEntry>;
}

/**
 * Payload for creating a new contact detail via POST /assistant/{id}/contact.
 * Mirrors the backend `AssistantContactCreate` schema.
 */
export interface AssistantContactCreatePayload {
  contactType: ContactType;
  // Phone-specific
  phoneCountry?: string;
  // Email-specific
  emailProvider?: EmailProvider;
  emailLocal?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Response from GET /assistant/{id}/granted-features.
 * Describes which OAuth provider is connected and what features are granted.
 */
export interface GrantedFeaturesResponse {
  provider: OAuthProvider | null;
  features: string[];
  requiredFeatures?: string[];
}
