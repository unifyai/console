'use client';
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/UI/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Label } from '@/components/UI/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import BaseDialog from '@/components/Common/Dialogs/Base';
import SubmitButton from '@/components/Common/Buttons/Submit';
import { AlertTriangle } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications';
import { ProjectsActions } from '@/types/interfaces/grid';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';

interface Organization {
  id: number;
  name: string;
}

interface TransferProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
  projectActions: ProjectsActions;
  /** Whether this is currently an organization project */
  isOrgProject: boolean;
  /** Current organization ID (if org project) */
  currentOrganizationId: number | null;
  /** List of organizations the user can transfer to */
  availableOrganizations: Organization[];
  /** Callback when transfer is complete */
  onTransferComplete: () => void;
}

export const TransferProjectDialog = React.memo(function TransferProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectActions,
  isOrgProject,
  currentOrganizationId,
  availableOrganizations,
  onTransferComplete,
}: TransferProjectDialogProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState('');
  const { switchWorkspace } = useWorkspace();

  const handleTransferToOrganization = useCallback(async () => {
    if (!selectedOrgId) {
      setError('Please select an organization');
      return;
    }

    setIsTransferring(true);
    setError('');

    try {
      const orgId = parseInt(selectedOrgId, 10);
      await projectActions.transferToOrg(projectId, orgId);

      showSuccessToast('Project transferred', 'Project has been transferred to the organization');
      onTransferComplete();
      onOpenChange(false);

      // Switch to the organization workspace
      await switchWorkspace(selectedOrgId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to transfer project';
      setError(errorMsg);
      showErrorToast('Transfer failed', errorMsg);
    } finally {
      setIsTransferring(false);
    }
  }, [projectActions, projectId, selectedOrgId, onTransferComplete, onOpenChange, switchWorkspace]);

  const handleTransferToPersonal = useCallback(async () => {
    setIsTransferring(true);
    setError('');

    try {
      await projectActions.transferToPersonal(projectId);

      showSuccessToast(
        'Project transferred',
        'Project has been transferred to your personal account'
      );
      onTransferComplete();
      onOpenChange(false);

      // Switch to the personal workspace
      await switchWorkspace('personal');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to transfer project';
      setError(errorMsg);
      showErrorToast('Transfer failed', errorMsg);
    } finally {
      setIsTransferring(false);
    }
  }, [projectActions, projectId, onTransferComplete, onOpenChange, switchWorkspace]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSelectedOrgId('');
        setError('');
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  return (
    <BaseDialog
      button={<></>}
      open={open}
      setOpen={handleOpenChange}
      title={`Transfer to ${isOrgProject ? 'Personal' : 'Organization'}`}
      body={
        <div className="space-y-6 pt-4">
          {isOrgProject ? (
            // Transfer from Organization to Personal
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning: Destructive Operation</AlertTitle>
                <AlertDescription>
                  Transferring this project to your personal account will:
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>Remove all team sharing and access grants</li>
                    <li>Make you the sole owner of this project</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <p className="text-body-sm text-muted-foreground">
                The project will be moved from the organization to your personal account. All
                collaboration settings will be removed.
              </p>
            </>
          ) : (
            // Transfer from Personal to Organization
            <>
              <div className="space-y-2">
                <Label className="text-label">Select Organization</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrganizations.map((org) => (
                      <SelectItem key={org.id} value={org.id.toString()}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>What happens when you transfer</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>You will retain Owner access to this project</li>
                    <li>The project can be shared with members and teams</li>
                    <li>Organization admins may also gain access</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          )}

          {error && <p className="text-caption text-destructive">{error}</p>}
        </div>
      }
      footer={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isTransferring}
          >
            Cancel
          </Button>
          {isOrgProject ? (
            <SubmitButton
              text="Transfer to Personal"
              onClick={handleTransferToPersonal}
              loading={isTransferring}
              variant="destructive"
            />
          ) : (
            <SubmitButton
              text="Transfer to Organization"
              onClick={handleTransferToOrganization}
              loading={isTransferring}
              disabled={!selectedOrgId}
            />
          )}
        </div>
      }
    />
  );
});
