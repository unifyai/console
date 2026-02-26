import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Skeleton } from '@/components/UI/skeleton';
import { Loader2, Monitor, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import type {
  Assistant,
  AssistantActions,
  UserDesktop,
  AssistantUpdatePayload,
} from '@/types/assistants/assistant';
import type { ResponseProps } from '@/types/common';
import { toast } from 'sonner';

interface AssistantDesktopLinkerProps {
  isOpen: boolean;
  onClose: () => void;
  assistant: Assistant;
  assistantActions: AssistantActions;
  onLinked?: (userDesktopId: number | null) => void;
}

const osLabels: Record<string, string> = {
  macos: 'macOS',
  windows: 'Windows',
  ubuntu: 'Ubuntu',
};

export function AssistantDesktopLinker({
  isOpen,
  onClose,
  assistant,
  assistantActions,
  onLinked,
}: AssistantDesktopLinkerProps) {
  const [desktops, setDesktops] = React.useState<UserDesktop[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [assigningId, setAssigningId] = React.useState<number | null>(null);

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

  const handleAssign = async (desktopId: number) => {
    setAssigningId(desktopId);
    const result = await assistantActions.assistant.update(assistant.agentId, {
      userDesktopId: desktopId,
    } as Partial<AssistantUpdatePayload>);
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
    const result = await assistantActions.assistant.update(assistant.agentId, {
      userDesktopId: null,
    } as Partial<AssistantUpdatePayload>);
    setAssigningId(null);

    if ('detail' in result && result.detail) {
      toast.error(result.detail);
      return;
    }
    toast.success('Desktop unlinked');
    onLinked?.(null);
    onClose();
  };

  const currentDesktopId = assistant.userDesktopId ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link User Desktop</DialogTitle>
        </DialogHeader>

        {currentDesktopId && (
          <div className="bg-muted/50 flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-caption text-muted-foreground">
              Currently linked to desktop #{currentDesktopId}
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
                const isCurrentlyLinked = desktop.id === currentDesktopId;
                const isAssignedElsewhere =
                  desktop.assignedToAssistantId !== null &&
                  desktop.assignedToAssistantId.toString() !== assistant.agentId;

                return (
                  <button
                    key={desktop.id}
                    disabled={isAssignedElsewhere || isCurrentlyLinked || assigningId !== null}
                    onClick={() => handleAssign(desktop.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
                      isCurrentlyLinked
                        ? 'border-primary/40 bg-primary/5'
                        : isAssignedElsewhere
                          ? 'bg-muted/30 cursor-not-allowed border-border opacity-50'
                          : 'hover:border-primary/30 border-border hover:bg-accent'
                    )}
                  >
                    <Monitor className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-title truncate">{desktop.name}</p>
                      <p className="text-caption truncate">
                        {osLabels[desktop.os] ?? desktop.os}
                        {isAssignedElsewhere && ' · Assigned to another assistant'}
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
      </DialogContent>
    </Dialog>
  );
}
