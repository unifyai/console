import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import {
  Phone,
  Mail,
  PhoneCall,
  MoreVertical,
  PenLine,
  Contact,
  Copy,
  Check,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { WhatsApp } from '@mui/icons-material';
import { FaDiscord } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/UI/hover-card';
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
}: AssistantListItemProps) {
  const [isIdCopied, setIsIdCopied] = React.useState(false);
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

  const supervisorName = [assistant.userFirstName, assistant.userLastName]
    .filter(Boolean)
    .join(' ');

  const hoverCardContent = (
    <div className="flex justify-between space-x-4">
      <Avatar className="flex-shrink-0">
        <AvatarImage src={photoSrc ?? undefined} />
        <AvatarFallback>
          {`${assistant.firstName?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-0.5">
        <h4 className="text-title truncate">{displayName}</h4>
        <div
          className="group/id text-caption flex min-w-0 cursor-pointer items-center gap-1 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(assistant.agentId);
            setIsIdCopied(true);
            setTimeout(() => setIsIdCopied(false), 2000);
          }}
        >
          <span className="opacity-70">Assistant ID:</span>
          {isIdCopied ? (
            <Check className="h-3 w-3 flex-shrink-0 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 flex-shrink-0 opacity-70 transition-colors group-hover/id:opacity-100" />
          )}
        </div>
        {assistant.jobTitle && (
          <div
            className="text-caption flex min-w-0 items-center text-muted-foreground"
            data-testid={`assistant-job-title-${assistant.agentId}`}
          >
            <span className="mr-1 opacity-70">Job Title:</span>
            <span className="truncate">{assistant.jobTitle}</span>
          </div>
        )}
        {supervisorName && (
          <div className="text-caption flex min-w-0 items-center text-muted-foreground">
            <span className="mr-1 opacity-70">Supervisor:</span>
            <span className="truncate">{supervisorName}</span>
          </div>
        )}
        <div className="text-caption flex min-w-0 items-center pt-1 text-muted-foreground">
          <Mail className="mr-1.5 h-3 w-3 flex-shrink-0 opacity-70" />
          {assistant.email ? (
            <a
              href={`mailto:${assistant.email}`}
              onClick={(e) => e.stopPropagation()}
              className="text-link min-w-0 truncate"
            >
              {assistant.email}
            </a>
          ) : (
            <Button
              variant="link"
              className="text-caption text-link h-auto p-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenContactManager(assistant, 'email');
              }}
            >
              Add Email
            </Button>
          )}
        </div>
        <div className="text-caption flex min-w-0 items-center pt-0.5 text-muted-foreground">
          <Phone className="mr-1.5 h-3 w-3 flex-shrink-0 opacity-70" />
          {assistant.phone ? (
            <span className="min-w-0 truncate">{assistant.phone}</span>
          ) : (
            <Button
              variant="link"
              className="text-caption text-link h-auto p-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenContactManager(assistant, 'phone');
              }}
            >
              Add Phone
            </Button>
          )}
        </div>
        <div className="text-caption flex min-w-0 items-center pt-0.5 text-muted-foreground">
          <WhatsApp sx={{ fontSize: '12px', marginRight: '6px', opacity: 0.7, flexShrink: 0 }} />
          {assistant.assistantWhatsappNumber ? (
            <span className="min-w-0 truncate">{assistant.assistantWhatsappNumber}</span>
          ) : (
            <Button
              variant="link"
              className="text-caption text-link h-auto p-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenContactManager(assistant, 'whatsapp');
              }}
            >
              Add WhatsApp
            </Button>
          )}
        </div>
        <div className="text-caption flex min-w-0 items-center pt-0.5 text-muted-foreground">
          <FaDiscord className="mr-1.5 h-3 w-3 flex-shrink-0 opacity-70" />
          {assistant.assistantDiscordBotId ? (
            <span className="min-w-0 truncate">{assistant.assistantDiscordBotId}</span>
          ) : (
            <Button
              variant="link"
              className="text-caption text-link h-auto p-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenContactManager(assistant, 'discord');
              }}
            >
              Add Discord
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (isFolded) {
    const content = (
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
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary"></span>
          </span>
        )}
      </div>
    );

    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>{content}</HoverCardTrigger>
        <HoverCardContent className="w-80" side="right" align="start">
          {hoverCardContent}
        </HoverCardContent>
      </HoverCard>
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
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
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
          </HoverCardTrigger>
          <HoverCardContent className="w-80" side="right" align="start">
            {hoverCardContent}
          </HoverCardContent>
        </HoverCard>
        <span className="text-body text-strong truncate">{displayName}</span>
      </div>
      <div className="flex items-center gap-1">
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
