'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/UI/button';
import TotpInput from '@/app/login/totp-input';
import RecoveryCodeDisplay from './recovery-codes';
import { Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';

type SetupStep = 'idle' | 'qr' | 'confirm' | 'recovery';

/**
 * TOTP Setup flow for the Security tab.
 *
 * Steps:
 *   idle     → user clicks "Enable 2FA"
 *   qr       → QR code is displayed, user scans it
 *   confirm  → user enters the 6-digit code to confirm
 *   recovery → recovery codes are displayed for download/copy
 */
const TotpSetup = ({
  onEnabled,
  autoStart = false,
}: {
  /** Called after MFA is fully enabled (recovery codes acknowledged). */
  onEnabled?: () => void;
  /** When true, automatically begin setup on mount (skip the idle button). */
  autoStart?: boolean;
}) => {
  const [step, setStep] = useState<SetupStep>('idle');
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = useCallback(async () => {
    setError(undefined);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? data.error ?? 'Failed to start setup.');
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      setQrUri(data.qrCodeUri);
      setStep('qr');
    } catch {
      setError('Failed to start 2FA setup.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStartedRef.current && step === 'idle') {
      autoStartedRef.current = true;
      handleSetup();
    }
  }, [autoStart, step, handleSetup]);

  const handleConfirm = useCallback(
    async (code: string) => {
      setError(undefined);
      setIsLoading(true);

      try {
        const res = await fetch('/api/auth/mfa/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message ?? data.error ?? 'Invalid code.');
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        setRecoveryCodes(data.recoveryCodes ?? []);
        setStep('recovery');
        toast.success('Two-factor authentication has been enabled!');
      } catch {
        setError('Confirmation failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const handleDone = useCallback(() => {
    setStep('idle');
    setQrUri(null);
    setRecoveryCodes([]);
    onEnabled?.();
  }, [onEnabled]);

  if (step === 'idle') {
    return (
      <div className="flex flex-col gap-3">
        {error && <p className="text-caption text-destructive">{error}</p>}
        <Button
          onClick={handleSetup}
          disabled={isLoading}
          variant="default"
          data-testid="enable-2fa-btn"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting up...
            </>
          ) : (
            'Enable Two-Factor Authentication'
          )}
        </Button>
      </div>
    );
  }

  if (step === 'qr') {
    return (
      <div className="flex flex-col items-center gap-4" data-testid="totp-qr-step">

        <p className="text-body text-center text-muted-foreground">
          Scan this code with your authenticator app.
        </p>

        {qrUri && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-4 bg-white">
            <Image
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
              alt="TOTP QR Code"
              width={200}
              height={200}
              unoptimized
              data-testid="totp-qr-image"
            />
          </div>
        )}

        <details className="w-full max-w-sm">
          <summary className="text-caption text-muted-foreground text-center cursor-pointer hover:text-foreground transition-colors">
            Can&apos;t scan? Click to enter the key manually
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-caption text-muted-foreground">
              Enter this secret key in your authenticator app:
            </p>
            <code
              className="block break-all rounded bg-muted p-2 text-sm font-mono tracking-widest select-all text-center"
              data-testid="totp-secret"
            >
              {(() => {
                try {
                  const url = new URL(qrUri!);
                  return url.searchParams.get('secret') ?? '';
                } catch {
                  return '';
                }
              })()}
            </code>
            <p className="text-[11px] text-muted-foreground text-center">
              Account: {(() => {
                try {
                  const url = new URL(qrUri!);
                  // Path is like /Unify:email@example.com
                  return decodeURIComponent(url.pathname.replace(/^\//, ''));
                } catch {
                  return '';
                }
              })()}
            </p>
          </div>
        </details>

        <Button onClick={() => setStep('confirm')} data-testid="qr-scanned-btn">
          I&apos;ve scanned the code
        </Button>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="flex flex-col gap-4" data-testid="totp-confirm-step">
        <TotpInput
          onSubmit={handleConfirm}
          error={error}
          isLoading={isLoading}
          label="Enter the code from your authenticator app to complete setup"
        />
      </div>
    );
  }

  // step === 'recovery'
  return (
    <div className="flex flex-col gap-4" data-testid="totp-recovery-step">
      <RecoveryCodeDisplay codes={recoveryCodes} onDone={handleDone} />
    </div>
  );
};

export default TotpSetup;

