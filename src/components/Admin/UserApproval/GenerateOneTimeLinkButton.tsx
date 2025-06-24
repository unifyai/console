import * as React from 'react';
import { Button } from "@/components/UI/button";
import { Input } from "@/components/UI/input";
import { Label } from "@/components/UI/label";
import { Link, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/UI/dialog";
import { showErrorToast, showSuccessToast } from '@/components/notifications';

interface GenerateOneTimeLinkButtonProps {
    onGenerateLink: (expiresInDays: number) => Promise<string | null>; // Returns the full URL or null
    isLoading: boolean;
}

export function GenerateOneTimeLinkButton({ onGenerateLink, isLoading }: GenerateOneTimeLinkButtonProps) {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [generatedUrl, setGeneratedUrl] = React.useState<string | null>(null);
    const [expiresInDays, setExpiresInDays] = React.useState<number>(7);
    const [copied, setCopied] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false); // Separate from parent isLoading for dialog interactions

    const handleGenerate = async () => {
        if (expiresInDays <= 0) {
            showErrorToast("Expiration days must be a positive number.");
            return;
        }
        setIsGenerating(true);
        setGeneratedUrl(null); 
        const url = await onGenerateLink(expiresInDays);
        if (url) {
            setGeneratedUrl(url);
        }
        // Error toast is handled by the hook
        setIsGenerating(false);
    };

    const handleCopyToClipboard = () => {
        if (generatedUrl) {
            navigator.clipboard.writeText(generatedUrl).then(() => {
                setCopied(true);
                showSuccessToast("Link copied to clipboard!");
                setTimeout(() => setCopied(false), 2000);
            }).catch(err => {
                showErrorToast("Failed to copy link.");
                console.error('Failed to copy: ', err);
            });
        }
    };

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setGeneratedUrl(null); // Reset generated URL when dialog closes
        setExpiresInDays(7); // Reset expiration days
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); else setIsDialogOpen(true); }}>
            <DialogTrigger asChild>
                <Button variant="outline" disabled={isLoading}>
                    <Link className="mr-2 h-4 w-4" />
                    Generate One-Time Approval Link
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Generate Link</DialogTitle>
                    <DialogDescription>
                        Create a unique link that users can click to get automatically approved for assistant hiring.
                        The link will grant credits for one assistant.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="expiresInDays" className="text-right col-span-1">
                            Expires in
                        </Label>
                        <Input
                            id="expiresInDays"
                            type="number"
                            value={expiresInDays}
                            onChange={(e) => setExpiresInDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="col-span-2 h-9"
                            min="1"
                        />
                        <span className="col-span-1 text-sm text-muted-foreground">days</span>
                    </div>
                    {generatedUrl && (
                        <div className="space-y-2 mt-2">
                            <Label htmlFor="generatedLink">Generated Link:</Label>
                            <div className="flex items-center space-x-2">
                                <Input
                                    id="generatedLink"
                                    value={generatedUrl}
                                    readOnly
                                    className="flex-1 h-9 bg-muted"
                                />
                                <Button type="button" size="icon" variant="outline" onClick={handleCopyToClipboard} className="h-9 w-9">
                                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center">
                                <AlertTriangle className="h-3 w-3 mr-1 text-orange-500" />
                                This link can only be used once.
                            </p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleDialogClose} disabled={isGenerating}>
                        Close
                    </Button>
                    <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {generatedUrl ? "Re-generate" : "Generate Link"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}