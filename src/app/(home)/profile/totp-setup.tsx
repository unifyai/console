'use client';

import { useState, useCallback } from 'react';
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
}: {
  /** Called after MFA is fully enabled (recovery codes acknowledged). */
  onEnabled?: () => void;
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
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          <h3 className="font-semibold">Scan QR Code</h3>
        </div>

        <p className="text-body text-center text-muted-foreground">
          Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
        </p>

        {qrUri && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-4 bg-white">
            {/* Render the QR code using a simple img tag with a QR API */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
              alt="TOTP QR Code"
              width={200}
              height={200}
              data-testid="totp-qr-image"
            />
          </div>
        )}

        <p className="text-caption text-muted-foreground text-center">
          Can&apos;t scan? Manually enter the URI into your app.
        </p>

        <Button onClick={() => setStep('confirm')} data-testid="qr-scanned-btn">
          I&apos;ve scanned the code
        </Button>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="flex flex-col gap-4" data-testid="totp-confirm-step">
        <h3 className="text-center font-semibold">Verify Setup</h3>
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

