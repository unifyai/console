import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import {
  PhoneCall,
  MoreVertical,
  PenLine,
  Contact,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/UI/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/UI/alert-dialog';

interface AssistantListItemProps {
  assistant: Assistant;
  status: AssistantStatus | null;
  isSelected: boolean;
  onShowProfile: (id: string) => void;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  onEditAssistant: (assistant: Assistant) => void;
  onEndContract?: (assistant: Assistant) => Promise<void>;
  isFolded: boolean;
  isCallActive: boolean;
  /**
   * Count of unread chat messages from the page-level inbox multiplex
   * stream. Rendered as a numeric badge in expanded mode and as a small
   * dot over the avatar in folded mode. `0` renders nothing.
   */
  unreadCount?: number;
}

export function AssistantListItem({
  assistant,
  status,
  isSelected,
  onShowProfile,
  onOpenContactManager,
  onEditAssistant,
  onEndContract,
  isFolded,
  isCallActive,
  unreadCount = 0,
}: AssistantListItemProps) {
  const hasUnread = unreadCount > 0;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const [isEndContractAlertOpen, setIsEndContractAlertOpen] = React.useState(false);
  const [isEndingContract, setIsEndingContract] = React.useState(false);

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShowProfile(assistant.agentId);
  };

  const handleEndContractConfirm = async () => {
    if (!onEndContract || isEndingContract) return;
    setIsEndingContract(true);
    try {
      await onEndContract(assistant);
      setIsEndContractAlertOpen(false);
    } finally {
      setIsEndingContract(false);
    }
  };

  const displayName = `${assistant.firstName} ${assistant.surname}`;
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto;
  const isOnline = status?.running === true;

  if (isFolded) {
    return (
      <div
        className={cn(
          'relative cursor-pointer rounded-full',
          isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
        onClick={handleProfileClick}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={photoSrc ?? undefined} alt={displayName} />
          <AvatarFallback>
            {`${assistant.firstName?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {status !== null && (
          <span
            role="status"
            className={cn(
              'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background',
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            )}
          />
        )}
        {isCallActive && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary">
              <PhoneCall className="h-2.5 w-2.5 text-primary-foreground" />
            </span>
          </span>
        )}
        {hasUnread && !isCallActive && (
          <span
            data-testid={`assistant-unread-badge-${assistant.agentId}`}
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
          >
            {unreadLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`assistant-list-item-${assistant.agentId}`}
      className={cn(
        'group flex cursor-pointer items-center justify-between rounded-md p-2',
        !isSelected && 'hover:bg-muted',
        isSelected && 'bg-primary text-primary-foreground'
      )}
      onClick={handleProfileClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleProfileClick(e as any);
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <Avatar className="h-8 w-8 flex-shrink-0 cursor-default">
            <AvatarImage src={photoSrc ?? undefined} alt={displayName} />
            <AvatarFallback>
              {`${assistant.firstName?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {status !== null && (
            <span
              role="status"
              data-testid={`status-indicator-${assistant.agentId}`}
              className={cn(
                'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background',
                isOnline ? 'bg-green-500' : 'bg-gray-400'
              )}
            />
          )}
        </div>
        <span className="text-body text-strong truncate">{displayName}</span>
      </div>
      <div className="flex items-center gap-1">
        {hasUnread && (
          <span
            data-testid={`assistant-unread-badge-${assistant.agentId}`}
            className={cn(
              'flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none',
              isSelected
                ? 'bg-primary-foreground text-primary'
                : 'bg-primary text-primary-foreground'
            )}
          >
            {unreadLabel}
          </span>
        )}
        {assistant.deployEnv === 'preview' && (
          <span
            className={cn(
              `text-caption`,
              isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            <Badge variant="outline">Preview</Badge>
          </span>
        )}
        {assistant.demoId && (
          <span
            className={cn(
              `text-caption`,
              isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            <Badge variant="outline">Demo</Badge>
          </span>
        )}
        {isCallActive && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PhoneCall
                  className={cn(
                    'h-4 w-4 flex-shrink-0 animate-pulse',
                    isSelected ? 'text-primary-foreground' : 'text-primary'
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>In a call</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100',
                isSelected && 'text-primary-foreground opacity-100 hover:text-primary-foreground'
              )}
              onClick={(e) => e.stopPropagation()}
              data-testid={`assistant-menu-${assistant.agentId}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={() => onEditAssistant(assistant)}
              data-testid="menu-edit-profile"
            >
              <PenLine className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onOpenContactManager(assistant)}
              data-testid="menu-update-contacts"
            >
              <Contact className="mr-2 h-4 w-4" />
              Contact Details
            </DropdownMenuItem>
            {onEndContract && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsEndContractAlertOpen(true)}
                  data-testid="menu-end-contract"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  End contract
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialog open={isEndContractAlertOpen} onOpenChange={setIsEndContractAlertOpen}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
                Confirm End Contract
              </AlertDialogTitle>
              <AlertDialogDescription>
                You are about to remove{' '}
                <strong>
                  {assistant.firstName} {assistant.surname}
                </strong>{' '}
                from your team. This action cannot be undone. Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isEndingContract}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleEndContractConfirm}
                disabled={isEndingContract}
                className={cn(
                  'hover:bg-destructive/90 bg-destructive',
                  isEndingContract && 'cursor-not-allowed opacity-70'
                )}
              >
                {isEndingContract ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Proceed
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
