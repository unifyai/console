'use client';

import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/Common/useCopyToClipboard';
import ActionButton from '@/components/Common/Buttons/Action';

type CopyButtonProps = {
  content: string;
  copyMessage?: string;
  tooltipContent?: string;
  className?: string;
  /** When false, only the in-button checkmark feedback is shown (no toast). */
  showSuccessNotification?: boolean;
};

export function CopyButton({
  content,
  copyMessage,
  tooltipContent,
  className,
  showSuccessNotification,
}: CopyButtonProps) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: content,
    copyMessage,
    showSuccessNotification,
  });

  return (
    <ActionButton
      variant="ghost"
      tooltip={tooltipContent ?? 'Copy'}
      className={cn('relative', className)}
      aria-label="Copy to clipboard"
      onClick={(e) => {
        e.stopPropagation();
        handleCopy();
      }}
      icon={
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <Check
              className={cn(
                'h-2 w-2 transition-transform ease-in-out',
                isCopied ? 'scale-100' : 'scale-0'
              )}
            />
          </div>
          <Copy
            className={cn(
              'h-2 w-2 transition-transform ease-in-out',
              isCopied ? 'scale-0' : 'scale-100'
            )}
          />
        </>
      }
    />
  );
}
