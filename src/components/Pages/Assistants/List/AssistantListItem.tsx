import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import {
  PhoneCall,
  MoreVertical,
  PenLine,
  Contact,
  Briefcase,
  Trash2,
  Loader2,
  AlertTriangle,
  Star,
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
  onOpenWorkspaceManager: (assistant: Assistant) => void;
  onEditAssistant: (assistant: Assistant) => void;
  onEndContract?: (assistant: Assistant) => Promise<void>;
  /** When false, the row's "Profile" / "Workspace" / "Contact Details"
   *  menu entries are hidden — non-write viewers don't get edit
   *  affordances they can't act on. Defaults to true. */
  canEdit?: boolean;
  isFolded: boolean;
  isCallActive: boolean;
  /**
   * Count of unread chat messages from the page-level inbox multiplex
   * stream. Rendered as a numeric badge in expanded mode and as a small
   * dot over the avatar in folded mode. `0` renders nothing.
   */
  unreadCount?: number;
  isPrimary?: boolean;
  alsoInSpaceLabels?: string[];
}

function CoordinatorAvatarBadge() {
  return (
    <span
      aria-label="Coordinator"
      className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
    >
      <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
    </span>
  );
}

export function AssistantListItem({
  assistant,
  status,
  isSelected,
  onShowProfile,
  onOpenContactManager,
  onOpenWorkspaceManager,
  onEditAssistant,
  onEndContract,
  isFolded,
  isCallActive,
  unreadCount = 0,
  canEdit = true,
  isPrimary = true,
  alsoInSpaceLabels = [],
}: AssistantListItemProps) {
  const hasUnread = unreadCount > 0;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const totalSpaceCount = alsoInSpaceLabels.length + 1;
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
  const isCoordinator = assistant.isCoordinator === true;
  const canEndContract = !!onEndContract;

  if (isFolded) {
    return (
      <div
        data-testid={isPrimary ? `assistant-list-item-${assistant.agentId}` : undefined}
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
        {isCoordinator && <CoordinatorAvatarBadge />}
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
      data-testid={isPrimary ? `assistant-list-item-${assistant.agentId}` : undefined}
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
          {isCoordinator && <CoordinatorAvatarBadge />}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-body text-strong truncate">{displayName}</span>
          {isCoordinator && (
            <span
              className={cn(
                'text-caption shrink-0',
                isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
            >
              <Badge
                variant="outline"
                className={cn(isSelected && 'border-primary-foreground text-primary-foreground')}
              >
                Coordinator
              </Badge>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {alsoInSpaceLabels.length > 0 && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 cursor-default px-1.5 text-[10px] font-medium',
                      isSelected && 'border-primary-foreground text-primary-foreground'
                    )}
                  >
                    {totalSpaceCount} spaces
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{`Also in ${alsoInSpaceLabels.join(', ')}`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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
        {/* Suppress the menu trigger entirely when none of the
            entries are actionable — a kebab that opens an empty
            menu just adds noise. With canEdit and onEndContract
            both gated, a viewer with neither permission gets a
            cleaner row. */}
        {(canEdit || canEndContract) && (
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
              {canEdit && (
                <>
                  <DropdownMenuItem
                    onClick={() => onEditAssistant(assistant)}
                    data-testid="menu-edit-profile"
                  >
                    <PenLine className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onOpenWorkspaceManager(assistant)}
                    data-testid="menu-update-workspace"
                  >
                    <Briefcase className="mr-2 h-4 w-4" />
                    Workspace
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onOpenContactManager(assistant)}
                    data-testid="menu-update-contacts"
                  >
                    <Contact className="mr-2 h-4 w-4" />
                    Contact Details
                  </DropdownMenuItem>
                </>
              )}
              {canEndContract && (
                <>
                  {canEdit && <DropdownMenuSeparator />}
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
        )}
        {canEndContract && (
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
        )}
      </div>
    </div>
  );
}
