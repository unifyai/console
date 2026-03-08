/**
 * Types for assistant contact details and billing.
 *
 * These types mirror the backend `AssistantContactCostRead` schema from
 * `orchestra/web/api/admin/schema.py` and support the contact creation flow.
 */

/**
 * A single contact cost row from the `contact_type_costs` table.
 * Returned by GET /v0/admin/billing/contact-costs.
 */
export interface AssistantContactCost {
  id: number;
  contactType: 'phone' | 'email' | 'whatsapp';
  provider: string | null;
  countryCode: string | null;
  monthlyCost: number;
  oneTimeCost: number;
}

/**
 * Keyed map of monthly + one-time costs per contact type.
 * Used by the UI to display pricing without hardcoding values.
 */
export interface ContactCosts {
  phone: { monthlyCost: number; oneTimeCost: number };
  email: { monthlyCost: number; oneTimeCost: number };
  whatsapp: { monthlyCost: number; oneTimeCost: number };
}

/**
 * Payload for creating a new contact detail via POST /assistant/{id}/contact.
 * Mirrors the backend `AssistantContactCreate` schema.
 */
export interface AssistantContactCreatePayload {
  contactType: 'phone' | 'email' | 'whatsapp';
  // Phone-specific
  phoneCountry?: string;
  userPhone?: string;
  // Email-specific
  emailLocal?: string;
  firstName?: string;
  lastName?: string;
  // WhatsApp-specific
  userWhatsappNumber?: string;
}

