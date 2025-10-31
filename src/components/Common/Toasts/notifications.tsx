"use client"

import { toast } from "sonner";
import { Info, CheckCircle, LoaderCircle } from "lucide-react";
import React, { useRef, useCallback, useEffect } from "react";

// A custom component for our toasts to handle click-to-dismiss
const CustomToast = ({ id, Icon, title, description, iconClassName }: {
    id: string | number;
    Icon: React.ElementType;
    title: string;
    description?: string;
    iconClassName?: string;
}) => (
    <div
        onClick={() => toast.dismiss(id)}
        className="flex items-center gap-4 w-full h-full cursor-pointer bg-background text-foreground border border-primary shadow-lg p-4 rounded-lg overflow-hidden"
    >
        <Icon className={`text-primary flex-shrink-0 ${iconClassName || ''}`} />
        <div className="flex flex-col gap-0.5">
            <p className="text-strong">{title}</p>
            {description && <p className="text-body opacity-90">{description}</p>}
        </div>
    </div>
);

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

    // Queue a no-op so that the actual DOM update still happens after the
    // current React render cycle (avoids setState warnings in StrictMode)
    if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => {});
    }

    return id;
};

export const showLoadingToast = (message: string) => {
    return scheduleToast(() => toast.custom(
        (id) => (
            <CustomToast
                id={id}
                Icon={LoaderCircle}
                title={message}
                description="This is taking longer than usual..."
                iconClassName="animate-spin"
            />
        ),
        {
            className: 'min-w-[380px] h-16 p-0 bg-transparent border-none shadow-none',
            duration: Infinity, // Don't auto-dismiss loading toasts
        }
    )) as string | number;
};

export const showErrorToast = (
  error: any,
  defaultMessage: string = "An unexpected error occurred.",
  id?: string | number
) => {
  const errorMessage = (error as Error)?.message || '';
  
  // Ignore cancellations (these are expected, not errors)
  if ((error as Error).name === 'AbortError' || errorMessage.includes('Connection closed')) {
    return;
  }
  
  console.error("API Error:", error);

  let message = defaultMessage;
  let title = "Error";
  
  // Special handling for timeout errors (504 Gateway Timeout)
  if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
    title = "Request Timeout";
    // Check if it's an upstream timeout from our API routes
    if (errorMessage.includes('Upstream timeout')) {
      message = "The server is taking longer than usual. This may indicate Orchestra is under heavy load.";
    } else {
      message = errorMessage || "The request timed out. Please try again.";
    }
  } else if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      message = "Network request failed. Please check your connection.";
    } else {
      message = error.message;
    }
  } else if (typeof error === "string") {
    message = error;
  }

  scheduleToast(() => toast.custom(
    (toastId) => (
        <CustomToast
            id={toastId}
            Icon={Info}
            title={title}
            description={message}
        />
    ),
    {
        id,
        duration: errorMessage.includes('timeout') || errorMessage.includes('504') ? 6000 : 4000, // Longer duration for timeouts
        className: 'min-w-[380px] h-16 p-0 bg-transparent border-none shadow-none',
    }
  ));
};

export const showSuccessToast = (
    title: string,
    description?: string,
    id?: string | number
) => {
    scheduleToast(() => toast.custom(
        (toastId) => (
            <CustomToast
                id={toastId}
                Icon={CheckCircle}
                title={title}
                description={description}
            />
        ),
        {
            id,
            duration: 2500,
            className: 'min-w-[380px] h-16 p-0 bg-transparent border-none shadow-none',
        }
    ));
};

/**
 * Helper to show a toast around an async function, with default copy.
 */
export const withLoadingToastFn = async <T,>(fn: () => Promise<T>, options?: {
    loadingMessage?: string;
    successMessage?: string;
    errorMessage?: string;
    onSuccess?: (result: T) => string | void; // Optionally return a custom success message
}): Promise<T> => {
    const loadingId = showLoadingToast(options?.loadingMessage || 'Processing...');

    try {
        const result = await fn();

        const successMessage = options?.onSuccess?.(result) || options?.successMessage || 'Done!';

        toast.custom(
            (toastId) => (
                <CustomToast
                    id={toastId}
                    Icon={CheckCircle}
                    title={successMessage}
                />
            ),
            {
                id: loadingId,
                duration: 2000,
                className: 'min-w-[380px] h-16 p-0 bg-transparent border-none shadow-none',
            }
        );

        return result;
    } catch (error) {
        showErrorToast(error, options?.errorMessage || 'Something went wrong.', loadingId);
        throw error; // Re-throw to allow callers to handle as needed
    }
};

/**
 * Enhanced version of withLoadingToast that creates its own AbortController
 * and cleans up automatically when the component unmounts or the operation completes.
 */
export function useLoadingToast() {
    const abortControllerRef = useRef<AbortController | null>(null);

    const executeWithToast = useCallback(async <T,>(
        action: (abortSignal?: AbortSignal) => Promise<T>,
        messages: { loading: string; success: string; error: string },
        delay: number = 3000
    ): Promise<T> => {
        // Cancel any previous operation
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new AbortController
        abortControllerRef.current = new AbortController();

        try {
            return await withLoadingToastFn(
                () => action(abortControllerRef.current?.signal),
                {
                    loadingMessage: messages.loading,
                    successMessage: messages.success,
                    errorMessage: messages.error
                }
            );
        } finally {
            // Clean up after completion
            abortControllerRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return executeWithToast;
}