/**
 * Types for contact sync between logs and user/assistant profiles.
 */

/**
 * Payload for syncing user profile fields via assistant lookup.
 * Used with POST /v0/admin/assistant/update-user
 */
export interface ContactSyncUserPayload {
  assistantId: number;
  targetUserEmail: string;
  timezone?: string;
  bio?: string;
}

/**
 * Payload for syncing assistant profile fields.
 * Used with PATCH /v0/admin/assistant/{assistant_id}
 *
 * Note: "bio" in logs maps to "about" in assistant profile.
 */
export interface ContactSyncAssistantPayload {
  timezone?: string;
  about?: string;
}

/**
 * Minimal log data needed for sync checking.
 * Passed to updateLogsWithSync for contact field synchronization.
 */
export interface SyncableLogEntry {
  id: number; // Log row ID (database ID)
  entries: {
    id?: number; // Contact ID: 0 = assistant, non-zero = user
    contactId?: number; // Alternative contact ID field name
    isSystem?: boolean; // Only sync if true
    internalAssistantId?: number | string; // Assistant ID for sync routing
    assistantId?: number | string; // Alternative assistant ID field name
    email?: string; // User email (for user sync)
    emailAddress?: string; // Alternative email field
    [key: string]: any; // Other entry fields
  };
}
