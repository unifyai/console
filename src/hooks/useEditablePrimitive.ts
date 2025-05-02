import React from "react";
import { toast } from "sonner";

export function useEditablePrimitive<T>(
  initial: T,
  onCommit: (val: T) => void,
  validate?: (val: T) => true | string // true = valid, string = error message
) {
  const [draft, setDraft] = React.useState<T>(initial);
  // Store the initial value in a ref so we can compare for dirty state
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
        toast.error(typeof res === "string" ? res : "Invalid value");
        // Removed verbose debug logging – validation errors are still surfaced via toast
        return;
      }
    }
    onCommit(draft);
  }, [onCommit, draft, validate]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        // Removed verbose debug logging – keydown enter
        if (e.shiftKey) {
          // Allow newline inside textarea when Shift+Enter
          return;
        }
        e.preventDefault();
        handleCommit();
      }
      if (e.key === "Escape") {
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
    onBlur: handleCommit,
    onKeyDown: handleKeyDown,
  } as const;

  const hasChanged = draft !== initialRef.current;

  return { draft, setDraft, inputProps, commit: handleCommit, hasChanged };
} 