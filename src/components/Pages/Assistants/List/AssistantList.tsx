import * as React from 'react';
import { Input } from '@/components/UI/input';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Search, WifiOff, UserPlus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
  onOpenContactManager: (assistant: Assistant, tab?: 'email' | 'phone' | 'whatsapp') => void;
  onEditAssistant: (assistant: Assistant) => void;
  onOpenSecretsManager: (assistant: Assistant) => void;
  onEndContract?: (assistant: Assistant) => Promise<void>;
  canEndContract?: (assistant: Assistant) => boolean;
  isFolded: boolean;
  activeCallAssistantId: string | null;
  onHangUp: () => void;
  /** Whether the current user can hire new assistants (org Owner in org context, anyone in personal workspace) */
  canHire?: boolean;
  onToggleFold?: () => void;
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
  onEditAssistant,
  onOpenSecretsManager,
  onEndContract,
  canEndContract,
  isFolded,
  activeCallAssistantId,
  onHangUp,
  canHire = true,
  onToggleFold,
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

  const canHireNewAssistant = !assistantError;
  // Hide hire button if user doesn't have permission (org members who aren't Owner)
  const showHireButton = canHire;
  const isHireButtonDisabled = isLoading || !canHireNewAssistant;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background">
      {/* Header: Search Bar + New Assistant Button */}
      <div className="flex-shrink-0 overflow-hidden border-b px-3 py-2">
        {isFolded ? (
          <div className="flex min-h-7 items-center justify-center">
            {showHireButton && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isFolded ? 'ghost' : 'outline'}
                      size="icon"
                      className="h-7 w-7"
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
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                className="h-7 w-full pl-7 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading || !!error}
              />
            </div>
            {showHireButton && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 items-center text-xs"
                onClick={onOpenHireDialog}
                disabled={isHireButtonDisabled}
                aria-disabled={isHireButtonDisabled}
              >
                <UserPlus className="h-4 w-4" />
                New
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content Area: Loading Skeletons, Error, or List */}
      <ScrollArea className="flex-1">
        <div
          className={cn(
            'space-y-1 px-2 py-2',
            isFolded && 'flex flex-col items-center space-y-3 px-3 py-3'
          )}
        >
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
                onEditAssistant={onEditAssistant}
                onOpenSecretsManager={onOpenSecretsManager}
                onEndContract={canEndContract?.(assistant) ? onEndContract : undefined}
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

      {onToggleFold && (
        <div
          className={cn(
            'hidden flex-shrink-0 items-center border-t px-2 py-1.5 md:flex',
            isFolded ? 'justify-center' : 'justify-end'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onToggleFold}
            title={isFolded ? 'Expand panel' : 'Collapse panel'}
          >
            {isFolded ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
