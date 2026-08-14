'use client';

import React from 'react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { IconSelector } from '@/components/UI/icon-selector';
import BaseDialog from '@/components/Common/Dialogs/Base';
import SubmitButton from '@/components/Common/Buttons/Submit';
import { isImeComposing } from '@/utils/keyboard';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, icon?: string) => Promise<void>;
  error?: string;
}

// Backend validation regex: ^[a-zA-Z0-9_\-/]+$
const PROJECT_NAME_REGEX = /^[a-zA-Z0-9_\-/]+$/;

export const CreateProjectDialog = React.memo(function CreateProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  error: externalError,
}: CreateProjectDialogProps) {
  const [projectName, setProjectName] = React.useState('');
  const [projectIcon, setProjectIcon] = React.useState<string | undefined>('folder'); // Default icon
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [internalError, setInternalError] = React.useState('');
  const [validationError, setValidationError] = React.useState('');

  const error = externalError || internalError || validationError;

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
      setInternalError(''); // Clear any previous submit errors
    },
    [validateProjectName]
  );

  const handleSubmit = React.useCallback(async () => {
    if (!projectName.trim()) {
      setInternalError('Project name is required');
      return;
    }

    if (!validateProjectName(projectName)) {
      return;
    }

    setIsSubmitting(true);
    setInternalError('');

    try {
      await onSubmit(projectName.trim(), projectIcon);
      // Reset form on success
      setProjectName('');
      setProjectIcon('folder');
      setValidationError('');
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  }, [projectName, projectIcon, onSubmit, validateProjectName]);

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
        // Clear form when closing
        setProjectName('');
        setProjectIcon('folder');
        setInternalError('');
        setValidationError('');
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
      title="Create New Project"
      body={
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-label">
              Project Name
            </Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={handleProjectNameChange}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Enter project name..."
              className={validationError ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            <p className="text-caption text-muted-foreground">
              Allowed: letters, numbers, underscores, hyphens, and forward slashes
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-label">Project Icon</Label>
            <IconSelector value={projectIcon as any} onValueChange={setProjectIcon} />
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
            disabled={!projectName.trim() || !!validationError}
            className="h-8"
          />
        </div>
      }
    />
  );
});
