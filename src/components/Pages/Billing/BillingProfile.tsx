'use client';

import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../UI/button';
import BillingProfileForm from './BillingProfileForm';
import { useBillingProfile } from '@/hooks/Billing/useBillingProfile';
import type { BillingActions, BillingProfileData } from '@/types/billing';

interface BillingProfileProps {
  /** Server-action-bound billing actions */
  actions: BillingActions;
  /** Whether the component is in editing mode (controlled externally) */
  isEditing?: boolean;
  /** Callback when edit mode changes */
  onEditingChange?: (editing: boolean) => void;
}

const BillingProfile = ({ actions, isEditing, onEditingChange }: BillingProfileProps) => {
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = isEditing ?? internalEditing;
  const setEditing = onEditingChange ?? setInternalEditing;

  const [isFormValid, setIsFormValid] = useState(false);
  const formRef = useRef<{ submit: () => void } | null>(null);

  const { initialData, loading, saving, alert, handleSave } = useBillingProfile(
    actions,
    () => setEditing(false)
  );

  const onFormSubmit = async (data: BillingProfileData) => {
    await handleSave(data);
  };

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
            actions={actions}
            onSubmit={onFormSubmit}
            onValidationChange={setIsFormValid}
            isLoading={saving}
            error={alert?.type === 'error' ? alert.message : undefined}
            initialData={initialData}
            ref={formRef as any}
          />

          <div className="mt-6 flex justify-end space-x-4 border-t pt-4">
            <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
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
