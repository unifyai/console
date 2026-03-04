'use client';

import { ShieldCheck, Trash2 } from 'lucide-react';
import SecuritySettingsPanel, { MfaSettingsActions } from './SecuritySettingsPanel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/alert-dialog';
import { Button } from '@/components/UI/button';

interface OrganizationSecurityTabProps {
  organizationId: number;
  organizationName: string;
  canEdit: boolean;
  canDelete: boolean;
  onDeleteOrg: () => void;
  mfaSettingsActions?: MfaSettingsActions;
}

const OrganizationSecurityTab = ({
  organizationId,
  organizationName,
  canEdit,
  canDelete,
  onDeleteOrg,
  mfaSettingsActions,
}: OrganizationSecurityTabProps) => {
  return (
    <div className="flex flex-col gap-6 p-6" data-testid="organization-security-tab">

      {/* MFA Enforcement */}
      {mfaSettingsActions && (
        <SecuritySettingsPanel
          organizationId={organizationId}
          canEdit={canEdit}
          actions={mfaSettingsActions}
        />
      )}

      {/* Danger Zone */}
      {canDelete && (
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <h3 className="text-h3 text-destructive">Danger Zone</h3>
            <p className="mt-1 text-caption">
              Deleting the organization is irreversible. All data and members associated with this
              organization will be permanently removed.
            </p>
            <div className="mt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Organization
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                    <AlertDialogDescription>
                      You are about to delete <strong>{organizationName}</strong>. This is an
                      irreversible action. All data and members associated with this organization
                      will be removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDeleteOrg}
                      className="hover:bg-destructive/90 bg-destructive text-destructive-foreground"
                    >
                      Proceed
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationSecurityTab;

