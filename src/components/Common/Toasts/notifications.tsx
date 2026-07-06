'use client';

import { toast } from 'sonner';
import { useRef, useCallback, useEffect } from 'react';

/**
 * Ensure toast creation happens outside of React render but **still** returns the
 * toast ID synchronously so callers (e.g. `withLoadingToast`) can update or
 * dismiss the same toast later. React 18 Strict-Mode double invokes effects
 * in development which can lead to duplicate toasts – Sonner already de-dupes
 * by `id`, so the simplest, most reliable approach is to execute the provided
 * `fn` immediately and just queue a no-op micro-task to keep React happy.
 */
const scheduleToast = <T,>(fn: () => T): T => {
  const id = fn();

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => {});
  }

  return id;
};

export const showLoadingToast = (message: string) => {
  return scheduleToast(() =>
    toast.loading(message, {
      description: 'This is taking longer than usual...',
      duration: Infinity,
    })
  );
};

const recentErrorToasts = new Map<string, number>();
const ERROR_TOAST_DEDUPE_WINDOW = 2000;

export const showErrorToast = (
  error: any,
  defaultMessage: string = 'An unexpected error occurred.',
  id?: string | number
) => {
  const errorMessage = (error as Error)?.message || '';

  if ((error as Error).name === 'AbortError' || errorMessage.includes('Connection closed')) {
    return;
  }

  console.error('API Error:', error);

  let message = defaultMessage;
  let title = 'Error';

  if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
    title = 'Request Timeout';
    message = 'Save timed out. Please try again.';
  } else if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) {
      message = 'Network request failed. Please check your connection.';
    } else {
      message = error.message;
    }
  } else if (typeof error === 'string') {
    message = error;
  }

  const dedupeKey = `${title}:${message}`;
  const now = Date.now();
  const lastShown = recentErrorToasts.get(dedupeKey);
  if (lastShown && now - lastShown < ERROR_TOAST_DEDUPE_WINDOW) {
    console.warn('[showErrorToast] Suppressing duplicate error toast:', dedupeKey);
    return;
  }
  recentErrorToasts.set(dedupeKey, now);

  setTimeout(() => {
    recentErrorToasts.delete(dedupeKey);
  }, ERROR_TOAST_DEDUPE_WINDOW);

  scheduleToast(() =>
    toast.error(title, {
      description: message,
      id,
      duration: errorMessage.includes('timeout') || errorMessage.includes('504') ? 6000 : 4000,
    })
  );
};

export const showSuccessToast = (title: string, description?: string, id?: string | number) => {
  scheduleToast(() =>
    toast.success(title, {
      description,
      id,
      duration: 2500,
    })
  );
};

export function showToast(text: string, type: 'success' | 'error' = 'success') {
  if (type === 'error') {
    toast.error(text);
    return;
  }
  toast.success(text);
}

export const withLoadingToastFn = async <T,>(
  fn: () => Promise<T>,
  options?: {
    loadingMessage?: string;
    successMessage?: string;
    errorMessage?: string;
    onSuccess?: (result: T) => string | void;
  }
): Promise<T> => {
  const loadingId = showLoadingToast(options?.loadingMessage || 'Processing...');

  try {
    const result = await fn();

    const successMessage = options?.onSuccess?.(result) || options?.successMessage || 'Done!';

    toast.success(successMessage, {
      id: loadingId,
      duration: 2000,
    });

    return result;
  } catch (error) {
    showErrorToast(error, options?.errorMessage || 'Something went wrong.', loadingId);
    throw error;
  }
};

export function useLoadingToast() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeWithToast = useCallback(
    async <T,>(
      action: (abortSignal?: AbortSignal) => Promise<T>,
      messages: { loading: string; success: string; error: string }
    ): Promise<T> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        return await withLoadingToastFn(() => action(abortControllerRef.current?.signal), {
          loadingMessage: messages.loading,
          successMessage: messages.success,
          errorMessage: messages.error,
        });
      } finally {
        abortControllerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return executeWithToast;
}
