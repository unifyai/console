/**
 * Types for Demo Assistants
 */

import { ResponseProps } from '@/types/common';
import { Assistant, AvailablePhoneCountry } from '@/types/assistants/assistant';
import { AssistantSpend } from '@/types/assistants/spending';

/**
 * Payload for creating a demo assistant
 */
export interface DemoAssistantCreatePayload {
  sourceAssistantId: number;
  label: string;
  firstName: string;
  surname: string;
  demoerPhone: string;
  /** Monthly spending cap in USD (default: $10, max: $100) */
  monthlySpendingCap?: number;
  /** Country code for phone number provisioning (e.g., "US", "GB"). If not provided, uses source assistant's country. */
  phoneCountry?: string;
  /** Whether to provision an email address for the demo assistant */
  provisionEmail?: boolean;
  /** Prospect's first name (optional, for pre-populating boss contact) */
  prospectFirstName?: string;
  /** Prospect's surname (optional, for pre-populating boss contact) */
  prospectSurname?: string;
  /** Prospect's email address (optional, for pre-populating boss contact) */
  prospectEmail?: string;
  /** Prospect's phone number in E.164 format (optional, for pre-populating boss contact) */
  prospectPhone?: string;
}

/**
 * Contact entry from the assistant's Contacts log
 *
 * Contact ID Reference:
 * - 0 = Assistant (AI)
 * - 1 = Boss/Owner (prospect being demoed to)
 * - 2 = Demoer (Unify colleague running the demo)
 * - 3+ = Other contacts created during the demo
 */
export interface DemoContact {
  /** Log entry ID */
  logId: number;
  /** Contact ID within the assistant's contacts */
  contactId: number;
  /** Contact's first name */
  firstName?: string;
  /** Contact's surname */
  surname?: string;
  /** Contact's email address */
  emailAddress?: string;
  /** Contact's phone number */
  phoneNumber?: string;
  /** Contact's WhatsApp number */
  whatsappNumber?: string;
  /** Contact description/notes */
  description?: string;
  /** Whether this is the assistant or a system contact */
  isSystem?: boolean;
}

/**
 * Demo assistant data returned from the API
 */
export interface DemoAssistant {
  agentId: string;
  userId: string;
  organizationId: number | null;
  firstName: string;
  surname: string;
  phone: string | null;
  /** Assistant's email address (if provisioned) */
  email: string | null;
  /** Demoer's phone number (stored as user_phone in the assistant) */
  userPhone: string | null;
  /** Monthly spending cap in USD (null = no limit) */
  monthlySpendingCap: number | null;
  demoId: number;
  createdAt: string;
  age?: number;
  nationality?: string;
  about?: string;
  profilePhoto?: string;
}

/**
 * Demo assistant metadata
 */
export interface DemoAssistantMeta {
  id: number;
  sourceAssistantId: number | null;
  demoerUserId: string;
  label: string;
  createdAt: string;
  /** Demo assistant ID (foreign key to assistant table) */
  demoAssistantId?: number;
  /** Prospect's first name (for pre-populating boss contact) */
  prospectFirstName?: string;
  /** Prospect's surname (for pre-populating boss contact) */
  prospectSurname?: string;
  /** Prospect's email address (for pre-populating boss contact) */
  prospectEmail?: string;
  /** Prospect's phone number (for pre-populating boss contact) */
  prospectPhone?: string;
}

/**
 * Actions interface for demo assistant operations
 */
export interface DemoActions {
  list: () => Promise<DemoAssistant[] | ResponseProps>;
  create: (payload: DemoAssistantCreatePayload) => Promise<DemoAssistant | ResponseProps>;
  getMeta: (demoId: number) => Promise<DemoAssistantMeta | ResponseProps>;
  /** List all demo metadata for the current user (for labels) */
  listMeta: () => Promise<DemoAssistantMeta[] | ResponseProps>;
  listSourceAssistants: () => Promise<Assistant[] | (ResponseProps & { status?: number })>;
  /** List available phone countries for provisioning */
  listAvailablePhoneCountries: () => Promise<AvailablePhoneCountry[]>;
  /** Get contacts for a demo assistant from logs */
  getContacts: (assistantId: string) => Promise<DemoContact[] | ResponseProps>;
  /** Get spending data for a demo assistant */
  getSpending: (assistantId: string) => Promise<AssistantSpend | ResponseProps>;
  /** Delete a demo assistant */
  delete: (assistantId: string) => Promise<{ success: boolean } | ResponseProps>;
}
