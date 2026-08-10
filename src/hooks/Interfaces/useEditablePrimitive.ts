import React from 'react';
import { showErrorToast } from '@/components/Common/Toasts/notifications';
import { isImeComposing } from '@/utils/keyboard';

export function useEditablePrimitive<T>(
  initial: T,
  onCommit: (val: T) => void,
  validate?: (val: T) => true | string // true = valid, string = error message
) {
  const [draft, setDraft] = React.useState<T>(initial);
  const initialRef = React.useRef<T>(initial);

  React.useEffect(() => {
    setDraft(initial);
    initialRef.current = initial;
  }, [initial]);

  const handleCommit = React.useCallback(() => {
    // Removed verbose debug logging – commit will now be silent
    if (validate) {
      const res = validate(draft);
      if (res !== true) {
        showErrorToast(typeof res === 'string' ? res : 'Invalid value');
        // Removed verbose debug logging – validation errors are still surfaced via toast
        return;
      }
    }
    onCommit(draft);
  }, [onCommit, draft, validate]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (isImeComposing(e)) return;
      if (e.key === 'Enter') {
        // Removed verbose debug logging – keydown enter
        if (e.shiftKey) {
          // Allow newline inside textarea when Shift+Enter
          return;
        }
        e.preventDefault();
        handleCommit();
      }
      if (e.key === 'Escape') {
        // Removed verbose debug logging – keydown escape
        setDraft(initial); // revert
      }
    },
    [handleCommit, initial]
  );

  const inputProps = {
    value: draft as any,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((e.target as any).value as any),
    onKeyDown: handleKeyDown,
  } as const;

  const hasChanged = draft !== initialRef.current;

  return { draft, setDraft, inputProps, commit: handleCommit, hasChanged };
}
