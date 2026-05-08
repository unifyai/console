'use client';

import { FileText, Info, Pencil } from 'lucide-react';
import { Button } from '../../UI/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../UI/dialog';
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
}

// =============================================================================
// Component
// =============================================================================

/**
 * Billing-profile section, shared between CREDITS and METERED variants.
 *
 * Renders the section header + an "Edit" button that opens a dialog
 * wrapping the existing ``BillingProfile`` form. Personal workspaces
 * also see a hint pointing them at the org-creation flow if they need
 * business tax invoicing.
 */
export const BillingProfileSection = ({
  actions,
  orgContext,
  isProfileDialogOpen,
  setIsProfileDialogOpen,
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
            : 'Your billing details and tax information'}
        </p>
        {!orgContext && (
          <p className="text-caption mt-2 flex items-start gap-1.5 text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Personal workspaces use individual tax treatment. If you need business tax invoicing,{' '}
              <a href="/organizations" className="text-primary underline">
                create an organization
              </a>
              .
            </span>
          </p>
        )}
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

    <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Billing Profile</DialogTitle>
          <DialogDescription>
            {orgContext
              ? `Update billing details for ${orgContext.orgName}`
              : 'Update your billing details and tax information'}
          </DialogDescription>
        </DialogHeader>
        <BillingProfile actions={actions} onClose={() => setIsProfileDialogOpen(false)} />
      </DialogContent>
    </Dialog>
  </section>
);
