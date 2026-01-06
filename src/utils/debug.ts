/**
 * Temporary debug logging for interactive Cursor debugging sessions.
 * Grep-friendly function name ensures easy cleanup after debugging.
 *
 * Usage:
 *   import { CURSOR_DEBUG_LOG } from '@/utils/debug';
 *   CURSOR_DEBUG_LOG('checkpoint reached', { someVar, otherVar });
 *
 * Cleanup:
 *   rg -n "CURSOR_DEBUG_LOG" -S
 */
export function CURSOR_DEBUG_LOG(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const stack = new Error().stack;
  const callerLine = stack?.split('\n')[2]?.trim() ?? 'unknown location';

  console.log(`[CURSOR_DEBUG] ${timestamp} | ${message}`, data ?? '');
  console.log(`  └─ ${callerLine}`);
}

