'use client';

import React from 'react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { IconSelector } from '@/components/UI/icon-selector';
import BaseDialog from '@/components/Common/Dialogs/Base';
import SubmitButton from '@/components/Common/Buttons/Submit';
import { isImeComposing } from '@/utils/keyboard';

interface CreateInterfaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, icon?: string) => Promise<void>;
  projectName: string;
}

export const CreateInterfaceDialog = React.memo(function CreateInterfaceDialog({
  open,
  onOpenChange,
  onSubmit,
  projectName,
}: CreateInterfaceDialogProps) {
  const [interfaceName, setInterfaceName] = React.useState('');
  const [interfaceIcon, setInterfaceIcon] = React.useState<string | undefined>('layout-grid'); // Default icon
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = React.useCallback(async () => {
    if (!interfaceName.trim()) {
      setError('Interface name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(interfaceName.trim(), interfaceIcon);
      // Reset form on success
      setInterfaceName('');
      setInterfaceIcon('layout-grid');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create interface');
    } finally {
      setIsSubmitting(false);
    }
  }, [interfaceName, interfaceIcon, onSubmit]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (isImeComposing(e)) return;
      if (e.key === 'Enter' && !isSubmitting) {
        handleSubmit();
      }
    },
    [handleSubmit, isSubmitting]
  );

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Clear form when closing
        setInterfaceName('');
        setInterfaceIcon('layout-grid');
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
      title={`Create Interface in "${projectName}"`}
      body={
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="interface-name" className="text-label">
              Interface Name
            </Label>
            <Input
              id="interface-name"
              value={interfaceName}
              onChange={(e) => {
                setInterfaceName(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Enter interface name..."
            />
          </div>
          <div className="space-y-2">
            <Label className="text-label">Interface Icon</Label>
            <IconSelector value={interfaceIcon as any} onValueChange={setInterfaceIcon} />
          </div>
          {error && <p className="text-caption text-destructive">{error}</p>}
        </div>
      }
      footer={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="h-8"
          >
            Cancel
          </Button>
          <SubmitButton
            text="Create"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!interfaceName.trim()}
            className="h-8"
          />
        </div>
      }
    />
  );
});
