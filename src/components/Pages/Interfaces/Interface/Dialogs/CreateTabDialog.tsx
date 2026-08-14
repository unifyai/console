'use client';

import React from 'react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { IconSelector } from '@/components/UI/icon-selector';
import BaseDialog from '@/components/Common/Dialogs/Base';
import SubmitButton from '@/components/Common/Buttons/Submit';
import { isImeComposing } from '@/utils/keyboard';

interface CreateTabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, icon?: string) => Promise<void>;
}

export const CreateTabDialog = React.memo(function CreateTabDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateTabDialogProps) {
  const [tabName, setTabName] = React.useState('');
  const [tabIcon, setTabIcon] = React.useState<string | undefined>('file-text'); // Default icon
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = React.useCallback(async () => {
    if (!tabName.trim()) {
      setError('Tab name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(tabName.trim(), tabIcon);
      // Reset form on success
      setTabName('');
      setTabIcon('file-text');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tab');
    } finally {
      setIsSubmitting(false);
    }
  }, [tabName, tabIcon, onSubmit]);

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
        setTabName('');
        setTabIcon('file-text');
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
      title="Create New Tab"
      body={
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="tab-name" className="text-label">
              Tab Name
            </Label>
            <Input
              id="tab-name"
              value={tabName}
              onChange={(e) => {
                setTabName(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Enter tab name..."
            />
          </div>
          <div className="space-y-2">
            <Label className="text-label">Tab Icon</Label>
            <IconSelector value={tabIcon as any} onValueChange={setTabIcon} />
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
            disabled={!tabName.trim()}
            className="h-8"
          />
        </div>
      }
    />
  );
});
