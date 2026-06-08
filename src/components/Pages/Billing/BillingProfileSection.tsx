'use client';

import { FileText, Pencil } from 'lucide-react';
import { Button } from '../../UI/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../UI/sheet';
import BillingProfile from './BillingProfile';
import type { BillingActions, BillingOrgContext } from '@/types/billing';

// =============================================================================
// Props
// =============================================================================

export interface BillingProfileSectionProps {
  actions: BillingActions;
  orgContext?: BillingOrgContext | null;
  isProfileDialogOpen: boolean;
  setIsProfileDialogOpen: (open: boolean) => void;
  /** Called after the profile is saved so the page can refresh derived state
   * (e.g. the subscribe-time billing-address gate). */
  onProfileSaved?: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Billing-profile section, shared between CREDITS and METERED variants.
 *
 * Renders the section header + an "Edit" button that opens a right-side
 * slide-out panel wrapping the existing ``BillingProfile`` form. Personal
 * workspaces
 * also see a hint noting that adding a tax ID to the profile switches
 * them to business tax treatment (``resolve_is_business`` keys off the
 * billing profile's ``tax_id``, not org membership).
 */
export const BillingProfileSection = ({
  actions,
  orgContext,
  isProfileDialogOpen,
  setIsProfileDialogOpen,
  onProfileSaved,
}: BillingProfileSectionProps) => (
  <section className="space-y-4" data-testid="billing-profile-section">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-h3 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Billing Profile
        </h2>
        <p className="text-body-muted mt-1">
          {orgContext
            ? `Billing details for ${orgContext.orgName}`
            : 'Your billing and tax information'}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsProfileDialogOpen(true)}
        className="gap-1.5"
      >
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
    </div>

    <Sheet open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit Billing Profile</SheetTitle>
          <SheetDescription>
            {orgContext
              ? `Update billing details for ${orgContext.orgName}`
              : 'Update your billing details and tax information'}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <BillingProfile
            actions={actions}
            onClose={() => setIsProfileDialogOpen(false)}
            onSaved={onProfileSaved}
          />
        </div>
      </SheetContent>
    </Sheet>
  </section>
);
