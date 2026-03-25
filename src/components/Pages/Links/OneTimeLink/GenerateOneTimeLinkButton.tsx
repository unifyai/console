import * as React from 'react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Link, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/UI/dialog';
import { showErrorToast, showSuccessToast } from '@/components/Common/Toasts/notifications';

interface GenerateOneTimeLinkButtonProps {
  onGenerateLink: (
    expiresInDays: number,
    creditAmount: number | null,
    maxClaims: number | null,
    name: string | null
  ) => Promise<string | null>;
  isLoading: boolean;
}

export function GenerateOneTimeLinkButton({
  onGenerateLink,
  isLoading,
}: GenerateOneTimeLinkButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [generatedUrl, setGeneratedUrl] = React.useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = React.useState<number>(7);
  const [creditAmount, setCreditAmount] = React.useState<string>('');
  const [maxClaims, setMaxClaims] = React.useState<number>(1);
  const [unlimitedClaims, setUnlimitedClaims] = React.useState(false);
  const [linkName, setLinkName] = React.useState<string>('');
  const [copied, setCopied] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleGenerate = async () => {
    if (expiresInDays <= 0) {
      showErrorToast('Expiration days must be a positive number.');
      return;
    }
    const parsedAmount = creditAmount.trim() !== '' ? parseFloat(creditAmount) : null;
    if (parsedAmount !== null && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      showErrorToast('Credit amount must be a positive number.');
      return;
    }
    if (!unlimitedClaims && maxClaims < 1) {
      showErrorToast('Max claims must be at least 1.');
      return;
    }
    setIsGenerating(true);
    setGeneratedUrl(null);
    const url = await onGenerateLink(expiresInDays, parsedAmount, unlimitedClaims ? null : maxClaims, linkName.trim() || null);
    if (url) {
      setGeneratedUrl(url);
    }
    setIsGenerating(false);
  };

  const handleCopyToClipboard = () => {
    if (generatedUrl) {
      navigator.clipboard
        .writeText(generatedUrl)
        .then(() => {
          setCopied(true);
          showSuccessToast('Link copied to clipboard!');
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          showErrorToast('Failed to copy link.');
          console.error('Failed to copy: ', err);
        });
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setGeneratedUrl(null);
    setExpiresInDays(7);
    setCreditAmount('');
    setMaxClaims(1);
    setUnlimitedClaims(false);
    setLinkName('');
  };

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (!open) handleDialogClose();
        else setIsDialogOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={isLoading}>
          <Link className="mr-2 h-4 w-4" />
          Generate Credit Grant Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Generate Credit Grant Link</DialogTitle>
          <DialogDescription>
            Create a link that grants credits when claimed. Set max claims &gt; 1 or check
            unlimited (∞) to allow multiple users to redeem the same link. Each user can only
            ever claim one link.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="linkName" className="col-span-1 text-right">
              Name
            </Label>
            <Input
              id="linkName"
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="col-span-3 h-9"
              placeholder="e.g. Twitter campaign, Partner outreach"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="expiresInDays" className="col-span-1 text-right">
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
            <span className="text-body-muted col-span-1">days</span>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="creditAmount" className="col-span-1 text-right">
              Credits
            </Label>
            <Input
              id="creditAmount"
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="col-span-2 h-9"
              min="1"
              step="1"
              placeholder="Default 10 USD"
            />
            <span className="text-body-muted col-span-1">USD</span>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maxClaims" className="col-span-1 text-right">
              Max claims
            </Label>
            {unlimitedClaims ? (
              <span className="text-body-muted col-span-2 px-3 text-sm">Unlimited</span>
            ) : (
              <Input
                id="maxClaims"
                type="number"
                value={maxClaims}
                onChange={(e) => setMaxClaims(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="col-span-2 h-9"
                min="1"
              />
            )}
            <label className="col-span-1 flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={unlimitedClaims}
                onChange={(e) => setUnlimitedClaims(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300"
              />
              <span className="text-body-muted whitespace-nowrap">∞</span>
            </label>
          </div>
          {generatedUrl && (
            <div className="mt-2 space-y-2">
              <Label htmlFor="generatedLink">Generated Link:</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="generatedLink"
                  value={generatedUrl}
                  readOnly
                  className="h-9 flex-1 bg-muted"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={handleCopyToClipboard}
                  className="h-9 w-9"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-caption flex items-center">
                <AlertTriangle className="mr-1 h-3 w-3 text-orange-500" />
                {unlimitedClaims
                  ? 'This link can be claimed by unlimited users.'
                  : maxClaims === 1
                    ? 'This link can only be used once.'
                    : `This link can be claimed by up to ${maxClaims} users.`}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleDialogClose}
            disabled={isGenerating}
          >
            Close
          </Button>
          <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {generatedUrl ? 'Re-generate' : 'Generate Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
