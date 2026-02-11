/**
 * Types for Demo Assistants
 */

import { ResponseProps } from '@/types/common';
import { Assistant } from '@/types/assistants/assistant';
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
}

/**
 * Actions interface for demo assistant operations
 */
export interface DemoActions {
  list: () => Promise<DemoAssistant[] | ResponseProps>;
  create: (payload: DemoAssistantCreatePayload) => Promise<DemoAssistant | ResponseProps>;
  getMeta: (demoId: number) => Promise<DemoAssistantMeta | ResponseProps>;
  listSourceAssistants: () => Promise<Assistant[] | (ResponseProps & { status?: number })>;
  /** Get contacts for a demo assistant from logs */
  getContacts: (assistantId: string) => Promise<DemoContact[] | ResponseProps>;
  /** Get spending data for a demo assistant */
  getSpending: (assistantId: string) => Promise<AssistantSpend | ResponseProps>;
  /** Delete a demo assistant */
  delete: (assistantId: string) => Promise<{ success: boolean } | ResponseProps>;
}
