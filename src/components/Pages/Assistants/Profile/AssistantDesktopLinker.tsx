import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Skeleton } from '@/components/UI/skeleton';
import {
  Loader2,
  Monitor,
  Link2,
  Unlink,
  ClipboardCopy,
  Check,
  KeyRound,
  Info,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/UI/tooltip';
import { AssistantHireLocalSetupInstructionsDialog } from '@/components/Pages/Assistants/Hire/AssistantHireLocalSetupInstructions';
import { cn } from '@/lib/utils';
import { FaApple, FaWindows, FaUbuntu } from 'react-icons/fa';
import type { Assistant, AssistantActions, UserDesktop } from '@/types/assistants/assistant';
import type { ResponseProps } from '@/types/common';
import { toast } from 'sonner';

interface AssistantDesktopLinkerProps {
  isOpen: boolean;
  onClose: () => void;
  assistant: Assistant;
  assistantActions: AssistantActions;
  onLinked?: (userDesktopId: number | null) => void;
  /** Server action to retrieve the user's API key (keeps key out of client-side props) */
  getApiKey?: () => Promise<string>;
}

const osLabels: Record<string, string> = {
  macos: 'macOS',
  windows: 'Windows',
  ubuntu: 'Ubuntu',
};

const osIcons: Record<string, React.ReactNode> = {
  macos: <FaApple className="h-4 w-4" />,
  windows: <FaWindows className="h-4 w-4" />,
  ubuntu: <FaUbuntu className="h-4 w-4" />,
};

export function AssistantDesktopLinker({
  isOpen,
  onClose,
  assistant,
  assistantActions,
  onLinked,
  getApiKey,
}: AssistantDesktopLinkerProps) {
  const [desktops, setDesktops] = React.useState<UserDesktop[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [assigningId, setAssigningId] = React.useState<number | null>(null);
  const [setupOs, setSetupOs] = React.useState<string | null>(null);
  const [selectedOs, setSelectedOs] = React.useState<'macos' | 'windows' | 'ubuntu' | null>(null);
  const [keyCopied, setKeyCopied] = React.useState(false);
  const [isCopyingKey, setIsCopyingKey] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [passwordValue, setPasswordValue] = React.useState('');
  const [isSavingPassword, setIsSavingPassword] = React.useState(false);
  const [passwordSaved, setPasswordSaved] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    assistantActions.desktop.listUserDesktops().then((result) => {
      if (Array.isArray(result)) {
        setDesktops(result);
      } else {
        toast.error((result as ResponseProps).detail || 'Failed to load desktops');
        setDesktops([]);
      }
      setIsLoading(false);
    });
  }, [isOpen, assistantActions.desktop]);

  const assistantIdNum = Number(assistant.agentId);

  const handleAssign = async (desktopId: number) => {
    setAssigningId(desktopId);
    const result = await assistantActions.desktop.linkDesktop(assistant.agentId, desktopId);
    setAssigningId(null);

    if ('detail' in result && result.detail) {
      toast.error(result.detail);
      return;
    }
    toast.success('Desktop linked successfully');
    onLinked?.(desktopId);
    onClose();
  };

  const handleUnlink = async () => {
    setAssigningId(-1);
    const result = await assistantActions.desktop.unlinkDesktop(assistant.agentId);
    setAssigningId(null);

    if ('detail' in result && result.detail) {
      toast.error(result.detail);
      return;
    }
    toast.success('Desktop unlinked');
    onLinked?.(null);
    onClose();
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValue.trim()) return;
    setIsSavingPassword(true);
    try {
      const result = await assistantActions.secret.create(assistant.agentId, assistant.userId, {
        name: 'MACOS_USER_DESKTOP_PASSWORD',
        value: passwordValue,
        description: 'macOS login password for local desktop control',
      });
      if ('detail' in result && result.detail) {
        console.error('[AssistantDesktopLinker] save password failed:', result.detail);
        toast.error('Could not save password. Please try again.');
        return;
      }
      setPasswordValue('');
      setPasswordOpen(false);
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
      toast.success('Password saved');
    } catch (err) {
      console.error('[AssistantDesktopLinker] save password error:', err);
      toast.error('Could not save password. Please try again.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // The current user's desktop linked to *this* assistant: the one whose
  // assigned-assistant list includes this assistant. The desktop list is
  // already scoped to the requesting user, so at most one will match.
  const currentDesktop = desktops.find((d) =>
    (d.assignedToAssistantIds ?? []).includes(assistantIdNum)
  );
  const currentDesktopId = currentDesktop?.id ?? null;
  const currentDesktopLabel = currentDesktop?.name ?? `#${currentDesktopId}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link User Desktop</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/50 flex items-start gap-2 rounded-md border border-border px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <p className="text-caption text-muted-foreground">
            Linking a desktop lets this assistant see and control that machine — its apps, files,
            and logged-in sessions — during local desktop sessions. Only link a computer you&apos;re
            comfortable giving full control of.
          </p>
        </div>

        {currentDesktopId && (
          <div className="bg-muted/50 flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-caption text-muted-foreground">
              Currently linked to {currentDesktopLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-destructive hover:text-destructive"
              onClick={handleUnlink}
              disabled={assigningId !== null}
            >
              {assigningId === -1 ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unlink className="h-3.5 w-3.5" />
              )}
              Unlink
            </Button>
          </div>
        )}

        <ScrollArea className="max-h-[320px]">
          {isLoading ? (
            <div className="space-y-2 p-1">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full bg-muted" />
              ))}
            </div>
          ) : desktops.length === 0 ? (
            <p className="text-body-muted py-8 text-center">
              No registered desktops found. Register a desktop using the Unify desktop app first.
            </p>
          ) : (
            <div className="space-y-1 p-1">
              {desktops.map((desktop) => {
                const assignedIds = desktop.assignedToAssistantIds ?? [];
                const isCurrentlyLinked = assignedIds.includes(assistantIdNum);
                // One machine may serve several of the user's assistants, so a
                // desktop linked elsewhere is still selectable here.
                const otherLinkCount = assignedIds.filter((id) => id !== assistantIdNum).length;

                return (
                  <button
                    key={desktop.id}
                    disabled={isCurrentlyLinked || assigningId !== null}
                    onClick={() => handleAssign(desktop.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
                      isCurrentlyLinked
                        ? 'border-primary/40 bg-primary/5'
                        : 'hover:border-primary/30 border-border hover:bg-accent'
                    )}
                  >
                    <Monitor className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-title truncate">{desktop.name}</p>
                      <p className="text-caption truncate">
                        {osLabels[desktop.os] ?? desktop.os}
                        {!isCurrentlyLinked &&
                          otherLinkCount > 0 &&
                          ` · Also linked to ${otherLinkCount} other assistant${
                            otherLinkCount === 1 ? '' : 's'
                          }`}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {assigningId === desktop.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : isCurrentlyLinked ? (
                        <Link2 className="h-4 w-4 text-primary" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-border pt-3">
          <p className="text-title leading-none tracking-tight">Local Setup Instructions</p>

          <div className="mt-2 flex gap-2">
            {(['macos', 'windows', 'ubuntu'] as const).map((os) => (
              <Button
                key={os}
                variant="outline"
                size="sm"
                className={cn(
                  'flex-1 gap-1.5',
                  selectedOs === os && 'border-primary/40 bg-primary/5 text-primary'
                )}
                onClick={() => setSelectedOs(os)}
              >
                {osIcons[os]}
                {osLabels[os]}
              </Button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {getApiKey && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-muted-foreground"
                disabled={isCopyingKey}
                onClick={async () => {
                  setIsCopyingKey(true);
                  try {
                    const key = await getApiKey();
                    navigator.clipboard.writeText(key);
                    setKeyCopied(true);
                    setTimeout(() => setKeyCopied(false), 2000);
                  } catch {
                    toast.error('Failed to retrieve API key');
                  } finally {
                    setIsCopyingKey(false);
                  }
                }}
              >
                {keyCopied ? (
                  <Check className="h-3.5 w-3.5 text-[color:var(--status-success)]" />
                ) : isCopyingKey ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ClipboardCopy className="h-3.5 w-3.5" />
                )}
                {keyCopied ? 'Copied!' : 'Copy API Key'}
              </Button>
            )}

            {selectedOs === 'macos' && (
              <div className="flex items-center gap-0.5">
                <Popover open={passwordOpen} onOpenChange={setPasswordOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-muted-foreground"
                    >
                      {passwordSaved ? (
                        <Check className="h-3.5 w-3.5 text-[color:var(--status-success)]" />
                      ) : (
                        <KeyRound className="h-3.5 w-3.5" />
                      )}
                      {passwordSaved ? 'Saved!' : 'Save User Password'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72">
                    <form onSubmit={handleSavePassword} className="space-y-2">
                      <p className="text-title leading-none">macOS login password</p>
                      <Input
                        type="password"
                        autoComplete="off"
                        placeholder="Your Mac login password"
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="w-full gap-1.5"
                        disabled={!passwordValue.trim() || isSavingPassword}
                      >
                        {isSavingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Save securely
                      </Button>
                    </form>
                  </PopoverContent>
                </Popover>

                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Why is my password needed?"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="start" className="text-caption max-w-xs">
                      Used to grant accessibility permission and unlock your Mac when needed. Stored
                      as an encrypted secret, only used on the Mac you link.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!selectedOs}
              onClick={() => selectedOs && setSetupOs(selectedOs)}
            >
              View setup instructions
            </Button>
          </div>
        </div>
      </DialogContent>

      <AssistantHireLocalSetupInstructionsDialog
        isOpen={!!setupOs}
        os={setupOs || 'ubuntu'}
        onClose={() => setSetupOs(null)}
      />
    </Dialog>
  );
}
