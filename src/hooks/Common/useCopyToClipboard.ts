import { useCallback, useRef, useState } from 'react';
import { showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications';

type UseCopyToClipboardProps = {
  text: string;
  copyMessage?: string;
  showSuccessNotification?: boolean;
};

export function useCopyToClipboard({
  text,
  copyMessage = 'Copied to clipboard!',
  showSuccessNotification = true,
}: UseCopyToClipboardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        if (showSuccessNotification) {
          showSuccessToast(copyMessage);
        }
        setIsCopied(true);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        timeoutRef.current = setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      })
      .catch(() => {
        showErrorToast('Failed to copy to clipboard.');
      });
  }, [text, copyMessage, showSuccessNotification]);

  return { isCopied, handleCopy };
}
