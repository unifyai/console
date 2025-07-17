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
            <p className="text-sm font-semibold">{title}</p>
            {description && <p className="text-sm opacity-90">{description}</p>}
        </div>
    </div>
);

// Ensure toast updates happen after the current render to avoid React warnings
const scheduleToast = <T,>(fn: () => T): T | void => {
    // React 18 StrictMode double-renders; ensure state updates occur post-render
    if (typeof queueMicrotask === 'function') {
        let result: T | undefined;
        queueMicrotask(() => { result = fn(); });
        // Return toast id synchronously if needed by caller (fallback)
        return result as T;
    }
    return setTimeout(fn, 0) as unknown as T;
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
  if ((error as Error).name === 'AbortError' || errorMessage.includes('Connection closed')) {
    return;
  }
  console.error("API Error:", error);

  let message = defaultMessage;
  if (error instanceof Error) {
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
            title="Error"
            description={message}
        />
    ),
    {
        id,
        duration: 4000,
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
 * Wraps an asynchronous action with loading, success, and error toast notifications.
 * A "loading" toast is shown only if the action takes longer than the specified delay.
 *
 * @param action The asynchronous function to execute.
 * @param messages The messages to display for loading, success, and error states.
 * @param delay The delay in milliseconds before showing the loading toast (default: 3000ms).
 * @param abortController Optional AbortController to cancel the operation.
 * @returns The result of the action.
 */
export async function withLoadingToast<T>(
    action: (abortSignal?: AbortSignal) => Promise<T>,
    messages: { loading: string; success: string; error: string },
    delay: number = 3000,
    abortController?: AbortController
): Promise<T> {
    let toastId: string | number | undefined;

    // Start a timer to show the loading toast after the specified delay
    const timer = setTimeout(() => {
        toastId = showLoadingToast(messages.loading);
    }, delay);

    try {
        const result = await action(abortController?.signal);
        
        // If the action finished before the timer, clear the timer
        clearTimeout(timer);

        // If the loading toast was shown, update it to a success message
        if (toastId) {
            showSuccessToast(messages.success, undefined, toastId);
        }
        
        return result;
    } catch (error) {
        // If the action failed, clear the timer
        clearTimeout(timer);
        
        // If the loading toast was shown, update it to an error message.
        // Otherwise, show a new error toast.
        if ((error as Error).name !== 'AbortError') {
            showErrorToast(error, messages.error, toastId);
        }
        
        // Re-throw the error so it can be handled by the calling function
        throw error;
    }
}

/**
 * Wraps an asynchronous action with immediate loading toast and delayed success notification.
 * Shows loading toast immediately, executes the action, but waits for external signal for success.
 * Returns a function to manually trigger the success toast when ready.
 *
 * @param action The asynchronous function to execute.
 * @param messages The messages to display for loading, success, and error states.
 * @param abortController Optional AbortController to cancel the operation.
 * @returns Object with result and showSuccess function.
 */
export async function withDelayedLoadingToast<T>(
    action: (abortSignal?: AbortSignal) => Promise<T>,
    messages: { loading: string; success: string; error: string },
    abortController?: AbortController
): Promise<{ result: T; showSuccess: () => void; hideLoading: () => void }> {
    // Show loading toast immediately
    const toastId = showLoadingToast(messages.loading);

    try {
        const result = await action(abortController?.signal);
        
        // Return result with functions to control toast state
        return {
            result,
            showSuccess: () => {
                showSuccessToast(messages.success, undefined, toastId);
            },
            hideLoading: () => {
                if (toastId) {
                    toast.dismiss(toastId);
                }
            }
        };
    } catch (error) {
        // If the action failed, show error message
        if ((error as Error).name !== 'AbortError') {
            showErrorToast(error, messages.error, toastId);
        }
        
        // Re-throw the error so it can be handled by the calling function
        throw error;
    }
}

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
            return await withLoadingToast(action, messages, delay, abortControllerRef.current);
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