"use server";

import { ResponseProps } from "@/types/common";
import { 
  SyncableLogEntry, 
  ContactSyncUserPayload, 
  ContactSyncAssistantPayload 
} from "@/types/assistants/contact-sync";

/**
 * Fields that trigger contact sync when updated.
 * - "timezone": Syncs user/assistant timezone
 * - "bio": Syncs user bio or assistant "about" field
 */
const SYNCABLE_FIELDS = ["timezone", "bio"] as const;

/**
 * Sync user profile fields via the admin API.
 * Calls POST /api/admin/contact-sync/user
 */
async function syncUserContact(payload: ContactSyncUserPayload): Promise<ResponseProps> {
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/admin/contact-sync/user`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `User sync failed: ${response.status}` };
    }
    return { info: "User contact synced" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { detail: `User sync error: ${message}` };
  }
}

/**
 * Sync assistant profile fields via the admin API.
 * Calls POST /api/admin/contact-sync/assistant
 */
async function syncAssistantContact(
  assistantId: number,
  payload: ContactSyncAssistantPayload
): Promise<ResponseProps> {
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/admin/contact-sync/assistant`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId: assistantId, ...payload }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Assistant sync failed: ${response.status}` };
    }
    return { info: "Assistant contact synced" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { detail: `Assistant sync error: ${message}` };
  }
}

/**
 * Check if sync is needed and perform batched sync calls.
 * Called from updateLogsWithSync after a successful log update.
 *
 * Conditions for sync:
 * - project = "Assistants"
 * - context ends with "/Contacts"
 * - updated field is in SYNCABLE_FIELDS ("timezone", and later "bio")
 * - affected row has is_system = true
 *
 * Sync routing:
 * - entries.id = 0 → sync to assistant (PATCH /v0/admin/assistant/{id})
 * - entries.id != 0 → sync to user (POST /v0/admin/assistant/update-user)
 *
 * This function is fire-and-forget: errors are logged but not thrown.
 */
export async function maybeSyncContactFields(
  project: string,
  context: string | null,
  entriesUpdate: Record<string, any>,
  paramsUpdate: Record<string, any>,
  affectedLogs: SyncableLogEntry[]
): Promise<void> {
  // Guard: Only for project="Assistants"
  if (project !== "Assistants") {
    return;
  }

  // Guard: Only for context matching ".../.../Contacts"
  if (!context || !context.endsWith("/Contacts")) {
    return;
  }

  // Determine which syncable fields are being updated
  const updatedFields = [
    ...Object.keys(entriesUpdate || {}),
    ...Object.keys(paramsUpdate || {}),
  ];

  const fieldsToSync = updatedFields.filter((f) =>
    (SYNCABLE_FIELDS as readonly string[]).includes(f)
  );

  if (fieldsToSync.length === 0) {
    return;
  }

  // Collect sync targets with batching:
  // - assistantSyncs: Map<assistantId, payload>
  // - userSyncs: Map<"assistantId:email", payload>
  const assistantSyncs = new Map<number, ContactSyncAssistantPayload>();
  const userSyncs = new Map<string, ContactSyncUserPayload>();

  for (const log of affectedLogs) {
    const entries = log.entries || {};

    // Guard: Only rows with is_system = true
    if (entries.is_system !== true) {
      continue;
    }

    // Get assistantId - support both "_assistantId" and "assistantId" field names
    // Also support both number and string types
    const rawAssistantId = entries._assistantId ?? entries.assistantId;
    const assistantId = typeof rawAssistantId === "number" 
      ? rawAssistantId 
      : typeof rawAssistantId === "string" 
        ? parseInt(rawAssistantId, 10) 
        : NaN;
    
    if (isNaN(assistantId)) {
      console.warn("[ContactSync] Missing or invalid _assistantId/assistantId in log", log.id);
      continue;
    }

    // Support both "id" and "contact_id" field names
    const contactId = entries.contactId ?? entries.id;

    if (contactId === 0) {
      // Sync to assistant
      const existing = assistantSyncs.get(assistantId) || {};

      for (const field of fieldsToSync) {
        const newValue = entriesUpdate[field] ?? paramsUpdate[field];
        if (field === "timezone") {
          existing.timezone = newValue;
        } else if (field === "bio") {
          existing.about = newValue; // bio → about for assistant
        }
      }

      assistantSyncs.set(assistantId, existing);
    } else {
      // Sync to user - need email from entries
      const email = (entries.email ?? entries.email_address) as string | undefined;
      if (!email) {
        console.warn("[ContactSync] Missing email for user sync in log", log.id);
        continue;
      }

      const key = `${assistantId}:${email}`;
      const existing = userSyncs.get(key) || {
        assistantId: assistantId,
        targetUserEmail: email,
      };

      for (const field of fieldsToSync) {
        const newValue = entriesUpdate[field] ?? paramsUpdate[field];
        if (field === "timezone") {
          existing.timezone = newValue;
        } else if (field === "bio") {
          existing.bio = newValue;
        }
      }

      userSyncs.set(key, existing);
    }
  }

  // Execute batched syncs in parallel (fire-and-forget)
  const syncPromises: Promise<ResponseProps>[] = [];

  assistantSyncs.forEach((payload, assistantId) => {
    syncPromises.push(
      syncAssistantContact(assistantId, payload).catch((err) => {
        console.error(`[ContactSync] Failed to sync assistant ${assistantId}:`, err);
        return { detail: String(err) };
      })
    );
  });

  userSyncs.forEach((payload) => {
    syncPromises.push(
      syncUserContact(payload).catch((err) => {
        console.error(`[ContactSync] Failed to sync user ${payload.targetUserEmail}:`, err);
        return { detail: String(err) };
      })
    );
  });

  if (syncPromises.length > 0) {
    const results = await Promise.all(syncPromises);
    const failures = results.filter((r) => r.detail);
    if (failures.length > 0) {
      console.warn(`[ContactSync] ${failures.length}/${results.length} syncs failed`);
    } else {
      console.log(`[ContactSync] ${results.length} sync(s) completed successfully`);
    }
  }
}

