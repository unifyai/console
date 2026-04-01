'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/UI/button';
import { Copy, Download, Check } from 'lucide-react';

interface RecoveryCodeDisplayProps {
  /** Plaintext recovery codes to display. */
  codes: string[];
  /** Called when the user acknowledges they've saved the codes. */
  onDone: () => void;
}

/**
 * Displays recovery codes with Copy / Download options.
 *
 * Used after initial TOTP setup and after regenerating codes.
 */
const RecoveryCodeDisplay = ({ codes, onDone }: RecoveryCodeDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
    }
  }, [codes]);

  const handleDownload = useCallback(() => {
    const content = [
      'Unify Recovery Codes',
      '====================',
      '',
      'Store these codes in a safe place.',
      'Each code can only be used once.',
      '',
      ...codes,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'unify-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }, [codes]);

  return (
    <div className="flex flex-col gap-4" data-testid="recovery-codes-display">
      <p className="text-body text-center text-muted-foreground">
        Store these codes in a safe place. You can sign in with a code if you lose access to your
        authenticator app. Each code is usable once.
      </p>

      <div className="bg-muted/50 text-caption grid grid-cols-2 gap-2 rounded-lg border border-border p-4 font-mono">
        {codes.map((code, i) => (
          <div key={i} className="flex items-center gap-2" data-testid={`recovery-code-${i}`}>
            <span className="text-muted-foreground">{i + 1}.</span>
            <span>{code}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleCopy}
          className="flex-1"
          data-testid="copy-codes-btn"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handleDownload}
          className="flex-1"
          data-testid="download-codes-btn"
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="rounded border-input"
          data-testid="acknowledge-codes-checkbox"
        />
        I&apos;ve saved my recovery codes in a safe place
      </label>

      <Button onClick={onDone} disabled={!acknowledged} data-testid="codes-done-btn">
        Done
      </Button>
    </div>
  );
};

export default RecoveryCodeDisplay;
