'use client';

/**
 * useBillingProfile – Hook for billing profile state management.
 *
 * Owns:
 *   - Fetching the billing profile from the server
 *   - Saving updates (via server action)
 *   - Alert state (success / error messages)
 *   - Mapping API response → camelCase form data
 *
 * Components consume the return value for display and editing.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { BillingActions, BillingProfileData } from '@/types/billing';
import { isBillingError } from '@/types/billing';

// =============================================================================
// Return type
// =============================================================================

export interface UseBillingProfileReturn {
  /** Profile data ready for form initialisation (null while loading) */
  initialData: Partial<BillingProfileData> | undefined;
  /** True while the initial fetch is in flight */
  loading: boolean;
  /** True while a save is in flight */
  saving: boolean;
  /** Transient alert shown after save / error */
  alert: { type: 'success' | 'error'; message: string } | null;
  /** Save updated profile data */
  handleSave: (data: BillingProfileData) => Promise<void>;
  /** Dismiss the current alert */
  clearAlert: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useBillingProfile(
  actions: BillingActions,
  onSaved?: () => void
): UseBillingProfileReturn {
  // Raw profile from API (already camelCase via interceptor)
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    try {
      const result = await actions.getProfile();
      if (!isBillingError(result)) {
        setProfile(result as Record<string, any>);
      }
    } catch (error) {
      console.error('Error fetching billing profile:', error);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── Auto-dismiss alerts ────────────────────────────────────────────────
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // ── Derived initial data for form ──────────────────────────────────────
  const initialData = useMemo((): Partial<BillingProfileData> | undefined => {
    if (!profile) return undefined;
    const addr = profile.billingAddress;
    return {
      name: profile.name || '',
      billingEmail: profile.billingEmail || '',
      taxId: profile.taxId || '',
      taxIdType: profile.taxIdType || '',
      billingAddress: {
        line1: addr?.line1 || '',
        line2: addr?.line2 || '',
        city: addr?.city || '',
        state: addr?.state || '',
        country: addr?.country || '',
        postalCode: addr?.postalCode || '',
      },
    };
  }, [profile]);

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(
    async (data: BillingProfileData) => {
      setSaving(true);
      setAlert(null);

      try {
        const result = await actions.updateProfile(data);

        if (isBillingError(result)) {
          throw new Error(result.detail || 'Failed to update billing profile.');
        }

        await fetchProfile();
        setAlert({ type: 'success', message: 'Billing profile updated successfully!' });
        onSaved?.();
      } catch (error) {
        console.error('Error saving billing profile:', error);
        setAlert({
          type: 'error',
          message: (error as Error).message || 'Failed to update billing profile.',
        });
      } finally {
        setSaving(false);
      }
    },
    [actions, fetchProfile, onSaved]
  );

  const clearAlert = useCallback(() => setAlert(null), []);

  return {
    initialData,
    loading,
    saving,
    alert,
    handleSave,
    clearAlert,
  };
}
