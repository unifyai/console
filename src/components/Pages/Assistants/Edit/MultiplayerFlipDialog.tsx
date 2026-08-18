import * as React from 'react';
import type { Assistant, AssistantFormData } from '@/types/assistants/assistant';
import type { UseFormReturn } from 'react-hook-form';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/alert-dialog';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Dices, Loader2, Users } from 'lucide-react';
import { flipCoordinatorMultiplayer } from '@/lib/client/coordinator';
import { COORDINATOR_DISPLAY_NAME } from '@/lib/assistants/displayName';
import { createAvailableUnityProfile } from '@/utils/assistants/unity-profile-randomizer';

interface MultiplayerFlipDialogProps {
  assistant: Assistant;
  formMethods: UseFormReturn<AssistantFormData>;
  /** Called after a successful flip so the parent can refetch and re-render. */
  onFlipped: () => void;
  /**
   * Lowercased display names ("first surname") already in use in this
   * workspace, so the dice roll lands on an available identity. The server
   * enforces uniqueness regardless; this only steers the suggestion.
   */
  takenDisplayNames?: readonly string[];
  /** Lowercased first names in use — soft-avoided so Slack routing tokens
   *  and spoken references stay unambiguous too. */
  takenFirstNames?: readonly string[];
  disabled?: boolean;
}

/**
 * The one-way multiplayer flip ceremony.
 *
 * Rendered only for single-player coordinators. Collects the twin's outward
 * name here; voice (and avatar) come from the edit form's current selection,
 * so users pick those with the full preview UI before confirming. The flip
 * retires the shared pool contact details, provisions a dedicated email
 * address, and cannot be reverted.
 */
export function MultiplayerFlipDialog({
  assistant,
  formMethods,
  onFlipped,
  takenDisplayNames = [],
  takenFirstNames = [],
  disabled = false,
}: MultiplayerFlipDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [firstName, setFirstName] = React.useState('');
  const [surname, setSurname] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isFlipping, setIsFlipping] = React.useState(false);

  const trimmedFirstName = firstName.trim();
  const nameInvalid =
    !trimmedFirstName || trimmedFirstName.toLowerCase() === COORDINATOR_DISPLAY_NAME.toLowerCase();

  const handleConfirm = async () => {
    if (nameInvalid || isFlipping) return;
    setError(null);
    setIsFlipping(true);
    try {
      const values = formMethods.getValues();
      const voiceId = values.voiceId || assistant.voiceId;
      const voiceProvider = values.voiceProvider || assistant.voiceProvider;
      if (!voiceId || !voiceProvider) {
        setError('Pick a voice in the edit form first.');
        return;
      }
      const result = await flipCoordinatorMultiplayer(assistant.agentId, {
        firstName: trimmedFirstName,
        surname: surname.trim() || null,
        voiceId,
        voiceProvider,
        profilePhoto: values.profilePhotoUrl || null,
      });
      if (result && typeof result === 'object' && 'detail' in result) {
        setError(String((result as { detail: unknown }).detail));
        return;
      }
      setIsOpen(false);
      onFlipped();
    } finally {
      setIsFlipping(false);
    }
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!isFlipping) {
          setIsOpen(open);
          if (!open) setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-testid="multiplayer-flip-trigger"
        >
          <Users className="mr-2 h-4 w-4" />
          Enable multiplayer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="multiplayer-flip-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Enable multiplayer mode</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-body space-y-2">
              <p>
                Multiplayer gives your twin its own outward identity: a unique name, its own email
                address, and open channels — anyone can reach it, and it can join Google Meet and
                Microsoft Teams meetings like a hired teammate.
              </p>
              <p>
                <strong>
                  It keeps the access it has to your own workspace, so once your team can reach it,
                  they can ask it about your inbox, your files, and anything else it can see there.
                </strong>{' '}
                It is trained to decline your personal details to everyone but you — but that is an
                instruction it follows, not a boundary anything enforces.
              </p>
              <p>
                The shared {COORDINATOR_DISPLAY_NAME} contact details are retired in the process,
                and <strong>this cannot be undone</strong>. Its voice and photo are taken from the
                current selections in this edit form.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-label" htmlFor="multiplayer-first-name">
                First name
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid="multiplayer-roll-name"
                onClick={() => {
                  const rolled = createAvailableUnityProfile(takenDisplayNames, takenFirstNames);
                  setFirstName(rolled.firstName);
                  setSurname(rolled.surname);
                  setError(null);
                }}
                disabled={isFlipping}
              >
                <Dices className="mr-1 h-4 w-4" />
                Randomize
              </Button>
            </div>
            <Input
              id="multiplayer-first-name"
              data-testid="multiplayer-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Max"
              maxLength={60}
            />
            {trimmedFirstName.toLowerCase() === COORDINATOR_DISPLAY_NAME.toLowerCase() && (
              <p className="text-caption text-error">
                Pick a name of its own — {COORDINATOR_DISPLAY_NAME} is the shared single-player
                identity.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-label" htmlFor="multiplayer-surname">
              Surname (optional)
            </label>
            <Input
              id="multiplayer-surname"
              data-testid="multiplayer-surname"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              maxLength={60}
            />
          </div>
          {error && (
            <p className="text-body text-error" data-testid="multiplayer-flip-error">
              {error}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isFlipping}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={nameInvalid || isFlipping}
            data-testid="multiplayer-flip-confirm"
          >
            {isFlipping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enable multiplayer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
