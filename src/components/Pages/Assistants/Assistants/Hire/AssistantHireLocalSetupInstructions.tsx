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
import { Laptop, WifiOff } from 'lucide-react';
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

export function AssistantHireLocalSetupInstructionsDialog({
  isOpen,
  onClose,
  os,
}: AssistantHireLocalSetupInstructionsDialogProps) {
  const [content, setContent] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const branch = os === 'windows' ? 'win' : os;

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const fetchInstructions = async () => {
      setIsLoading(true);
      setError(null);
      setContent(null);

      // Construct the URL for the raw README.md file
      const readmeUrl = `https://raw.githubusercontent.com/unifyai/unify-desktop-assistant/${branch}/README.md`;

      try {
        const response = await fetch(readmeUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch instructions (status: ${response.status})`);
        }
        const textContent = await response.text();
        setContent(textContent);
      } catch (err) {
        console.error('Failed to fetch setup instructions:', err);
        setError(
          `Could not load setup instructions for ${os}. Please check the repository or try again later.`
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstructions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, os]);

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
            Follow these steps to complete your assistant&apos;s local setup for {os}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="my-4 max-h-[60vh] pr-4">{renderContent()}</ScrollArea>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
