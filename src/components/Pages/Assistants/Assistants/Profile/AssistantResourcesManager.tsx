import * as React from 'react';
import { Laptop, KeyRound, Check, Contact } from 'lucide-react';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { AssistantSecretsManager } from './AssistantSecretsManager';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface AssistantResourcesManagerProps {
  assistant: Assistant;
  assistantActions: AssistantActions;
  onOpenContactManager: (assistant: Assistant, tab?: 'email' | 'phone' | 'whatsapp') => void;
  /** Whether the current user can edit this assistant's resources */
  canWrite?: boolean;
}

const ContactItem: React.FC<{
  value: string;
  icon: React.ReactNode;
  tooltip?: string;
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
  canWrite = true,
}: AssistantResourcesManagerProps) {
  const [isSecretsManagerOpen, setIsSecretsManagerOpen] = React.useState(false);
  const assistantContext = `${assistant.firstName}${assistant.surname}`;

  return (
    <>
      <div className="w-full space-y-2">
        {assistant.desktopUrl && (
          <ContactItem
            value="Copy local workspace link"
            copyValue={assistant.desktopUrl}
            tooltip={'Copy the URL of your local desktop configuration'}
            icon={<Laptop className="h-4 w-4 flex-shrink-0" />}
            isCopyable
          />
        )}
        <ContactItem
          value="Contact Details"
          icon={<Contact className="h-4 w-4 flex-shrink-0" />}
          handleClick={() => onOpenContactManager(assistant)}
        />
        <ContactItem
          value="Secrets"
          icon={<KeyRound className="h-4 w-4 flex-shrink-0" />}
          handleClick={() => setIsSecretsManagerOpen(true)}
        />
      </div>

      {isSecretsManagerOpen && (
        <AssistantSecretsManager
          isOpen={isSecretsManagerOpen}
          onClose={() => setIsSecretsManagerOpen(false)}
          assistantContext={assistantContext}
          secretActions={assistantActions.secret}
          canWrite={canWrite}
        />
      )}
    </>
  );
}
