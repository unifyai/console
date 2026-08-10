'use client';

import React from 'react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import BaseDialog from '@/components/Common/Dialogs/Base';
import SubmitButton from '@/components/Common/Buttons/Submit';
import { isImeComposing } from '@/utils/keyboard';

interface RenameProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (newName: string) => Promise<void>;
  currentName: string;
}

// Backend validation regex: ^[a-zA-Z0-9_\-/]+$
const PROJECT_NAME_REGEX = /^[a-zA-Z0-9_\-/]+$/;

export const RenameProjectDialog = React.memo(function RenameProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  currentName,
}: RenameProjectDialogProps) {
  const [projectName, setProjectName] = React.useState(currentName);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [validationError, setValidationError] = React.useState('');

  // Update project name when currentName changes
  React.useEffect(() => {
    if (open) {
      setProjectName(currentName);
      setError('');
      setValidationError('');
    }
  }, [open, currentName]);

  const validateProjectName = React.useCallback((name: string) => {
    if (!name) {
      setValidationError('');
      return true;
    }

    if (!PROJECT_NAME_REGEX.test(name)) {
      setValidationError(
        'Project name can only contain letters, numbers, underscores, hyphens, and forward slashes'
      );
      return false;
    }

    if (name.length > 50) {
      setValidationError('Project name must be less than 50 characters');
      return false;
    }

    setValidationError('');
    return true;
  }, []);

  const handleProjectNameChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setProjectName(newName);
      validateProjectName(newName);
      setError(''); // Clear any previous submit errors
    },
    [validateProjectName]
  );

  const handleSubmit = React.useCallback(async () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    if (!validateProjectName(projectName)) {
      return;
    }

    if (projectName.trim() === currentName) {
      setError('Please enter a different name');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(projectName.trim());
      // Dialog will be closed by parent component on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename project');
    } finally {
      setIsSubmitting(false);
    }
  }, [projectName, currentName, onSubmit, validateProjectName]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (isImeComposing(e)) return;
      if (e.key === 'Enter' && !isSubmitting && !validationError) {
        handleSubmit();
      }
    },
    [handleSubmit, isSubmitting, validationError]
  );

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset to current name when closing
        setProjectName(currentName);
        setError('');
        setValidationError('');
      }
      onOpenChange(newOpen);
    },
    [currentName, onOpenChange]
  );

  const displayError = error || validationError;

  return (
    <BaseDialog
      button={<></>}
      open={open}
      setOpen={handleOpenChange}
      title={`Rename Project "${currentName}"`}
      body={
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="project-rename" className="text-label">
              New Project Name
            </Label>
            <Input
              id="project-rename"
              value={projectName}
              onChange={handleProjectNameChange}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Enter new project name..."
              className={validationError ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            <p className="text-caption text-muted-foreground">
              Allowed: letters, numbers, underscores, hyphens, and forward slashes
            </p>
          </div>
          {displayError && <p className="text-caption text-destructive">{displayError}</p>}
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
            text="Rename"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={
              !projectName.trim() || !!validationError || projectName.trim() === currentName
            }
            className="h-8"
          />
        </div>
      }
    />
  );
});
