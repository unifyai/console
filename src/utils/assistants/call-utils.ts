/**
 * Shared utilities for call-related logic.
 * These are safe to import from both server and client code.
 */

/**
 * Constructs a deterministic LiveKit room name for a given assistant and medium.
 *
 * @param assistantId - The agent/assistant ID.
 * @param medium - The communication medium (e.g. "meet").
 * @returns A room name string in the format `unity_{assistantId}_{medium}`.
 */
export function makeRoomName(assistantId: string, medium: string): string {
  return `unity_${assistantId}_${medium}`;
}

