import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Download, Laptop, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/UI/skeleton';
import Markdown from 'react-markdown';
import { ScrollArea } from '@/components/UI/scroll-area';

interface AssistantHireLocalSetupInstructionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  os: string;
}

const LoadingSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-4 w-1/2 bg-muted" />
    <Skeleton className="h-4 w-full bg-muted" />
    <Skeleton className="h-4 w-full bg-muted" />
    <Skeleton className="mt-2 h-10 w-full bg-muted" />
    <Skeleton className="h-4 w-4/5 bg-muted" />
  </div>
);

// Map OS to display name for the download button
const OS_DISPLAY_NAMES: Record<string, string> = {
  ubuntu: 'Ubuntu (.deb)',
  windows: 'Windows (.exe)',
  macos: 'macOS (.dmg)',
};

export function AssistantHireLocalSetupInstructionsDialog({
  isOpen,
  onClose,
  os,
}: AssistantHireLocalSetupInstructionsDialogProps) {
  const [content, setContent] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const fetchInstructions = async () => {
      setIsLoading(true);
      setError(null);
      setContent(null);

      try {
        // Fetch instructions from our API route (proxies to GitHub)
        const response = await fetch(`/api/assistant/local/install?os=${os}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `Failed to fetch instructions (status: ${response.status})`
          );
        }

        const data = await response.json();
        setContent(data.content);
      } catch (err) {
        console.error('Failed to fetch setup instructions:', err);
        setError(
          err instanceof Error
            ? err.message
            : `Could not load setup instructions for ${os}. Please try again later.`
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstructions();
  }, [isOpen, os]);

  const handleDownload = () => {
    // Trigger download via the API route
    window.open(`/api/assistant/local/download?os=${os}`, '_blank');
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-destructive">
          <WifiOff className="mb-2 h-8 w-8" />
          <p className="text-body">{error}</p>
        </div>
      );
    }

    if (content) {
      return (
        // Use Tailwind's typography plugin for nice default markdown styling
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <Markdown>{content}</Markdown>
        </div>
      );
    }

    return null; // Should not be reached if logic is sound
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Laptop className="h-5 w-5" />
            Local Desktop Setup Instructions
          </DialogTitle>
          <DialogDescription>
            Follow these steps to complete your martian&apos;s local setup for {os}. Installing the
            desktop app lets your assistant see and control this machine — its apps, files, and
            logged-in sessions — during local desktop sessions.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="my-4 max-h-[60vh] pr-4">{renderContent()}</ScrollArea>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={isLoading || !!error}
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Download {OS_DISPLAY_NAMES[os] || os}
          </Button>
          <Button onClick={onClose} className="w-full sm:w-auto">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
