/**
 * Temporary debug logging for interactive Cursor debugging sessions.
 * Grep-friendly function name ensures easy cleanup after debugging.
 *
 * Usage:
 *   import { cursorDebugLog } from '@/utils/debug';
 *   cursorDebugLog('checkpoint reached', { someVar, otherVar });
 *
 * Cleanup:
 *   rg -n "cursorDebugLog" -S
 */
export function cursorDebugLog(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const stack = new Error().stack;
  const callerLine = stack?.split('\n')[2]?.trim() ?? 'unknown location';

  console.log(`[CURSOR_DEBUG] ${timestamp} | ${message}`, data ?? '');
  console.log(`  └─ ${callerLine}`);
}

