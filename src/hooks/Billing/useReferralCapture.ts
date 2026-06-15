'use client';

/**
 * useReferralCapture
 *
 * Captures a `?ref=CODE` referral code and attributes the signed-in user to
 * the referrer:
 *   1. Reads `?ref=CODE` from the URL on mount (or a previously stored code)
 *   2. Persists it in localStorage so it survives the OAuth round-trip and
 *      onboarding redirects
 *   3. Once the session is authenticated, attributes it via the backend
 *      (idempotent — the reward itself is granted later, once the friend
 *      subscribes and reaches the qualifying real spend)
 *
 * Mirrors useCreditGrantLink. Renders no UI.
 */

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

const STORAGE_KEY = 'pending_referral_code';

export interface ReferralAttributionResult {
  attributed: boolean;
  message?: string;
  code?: string;
  error?: string;
}

export function getStoredReferral(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredReferral(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

export function clearStoredReferral(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function attributeReferral(code: string): Promise<ReferralAttributionResult> {
  try {
    const response = await fetch('/api/user/referral/attribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        attributed: false,
        error: data?.detail || data?.message || `Attribution failed (${response.status})`,
      };
    }
    return {
      attributed: Boolean(data?.attributed),
      message: data?.message,
      code: data?.code,
    };
  } catch (error) {
    return {
      attributed: false,
      error: error instanceof Error ? error.message : 'Network error applying referral',
    };
  }
}

export function useReferralCapture(): void {
  const searchParams = useSearchParams();
  const { status } = useSession();

  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const hasAttributedRef = useRef(false);

  // 1. On mount: read code from URL or localStorage, persist, clean the URL.
  useEffect(() => {
    const urlRef = searchParams?.get('ref') ?? null;
    const storedRef = getStoredReferral();

    if (urlRef) {
      setStoredReferral(urlRef);
      setPendingCode(urlRef);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('ref');
        window.history.replaceState({}, document.title, url.toString());
      }
    } else if (storedRef) {
      setPendingCode(storedRef);
    }
  }, [searchParams]);

  // 2. Once authenticated, attribute the pending code exactly once.
  useEffect(() => {
    if (!pendingCode || status !== 'authenticated' || hasAttributedRef.current) {
      return;
    }
    hasAttributedRef.current = true;
    attributeReferral(pendingCode).then((result) => {
      // Always clear: success, "already attributed", or a hard error are all
      // terminal — we never want to loop retrying a bad code.
      clearStoredReferral();
      setPendingCode(null);
      if (result.attributed && result.message) {
        toast.success(result.message);
      }
    });
  }, [pendingCode, status]);
}
