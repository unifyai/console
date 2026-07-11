'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Loader2 } from 'lucide-react';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import { DefaultModelPicker } from './DefaultModelPicker';

interface AssistantBrainManagerProps {
  isOpen: boolean;
  onClose: () => void;
  assistant: Assistant;
  assistantActions: AssistantActions;
  onSuccess: () => void;
  canWrite?: boolean;
}

/**
 * Standalone modal for brain / model configuration.
 * Currently hosts the default (actor) model picker; fast-brain and slow-brain
 * controls will land here as independent settings.
 */
export function AssistantBrainManager({
  isOpen,
  onClose,
  assistant,
  assistantActions,
  onSuccess,
  canWrite = true,
}: AssistantBrainManagerProps) {
  const [model, setModel] = React.useState<string | null>(assistant.defaultModel ?? null);
  const [reasoningEffort, setReasoningEffort] = React.useState<string | null>(
    assistant.defaultReasoningEffort ?? null
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setModel(assistant.defaultModel ?? null);
    setReasoningEffort(assistant.defaultReasoningEffort ?? null);
    setError(null);
  }, [assistant.defaultModel, assistant.defaultReasoningEffort, isOpen]);

  const isDirty =
    (model ?? null) !== (assistant.defaultModel ?? null) ||
    (reasoningEffort ?? null) !== (assistant.defaultReasoningEffort ?? null);

  const handleSave = async () => {
    if (!canWrite || !isDirty) {
      onClose();
      return;
    }
    setIsSaving(true);
    setError(null);
    const result = await assistantActions.assistant.update(assistant.agentId, {
      defaultModel: model,
      defaultReasoningEffort: reasoningEffort,
    });
    setIsSaving(false);
    if (result.detail) {
      setError(typeof result.detail === 'string' ? result.detail : 'Failed to update model');
      return;
    }
    onSuccess();
    onClose();
  };

  const assistantName = assistantDisplayName(assistant);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Brain</DialogTitle>
          <DialogDescription>
            Choose how {assistantName} thinks by default. Fast-brain and slow-brain controls will
            appear here soon.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <DefaultModelPicker
            model={model}
            reasoningEffort={reasoningEffort}
            onChange={(nextModel, nextEffort) => {
              setModel(nextModel);
              setReasoningEffort(nextEffort);
            }}
            disabled={!canWrite || isSaving}
          />
          {error && <p className="text-body mt-2 text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          {canWrite && (
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !isDirty}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
