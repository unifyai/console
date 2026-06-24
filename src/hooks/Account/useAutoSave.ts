'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SAVED_DISPLAY_MS = 2000;

/**
 * Drives an eager (no explicit "Save" button) persistence flow for a settings
 * field or group of fields. `saveFn` performs the actual write and resolves to
 * `true` on success; the hook surfaces a `status` for an unobtrusive indicator
 * and shows a generic error toast on failure.
 *
 * Saves are sequenced so a slow earlier write can't clobber the status of a
 * later one (last-write-wins on the indicator).
 */
export function useAutoSave<T>(
  saveFn: (payload: T) => Promise<boolean>,
  errorMessage = 'Could not save changes. Please try again.'
) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;
  const errorRef = useRef(errorMessage);
  errorRef.current = errorMessage;

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const save = useCallback(async (payload: T): Promise<boolean> => {
    const mySeq = ++seq.current;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setStatus('saving');

    const ok = await saveFnRef.current(payload);

    // A newer save superseded this one — let it own the status.
    if (mySeq !== seq.current) return ok;

    if (ok) {
      setStatus('saved');
      resetTimer.current = setTimeout(() => setStatus('idle'), SAVED_DISPLAY_MS);
    } else {
      setStatus('error');
      toast.error(errorRef.current);
    }
    return ok;
  }, []);

  return { status, save };
}
