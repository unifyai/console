"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Global auth error interceptor
 * Detects 401 responses via React Query's global error handler
 * Shows a modal prompting user to re-authenticate
 */
export function AuthErrorBoundary({ children }: { children: React.ReactNode }) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Use React Query's global error handler instead of wrapping fetch
    // This preserves request deduplication and doesn't interfere with DevTools
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') {
        const error = event.action.error as any;
        const errorMsg = error?.message || '';
        
        // Ignore cancellation errors (AbortError, "Connection closed", etc.)
        // These are expected when requests are cancelled and should not trigger error UI
        if (
          error?.name === 'AbortError' || 
          error?.name === 'CancelledError' ||
          /abort|cancelled|connection closed/i.test(errorMsg)
        ) {
          return; // Silently ignore cancellations
        }
        
        // Check if this is a 401 auth error
        if (error?.status === 401 || error?.response?.status === 401) {
          console.error('🔒 Authentication expired detected via query error');
          setShowAuthModal(true);
        }
        
        // Also check fetch errors that might be 401
        if (error?.message?.includes('401') || error?.statusCode === 401) {
          console.error('🔒 Authentication failed (401)');
          setShowAuthModal(true);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  const handleReLogin = async () => {
    setShowAuthModal(false);
    // Sign out and redirect to login
    await signOut({ callbackUrl: '/login' });
  };

  const handleRetry = () => {
    setShowAuthModal(false);
    // Just reload the page, might fix transient auth issues
    window.location.reload();
  };

  if (!showAuthModal) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {/* Auth Error Modal - Overlay that blocks interaction */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
        <div className="bg-background border border-destructive rounded-lg shadow-2xl p-8 max-w-md mx-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Session Expired</h2>
              <p className="text-sm text-muted-foreground">Authentication Required</p>
            </div>
          </div>
          
          <p className="text-muted-foreground mb-6">
            Your session has expired. Please log in again to continue using the application.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleReLogin}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors font-medium"
            >
              Log In Again
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

