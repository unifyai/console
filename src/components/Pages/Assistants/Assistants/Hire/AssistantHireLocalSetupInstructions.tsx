import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { ClipboardCopy, Laptop } from 'lucide-react';
import { toast } from 'sonner';

interface AssistantHireLocalSetupInstructionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    os: string;
}

const CodeBlock: React.FC<{ command: string }> = ({ command }) => {
    const handleCopy = () => {
        navigator.clipboard.writeText(command);
        toast.success("Command copied to clipboard!");
    };

    return (
        <div className="bg-muted p-3 rounded-md font-mono text-caption flex items-center justify-between">
            <pre className="overflow-x-auto"><code>{command}</code></pre>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleCopy}>
                <ClipboardCopy className="h-4 w-4" />
            </Button>
        </div>
    );
};

export function AssistantHireLocalSetupInstructionsDialog({ isOpen, onClose, os }: AssistantHireLocalSetupInstructionsDialogProps) {

    const renderInstructions = () => {
        switch (os) {
            case 'ubuntu':
                return (
                    <div className="space-y-2">
                        <p className="text-body text-muted-foreground">
                            To connect your assistant to your local Ubuntu machine, please run the following command in your terminal:
                        </p>
                        <CodeBlock command="curl -sSL https://get.unify.ai/desktop | bash" />
                        <p className="text-caption text-muted-foreground pt-2">
                            This script will download and run the Unify Desktop installer. Follow the on-screen prompts to complete the setup.
                        </p>
                    </div>
                );
            case 'windows':
            case 'macos':
                return (
                    <p className="text-body text-muted-foreground">
                        Support for {os === 'windows' ? 'Windows' : 'macOS'} is coming soon. You can switch to a Remote setup in the assistant&apos;s edit settings for now.
                    </p>
                );
            default:
                return <p className="text-body text-muted-foreground">Unknown operating system selected.</p>;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Laptop className="h-5 w-5" />
                        Local Desktop Setup Instructions
                    </DialogTitle>
                    <DialogDescription>
                        Follow these steps to complete your assistant&apos;s local setup.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {renderInstructions()}
                </div>

                <DialogFooter>
                    <Button onClick={onClose}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}