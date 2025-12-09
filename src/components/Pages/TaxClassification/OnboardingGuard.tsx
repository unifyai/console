"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import LoadingScreen from '@/components/Layout/LoadingScreen';
import { OnboardingStatusResponse } from '@/types/user';

interface OnboardingGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
  allowedPaths?: string[];
}

const DEFAULT_ALLOWED_PATHS = ["/login", "/onboarding", "/api", "/_next", "/favicon.ico"];
const ONBOARDING_STATUS_CACHE_KEY = 'onboarding-status';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function OnboardingGuard({ 
  children, 
  redirectTo = "/onboarding",
  allowedPaths = DEFAULT_ALLOWED_PATHS
}: OnboardingGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Track if we've already checked onboarding status this session
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const isAllowedPath = allowedPaths.some(path => 
      pathname.startsWith(path) || pathname === path
    );

    if (isAllowedPath) {
      setIsLoading(false);
      setNeedsOnboarding(false);
      if (isRedirecting) setIsRedirecting(false);
      return;
    }

    if (isRedirecting) {
      return;
    }

    // Only check once per session, not on every session object change
    if (hasChecked && status === "authenticated") {
      return;
    }

    const checkOnboardingStatus = async () => {
      if (status === "unauthenticated") {
        setIsLoading(false);
        setNeedsOnboarding(false);
        return;
      }

      if (status === "loading") {
        return;
      }

      // Mark as checked to prevent re-running
      setHasChecked(true);

      try {
        const cached = localStorage.getItem(ONBOARDING_STATUS_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          const isExpired = age > CACHE_DURATION;
          
          if (!isExpired) {
            if (!data.onboarded) {
              setNeedsOnboarding(true);
              setIsRedirecting(true);
              router.push(redirectTo);
            } else {
              setNeedsOnboarding(false);
            }
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error('Cache check failed:', error);
      }

      try {
        const response = await fetch('/api/user/onboarding-status');
        if (response.ok) {
          const data: OnboardingStatusResponse = await response.json();
          localStorage.setItem(ONBOARDING_STATUS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));

          if (!data.onboarded) {
            setNeedsOnboarding(true);
            setIsRedirecting(true);
            router.push(redirectTo);
          } else {
            setNeedsOnboarding(false);
          }
        } else {
          console.error(`API call failed with status: ${response.status}`);
          setNeedsOnboarding(false); // Allow access
        }
      } catch (error) {
        console.error('API call error:', error);
        setNeedsOnboarding(false); // Allow access on API failure
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  // Removed 'session' from deps - only care about status changes, not session object reference
  }, [status, router, redirectTo, allowedPaths, pathname, isRedirecting, hasChecked]);

  if (isLoading || status === "loading") {
    return <LoadingScreen />;
  }

  if (needsOnboarding) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

export function withOnboardingGuard<T extends object>(
  Component: React.ComponentType<T>,
  options?: {
    redirectTo?: string;
    allowedPaths?: string[];
  }
) {
  return function GuardedComponent(props: T) {
    return (
      <OnboardingGuard {...options}>
        <Component {...props} />
      </OnboardingGuard>
    );
  };
}