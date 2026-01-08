import * as React from 'react';
import { Input } from '@/components/UI/input';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Search, WifiOff, UserPlus, PanelLeft, PanelLeftClose } from 'lucide-react';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { AssistantListItem } from './AssistantListItem';
import { AssistantListItemSkeleton } from './AssistantListItemSkeleton';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';

interface AssistantListProps {
  assistants: Assistant[];
  assistantStatuses: Map<string, AssistantStatus | null>;
  assistantError: string | null;
  isLoading: boolean;
  error: string | null;
  profileAssistantId: string | null;
  onShowProfile: (id: string) => void;
  onOpenHireDialog: () => void;
  onOpenContactManager: (assistant: Assistant, tab: 'email' | 'phone' | 'whatsapp') => void;
  isFolded: boolean;
  onToggleFold: () => void;
  activeCallAssistantId: string | null;
  onHangUp: () => void;
  /** Whether the current user can hire new assistants (org Owner in org context, anyone in personal workspace) */
  canHire?: boolean;
}

export function AssistantList({
  assistants,
  assistantStatuses,
  assistantError,
  isLoading,
  error,
  profileAssistantId,
  onShowProfile,
  onOpenHireDialog,
  onOpenContactManager,
  isFolded,
  onToggleFold,
  activeCallAssistantId,
  onHangUp,
  canHire = true,
}: AssistantListProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredAssistants = React.useMemo(() => {
    if (!searchTerm) return assistants;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return assistants.filter(
      (a) =>
        (a.firstName &&
          a.surname &&
          `${a.firstName} ${a.surname}`.toLowerCase().includes(lowerSearchTerm)) ||
        (a.email && a.email.toLowerCase().includes(lowerSearchTerm))
    );
  }, [assistants, searchTerm]);

  const canHireNewAssistant = !assistantError && assistants.length < 2;
  // Hide hire button if user doesn't have permission (org members who aren't Owner)
  const showHireButton = canHire;
  const isHireButtonDisabled = isLoading || !canHireNewAssistant;

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Header: Search Bar + New Assistant Button */}
      <div className="flex-shrink-0 border-b p-3">
        {isFolded ? (
          <div className="flex items-center justify-center">
            {showHireButton && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isFolded ? 'ghost' : 'outline'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={onOpenHireDialog}
                      disabled={isHireButtonDisabled}
                      aria-disabled={isHireButtonDisabled}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Hire new assistant</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search assistants..."
                className="h-8 w-full pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading || !!error}
              />
            </div>
            {showHireButton && (
              <TooltipProvider delayDuration={100}>
                <Tooltip open={!canHireNewAssistant && !isLoading ? undefined : false}>
                  {' '}
                  {/* Conditionally control open state for tooltip */}
                  <TooltipTrigger asChild>
                    {/* The button itself needs to be wrapped or be a direct child for TooltipTrigger to work correctly when disabled */}
                    <span tabIndex={isHireButtonDisabled ? 0 : -1}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 items-center"
                        onClick={onOpenHireDialog}
                        disabled={isHireButtonDisabled}
                        aria-disabled={isHireButtonDisabled}
                      >
                        <UserPlus className="h-4 w-4" />
                        New
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!canHireNewAssistant && !isLoading && (
                    <TooltipContent side="bottom" align="end">
                      <p>More assistant hires available soon</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>

      {/* Content Area: Loading Skeletons, Error, or List */}
      <ScrollArea className="flex-1 p-1">
        <div className={cn('space-y-1 pt-2', isFolded && 'flex flex-col items-center space-y-3')}>
          {isLoading ? (
            <>
              {[...Array(10)].map((_, i) => (
                <AssistantListItemSkeleton key={`asst-skeleton-${i}`} isFolded={isFolded} />
              ))}
            </>
          ) : error ? (
            <div className="flex flex-col items-center justify-center pt-10 text-center">
              <WifiOff className="mb-2 h-6 w-6 text-muted-foreground" />
              {!isFolded && (
                <p className="text-body text-muted-foreground">Could not load assistants.</p>
              )}
            </div>
          ) : filteredAssistants.length > 0 ? (
            filteredAssistants.map((assistant) => (
              <AssistantListItem
                key={assistant.agentId}
                assistant={assistant}
                status={assistantStatuses.get(assistant.agentId) || null}
                isSelected={profileAssistantId === assistant.agentId}
                onShowProfile={onShowProfile}
                onOpenContactManager={onOpenContactManager}
                isFolded={isFolded}
                isCallActive={activeCallAssistantId === assistant.agentId}
              />
            ))
          ) : searchTerm && !isFolded ? (
            <p className="text-body p-4 text-center text-muted-foreground">
              No assistants match filters.
            </p>
          ) : !isFolded ? (
            <p className="text-body p-4 text-center text-muted-foreground">No assistants found.</p>
          ) : null}
        </div>
      </ScrollArea>

      {/* Fold/Unfold Button */}
      <div
        className={cn('absolute bottom-4 z-10', isFolded ? 'left-1/2 -translate-x-1/2' : 'right-2')}
      >
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleFold}
                className="relative h-8 w-8 hover:bg-primary hover:text-primary-foreground"
              >
                {isFolded ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isFolded ? 'Unfold List' : 'Fold List'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
