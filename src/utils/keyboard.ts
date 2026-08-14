/**
 * Keyboard helpers for input-method (IME) aware key handling.
 */

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

type AnyKeyboardEvent = KeyboardEvent | ReactKeyboardEvent;

/**
 * True while an input method editor is mid-composition.
 *
 * Japanese, Chinese and Korean input methods use Enter to commit the current
 * conversion candidate, and that keypress reaches `keydown` indistinguishable
 * from a deliberate Enter. Any handler that sends, submits, commits or closes
 * on Enter has to ignore it, or accepting a conversion fires the action with a
 * half-typed word still in the field.
 *
 * `keyCode === 229` is the legacy signal for the same state. Safari has not
 * reliably set `isComposing` on the committing keydown, so both are checked.
 *
 * @example
 * const onKeyDown = (e: React.KeyboardEvent) => {
 *   if (isImeComposing(e)) return;
 *   if (e.key === 'Enter') submit();
 * };
 */
export function isImeComposing(event: AnyKeyboardEvent): boolean {
  const native = 'nativeEvent' in event ? event.nativeEvent : event;
  return native.isComposing || native.keyCode === 229;
}
