'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader } from '@/components/Common/Loader';
import { Button } from '../../UI/button';
import BillingProfileForm from './BillingProfileForm';
import { useBillingProfile } from '@/hooks/Billing/useBillingProfile';
import type { BillingActions, BillingProfileData } from '@/types/billing';

interface BillingProfileProps {
  /** Server-action-bound billing actions */
  actions: BillingActions;
  /** Callback when the dialog should close (e.g. after save or cancel) */
  onClose?: () => void;
  /** Callback fired after a successful save, before closing — lets the parent
   * refresh derived state (e.g. the subscribe-time billing-address gate). */
  onSaved?: () => void;
}

const BillingProfile = ({ actions, onClose, onSaved }: BillingProfileProps) => {
  const [isFormValid, setIsFormValid] = useState(false);
  const formRef = useRef<{ submit: () => void } | null>(null);

  // On a successful save: let the parent refresh (so the address gate lifts
  // immediately) and then close the dialog.
  const handleSaved = useCallback(() => {
    onSaved?.();
    onClose?.();
  }, [onSaved, onClose]);

  const { initialData, loading, saving, alert, handleSave } = useBillingProfile(
    actions,
    handleSaved
  );

  const onFormSubmit = async (data: BillingProfileData) => {
    await handleSave(data);
  };

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex w-full items-center justify-center gap-2 py-8">
        <Loader size={20} />
        <p className="text-body-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <BillingProfileForm
        actions={actions}
        onSubmit={onFormSubmit}
        onValidationChange={setIsFormValid}
        isLoading={saving}
        error={alert?.type === 'error' ? alert.message : undefined}
        initialData={initialData}
        ref={formRef as any}
      />

      <div className="mt-6 flex justify-end space-x-4 border-t pt-4">
        {onClose && (
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button onClick={() => formRef.current?.submit()} disabled={!isFormValid || saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export default BillingProfile;
