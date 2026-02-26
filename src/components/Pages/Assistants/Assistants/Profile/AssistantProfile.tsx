import * as React from 'react';
import { Button } from '@/components/UI/button';
import {
  Loader2,
  PenLine,
  User,
  MessageSquare,
  ChevronRight,
  Briefcase,
  Phone,
  Video,
} from 'lucide-react';
import type { Assistant, AssistantActions, DesktopMode } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/UI/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { ChatMessage } from '@/types/assistants/chat';
import { AssistantProfileInfoPanel } from './AssistantProfileInfoPanel';
import { AssistantProfileChatPanel } from './AssistantProfileChatPanel';
import { AssistantResourcesManager } from './AssistantResourcesManager';
import { SpendingGateStatus, DEFAULT_SPENDING_GATE_STATUS } from '@/types/assistants/spendingGate';
import { SpendingDisplayProps } from '@/types/assistants/spending';

interface AssistantProfilePanelProps {
  assistant: Assistant;
  assistantActions: AssistantActions;
  onClose: () => void;
  onEdit: (assistant: Assistant) => void;
  onOpenContactManager: (assistant: Assistant, tab?: 'email' | 'phone' | 'whatsapp') => void;
  onOpenSetupInstructions?: (os: DesktopMode) => void;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  userEmail: string | null | undefined;
  isFirstView?: boolean;
  preHireChat?: ChatMessage[];
  onFirstViewCompleted?: () => void;
  onStartCall: (assistant: Assistant, callType: 'video' | 'audio') => void;
  activeCallAssistantId: string | null;
  isCallConnected: boolean;
  isConnectingCall: boolean;
  userTimezone?: string | null;
  /** Whether the current user can edit this assistant */
  canWrite?: boolean;
  /** Whether to show spending section (default: true if spending actions available) */
  showSpending?: boolean;
  /** Spending gate status for blocking billable activity */
  spendingGate?: SpendingGateStatus;
  /** Callback when assistant spending data changes (for spending gate) */
  onAssistantSpendingChange?: (display: SpendingDisplayProps | null) => void;
  onAssistantUpdated?: (assistantId: string, patch: Partial<Assistant>) => void;
}

const AccordionTriggerWithButtons = React.forwardRef<
  React.ElementRef<typeof AccordionTrigger>,
  React.ComponentPropsWithoutRef<typeof AccordionTrigger> & {
    buttonSlot?: React.ReactNode;
  }
