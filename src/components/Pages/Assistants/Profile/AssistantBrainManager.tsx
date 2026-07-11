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
 * Modal for brain / model configuration: actor default and slow brain.
 * Fast-brain controls will land here later.
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
  const [slowBrainModel, setSlowBrainModel] = React.useState<string | null>(
    assistant.slowBrainModel ?? null
  );
  const [slowBrainReasoningEffort, setSlowBrainReasoningEffort] = React.useState<string | null>(
    assistant.slowBrainReasoningEffort ?? null
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setModel(assistant.defaultModel ?? null);
    setReasoningEffort(assistant.defaultReasoningEffort ?? null);
    setSlowBrainModel(assistant.slowBrainModel ?? null);
    setSlowBrainReasoningEffort(assistant.slowBrainReasoningEffort ?? null);
    setError(null);
  }, [
    assistant.defaultModel,
    assistant.defaultReasoningEffort,
    assistant.slowBrainModel,
    assistant.slowBrainReasoningEffort,
    isOpen,
  ]);

  const isDirty =
    (model ?? null) !== (assistant.defaultModel ?? null) ||
    (reasoningEffort ?? null) !== (assistant.defaultReasoningEffort ?? null) ||
    (slowBrainModel ?? null) !== (assistant.slowBrainModel ?? null) ||
    (slowBrainReasoningEffort ?? null) !== (assistant.slowBrainReasoningEffort ?? null);

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
      slowBrainModel,
      slowBrainReasoningEffort,
    });
    setIsSaving(false);
    if (result.detail) {
      setError(typeof result.detail === 'string' ? result.detail : 'Failed to update models');
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
            Choose how {assistantName} thinks for actor work and conversational slow-brain turns.
            Fast-brain controls will appear here later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <DefaultModelPicker
            id="actorDefaultModel"
            label="Default model"
            usage="actor"
            creditUnit="task"
            tooltip="The model this teammate uses by default for actor / tool-loop work. Premium models are substantially more capable but cost more per task. Credit figures are rough per-task estimates — real tasks vary widely."
            model={model}
            reasoningEffort={reasoningEffort}
            onChange={(nextModel, nextEffort) => {
              setModel(nextModel);
              setReasoningEffort(nextEffort);
            }}
            disabled={!canWrite || isSaving}
          />
          <DefaultModelPicker
            id="slowBrainModel"
            label="Slow brain"
            usage="slow_brain"
            creditUnit="message"
            tooltip="The model used for ConversationManager slow-brain turns (chat, proactive speech, and related conversational reasoning). Credit figures are rough per-message estimates from token rates for a typical turn."
            model={slowBrainModel}
            reasoningEffort={slowBrainReasoningEffort}
            onChange={(nextModel, nextEffort) => {
              setSlowBrainModel(nextModel);
              setSlowBrainReasoningEffort(nextEffort);
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
