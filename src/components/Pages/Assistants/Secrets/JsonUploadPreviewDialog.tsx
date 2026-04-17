import * as React from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Checkbox } from '@/components/UI/checkbox';
import type { PendingUpload } from '@/hooks/Assistants/useAssistantSecrets';

interface JsonUploadPreviewDialogProps {
  pendingUpload: PendingUpload;
  isSubmitting: boolean;
  onConfirm: (options: { splitKeys: boolean; baseFolder: string; secretName: string }) => void;
  onCancel: () => void;
}

export function JsonUploadPreviewDialog({
  pendingUpload,
  isSubmitting,
  onConfirm,
  onCancel,
}: JsonUploadPreviewDialogProps) {
  const [splitKeys, setSplitKeys] = React.useState(false);
  const [baseFolder, setBaseFolder] = React.useState('');
  const [secretName, setSecretName] = React.useState(pendingUpload.fileName);

  const topLevelKeys = Object.keys(pendingUpload.parsed);
  const trimmedFolder = baseFolder.replace(/\/+$/, '').replace(/^\/+/, '');
  const addPrefix = (name: string) => (trimmedFolder ? `${trimmedFolder}/${name}` : name);

  const previewNames = splitKeys
    ? topLevelKeys.map((k) => addPrefix(k))
    : [addPrefix(secretName || pendingUpload.fileName)];

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md" data-testid="secrets-upload-preview">
        <DialogHeader>
          <DialogTitle>Upload JSON</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-caption mb-2 block">Base folder (optional)</Label>
            <Input
              value={baseFolder}
              onChange={(e) => setBaseFolder(e.target.value)}
              placeholder="e.g. gcp/prod"
              className="h-8 text-sm"
              disabled={isSubmitting}
            />
          </div>

          {!splitKeys && (
            <div>
              <Label className="text-caption mb-2 block">Secret name</Label>
              <Input
                value={secretName}
                onChange={(e) => setSecretName(e.target.value)}
                placeholder={pendingUpload.fileName}
                className="h-8 text-sm"
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="split-keys"
              checked={splitKeys}
              onCheckedChange={(checked) => setSplitKeys(checked === true)}
              disabled={isSubmitting}
            />
            <label htmlFor="split-keys" className="cursor-pointer text-sm">
              Split into {topLevelKeys.length} separate secret{topLevelKeys.length === 1 ? '' : 's'}
            </label>
          </div>

          <div>
            <Label className="text-caption mb-2 block">
              {splitKeys ? 'Secrets to create' : 'Secret to create'}
            </Label>
            <div className="bg-muted/50 max-h-48 overflow-auto rounded border p-2">
              {previewNames.map((name) => (
                <div key={name} className="flex items-center gap-1.5 py-0.5">
                  <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="text-code-sm">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                splitKeys,
                baseFolder: trimmedFolder,
                secretName: secretName || pendingUpload.fileName,
              })
            }
            disabled={isSubmitting || (!splitKeys && !secretName.trim())}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