>(({ children, buttonSlot, ...props }, ref) => (
  <AccordionTrigger
    ref={ref}
    {...props}
    className="group py-2 hover:no-underline data-[state=open]:border-b"
    hideChevron // Hide the primitive's default chevron
  >
    <div className="flex min-h-7 w-full items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <div className="text-title flex-grow text-left">{children}</div>
        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
      </div>

      {/* Show only when accordion is open */}
      <div
        className={cn(
          'flex-shrink-0 transition-opacity',
          'group-data-[state=open]:flex group-data-[state=closed]:hidden'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {buttonSlot}
      </div>
    </div>
  </AccordionTrigger>
));
AccordionTriggerWithButtons.displayName = AccordionTrigger.displayName;

export function AssistantProfilePanel({
  assistant,
  assistantActions,
  onClose,
  onEdit,
  onOpenContactManager,
  onOpenSetupInstructions,
  chatHistories,
  setChatHistories,
  userEmail,
  isFirstView,
  preHireChat,
  onFirstViewCompleted,
  onStartCall,
  activeCallAssistantId,
  isCallConnected,
  isConnectingCall,
  userTimezone,
  canWrite = true,
  showSpending = true,
  spendingGate = DEFAULT_SPENDING_GATE_STATUS,
  onAssistantSpendingChange,
  onAssistantUpdated,
}: AssistantProfilePanelProps) {
  const [openSections, setOpenSections] = React.useState<string[]>(['chat']);

  const isInThisCall = activeCallAssistantId === assistant.agentId;
  const isAnotherCallActive = activeCallAssistantId !== null && !isInThisCall;
  // Block new calls if spending limit is reached (but allow returning to existing calls)
  const isSpendingBlocked = spendingGate.isBlocked && !isInThisCall;
  const isCallButtonDisabled = isAnotherCallActive || isSpendingBlocked;

  const callButtonTooltip =
    isInThisCall && isConnectingCall
      ? 'Connecting call...'
      : isInThisCall
        ? 'Return to call'
        : isSpendingBlocked
          ? spendingGate.blockedMessage || 'Spending limit reached'
          : isAnotherCallActive
            ? 'Another call is in progress'
            : 'Start a call';

  if (!assistant) return null;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="flex min-h-0 w-full flex-1 flex-col"
      >
        {/* Profile Section */}
        <AccordionItem value="profile">
          <AccordionTriggerWithButtons
            className="text-title"
            buttonSlot={
              canWrite ? (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(assistant)}
                      >
                        <PenLine className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Edit Assistant</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null
            }
          >
            <div className="flex items-center gap-2 text-[color:var(--muted-foreground)] transition-colors duration-200 hover:text-[color:var(--foreground)]">
              <User className="h-4 w-4" />
              <span className="text-body">Profile</span>
            </div>
          </AccordionTriggerWithButtons>
          <AccordionContent
            outerClassName="data-[state=open]:flex flex-1 min-h-0 max-h-[25vh] p-0"
            className="flex min-h-0 flex-1 p-0"
          >
            <AssistantProfileInfoPanel
              assistant={assistant}
              userTimezone={userTimezone}
              onEdit={() => onEdit(assistant)}
              canWrite={canWrite}
              spendingActions={showSpending ? assistantActions.spending : undefined}
              onSpendingDisplayChange={onAssistantSpendingChange}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Manage Resources Section */}
        <AccordionItem value="resources">
          <AccordionTriggerWithButtons className="text-title">
            <div className="flex items-center gap-2 text-[color:var(--muted-foreground)] transition-colors duration-200 hover:text-[color:var(--foreground)]">
              <Briefcase className="h-4 w-4" />
              <span className="text-body">Resources</span>
            </div>
          </AccordionTriggerWithButtons>
          <AccordionContent
            outerClassName="data-[state=open]:flex flex-col flex-1 min-h-0 max-h-[20vh] p-0"
            className="min-h-0 flex-1 p-4"
          >
            <AssistantResourcesManager
              assistant={assistant}
              assistantActions={assistantActions}
              onOpenContactManager={onOpenContactManager}
              onOpenSetupInstructions={onOpenSetupInstructions}
              onAssistantUpdated={onAssistantUpdated}
              canWrite={canWrite}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Chat Section */}
        <AccordionItem value="chat" className="flex min-h-0 flex-1 flex-col">
          <AccordionTriggerWithButtons
            className="text-title"
            buttonSlot={
              <div className="flex items-center gap-1">
                {isInThisCall ? (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onStartCall(assistant, 'video')}
                          disabled={isCallButtonDisabled}
                          data-testid="call-return-button"
                        >
                          {isConnectingCall ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Phone className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>{callButtonTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <DropdownMenu>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <DropdownMenuTrigger asChild>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={isCallButtonDisabled}
                              data-testid="call-menu-trigger"
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                        </DropdownMenuTrigger>
                        <TooltipContent side="top">
                          <p>{callButtonTooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onStartCall(assistant, 'video')}
                        data-testid="call-option-video"
                      >
                        <Video className="mr-2 h-4 w-4" />
                        <span>Video Call</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onStartCall(assistant, 'audio')}
                        data-testid="call-option-audio"
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        <span>Audio Call</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            }
          >
            <div className="flex items-center gap-2 text-[color:var(--muted-foreground)] transition-colors duration-200 hover:text-[color:var(--foreground)]">
              <MessageSquare className="h-4 w-4" />
              <span className="text-body">Chat</span>
            </div>
          </AccordionTriggerWithButtons>
          <AccordionContent
            outerClassName="data-[state=open]:flex flex-1 min-h-0 p-0 data-[state=closed]:hidden"
            className="flex min-h-0 flex-1 p-0"
          >
            <AssistantProfileChatPanel
              assistant={assistant}
              assistantActions={assistantActions}
              chatHistories={chatHistories}
              setChatHistories={setChatHistories}
              userEmail={userEmail}
              isFirstView={isFirstView}
              preHireChat={preHireChat}
              onFirstViewCompleted={onFirstViewCompleted}
              spendingGate={spendingGate}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
