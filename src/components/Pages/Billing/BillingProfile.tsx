'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent } from '../../UI/card';
import { Button } from '../../UI/button';
import { Loader2 } from 'lucide-react';
import BillingProfileForm, {
  type BillingProfileData,
  toApiPayload,
  fromApiResponse,
} from './BillingProfileForm';

interface BillingProfileProps {
  /** Whether the component is in editing mode (controlled externally) */
  isEditing?: boolean;
  /** Callback when edit mode changes */
  onEditingChange?: (editing: boolean) => void;
}

/** camelCase shape of the API response (after conversion) */
interface BillingProfileState {
  individualName?: string | null;
  businessName?: string | null;
  billingEmail?: string | null;
  taxId?: string | null;
  taxIdType?: string | null;
  billingAddress?: Record<string, string> | null;
}

const BillingProfile = ({ isEditing, onEditingChange }: BillingProfileProps) => {
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = isEditing ?? internalEditing;
  const setEditing = onEditingChange ?? setInternalEditing;

  const [profile, setProfile] = useState<BillingProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const formRef = useRef<{ submit: () => void } | null>(null);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/billing/profile');
      if (response.ok) {
        const raw = await response.json();
        // Normalise the backend's snake_case response to camelCase
        setProfile({
          individualName: raw.individual_name ?? raw.individualName,
          businessName: raw.business_name ?? raw.businessName,
          billingEmail: raw.billing_email ?? raw.billingEmail,
          taxId: raw.tax_id ?? raw.taxId,
          taxIdType: raw.tax_id_type ?? raw.taxIdType,
          billingAddress: raw.billing_address ?? raw.billingAddress,
        });
      }
    } catch (error) {
      console.error('Error fetching billing profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const handleCancel = () => {
    setEditing(false);
    setAlert(null);
  };

  const handleSave = async (data: BillingProfileData) => {
    setSaving(true);
    setAlert(null);

    try {
      const response = await fetch('/api/billing/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toApiPayload(data)),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.detail || errorData?.error || 'Failed to update billing profile.'
        );
      }

      await fetchProfile();
      setEditing(false);
      setAlert({ type: 'success', message: 'Billing profile updated successfully!' });
    } catch (error) {
      console.error('Error saving billing profile:', error);
      setAlert({
        type: 'error',
        message: (error as Error).message || 'Failed to update billing profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const initialData = useMemo((): Partial<BillingProfileData> | undefined => {
    if (!profile) return undefined;
    const addr = profile.billingAddress;
    return {
      individualName: profile.individualName || '',
      billingEmail: profile.billingEmail || '',
      taxId: profile.taxId || '',
      taxIdType: profile.taxIdType || '',
      billingAddress: {
        line1: addr?.line1 || '',
        line2: addr?.line2 || '',
        city: addr?.city || '',
        state: addr?.state || '',
        country: addr?.country || '',
        postalCode: addr?.postal_code || addr?.postalCode || '',
      },
    };
  }, [profile]);

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex w-full items-center justify-center gap-2 py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-body-muted">Loading...</p>
      </div>
    );
  }

  // ── Editing state ────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="w-full flex flex-col gap-2">
          <BillingProfileForm
            onSubmit={handleSave}
            onValidationChange={setIsFormValid}
            isLoading={saving}
            error={alert?.type === 'error' ? alert.message : undefined}
            initialData={initialData}
            ref={formRef as any}
          />

          <div className="mt-6 flex justify-end space-x-4 border-t pt-4">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={() => formRef.current?.submit()}
              disabled={!isFormValid || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
      </div>
    );
  }

  return null;
};

export default BillingProfile;
