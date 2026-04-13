import * as React from 'react';
import { KeyRound, Check, Contact, Monitor } from 'lucide-react';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import { AssistantSecretsManager } from './AssistantSecretsManager';
import { AssistantDesktopLinker } from './AssistantDesktopLinker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface AssistantResourcesManagerProps {
  assistant: Assistant;
  assistantActions: AssistantActions;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  onAssistantUpdated?: (assistantId: string, patch: Partial<Assistant>) => void;
  /** Whether the current user can edit this assistant's resources */
  canWrite?: boolean;
}

const ContactItem: React.FC<{
  value: string;
  icon: React.ReactNode;
  tooltip?: React.ReactNode;
  isCopyable?: boolean;
  copyValue?: string;
  handleClick?: () => void;
  textClassName?: string;
}> = ({ value, icon, tooltip, isCopyable = false, copyValue, handleClick, textClassName }) => {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = () => {
    const textToCopy = copyValue ?? value;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const onClick = () => {
    isCopyable && handleCopy();
    handleClick && handleClick();
  };

  const content = (
    <div
      className="group grid w-fit cursor-pointer grid-cols-[auto_1fr] items-center gap-2"
      onClick={onClick}
    >
      <div className="flex-shrink-0 text-[color:var(--muted-foreground)] transition-colors duration-200 group-hover:text-[color:var(--foreground)]">
        {isCopyable && isCopied ? <Check className="h-4 w-4 text-green-500" /> : icon}
      </div>
      <span
        className={`text-caption min-w-0 truncate text-[color:var(--muted-foreground)] transition-colors duration-200 group-hover:text-[color:var(--foreground)] ${textClassName}`}
      >
        {value || '-'}
      </span>
    </div>
  );

  if (!tooltip) {
    return content;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export function AssistantResourcesManager({
  assistant,
  assistantActions,
  onOpenContactManager,
  onAssistantUpdated,
  canWrite = true,
}: AssistantResourcesManagerProps) {
  const [isSecretsManagerOpen, setIsSecretsManagerOpen] = React.useState(false);
  const [isDesktopLinkerOpen, setIsDesktopLinkerOpen] = React.useState(false);

  return (
    <>
      <div className="flex w-full flex-wrap gap-x-4 gap-y-2">
        <ContactItem
          value="Contact Details"
          tooltip="Manage email, phone, WhatsApp, and Discord contacts"
          icon={<Contact className="h-4 w-4 flex-shrink-0" />}
          handleClick={() => onOpenContactManager(assistant)}
        />
        <ContactItem
          value="Secrets"
          tooltip="Manage API keys and credentials"
          icon={<KeyRound className="h-4 w-4 flex-shrink-0" />}
          handleClick={() => setIsSecretsManagerOpen(true)}
        />
        {/* {canWrite && (
          <ContactItem
            value={assistant.userDesktopId ? 'User Desktop Linked' : 'Link User Desktop'}
            tooltip={
              assistant.userDesktopId
                ? 'Manage linked user desktop device'
                : 'Assign a registered desktop device to this assistant'
            }
            icon={<Monitor className="h-4 w-4 flex-shrink-0" />}
            handleClick={() => setIsDesktopLinkerOpen(true)}
          />
        )} */}
      </div>

      {isSecretsManagerOpen && (
        <AssistantSecretsManager
          isOpen={isSecretsManagerOpen}
          onClose={() => setIsSecretsManagerOpen(false)}
          assistantId={assistant.agentId}
          ownerId={assistant.userId}
          secretActions={assistantActions.secret}
          canWrite={canWrite}
        />
      )}

      {/* {isDesktopLinkerOpen && (
        <AssistantDesktopLinker
          isOpen={isDesktopLinkerOpen}
          onClose={() => setIsDesktopLinkerOpen(false)}
          assistant={assistant}
          assistantActions={assistantActions}
          onLinked={(userDesktopId) => {
            onAssistantUpdated?.(assistant.agentId, { userDesktopId });
          }}
        />
      )} */}
    </>
  );
}
