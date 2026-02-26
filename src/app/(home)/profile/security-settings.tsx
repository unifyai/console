'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/UI/button';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import TotpSetup from './totp-setup';
import TotpInput from '@/app/login/totp-input';
import RecoveryCodeDisplay from './recovery-codes';
import { toast } from 'sonner';

interface MfaStatus {
  enabled: boolean;
  method?: string;
  confirmedAt?: string;
  recoveryCodesRemaining?: number;
}

/**
 * Security Settings section for the Profile page.
 *
 * Handles:
 * - Viewing MFA status
 * - Enabling 2FA (via TotpSetup)
 * - Disabling 2FA (with TOTP confirmation)
 * - Regenerating recovery codes
 */
const SecuritySettings = () => {
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDisable, setShowDisable] = useState(false);
  const [disableError, setDisableError] = useState<string | undefined>();
  const [isDisabling, setIsDisabling] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regeneratedCodes, setRegeneratedCodes] = useState<string[] | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/mfa/status');
      if (res.ok) {
        const data = await res.json();
        setMfaStatus(data);
      } else {
        setMfaStatus({ enabled: false });
      }
    } catch {
      setMfaStatus({ enabled: false });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleDisable = useCallback(
    async (code: string) => {
      setDisableError(undefined);
      setIsDisabling(true);

      try {
        const res = await fetch('/api/auth/mfa/disable', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!res.ok) {
          const data = await res.json();
          setDisableError(data.message ?? data.error ?? 'Failed to disable 2FA.');
          setIsDisabling(false);
          return;
        }

        toast.success('Two-factor authentication has been disabled.');
        setShowDisable(false);
        await fetchStatus();
      } catch {
        setDisableError('Failed to disable 2FA.');
      } finally {
        setIsDisabling(false);
      }
    },
    [fetchStatus],
  );

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);

    try {
      const res = await fetch('/api/auth/mfa/recovery-codes', { method: 'POST' });
      if (!res.ok) {
        toast.error('Failed to regenerate recovery codes.');
        setIsRegenerating(false);
        return;
      }

      const data = await res.json();
      setRegeneratedCodes(data.recoveryCodes ?? []);
      setShowRegenerate(true);
    } catch {
      toast.error('Failed to regenerate recovery codes.');
    } finally {
      setIsRegenerating(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-body">Loading 2FA status...</span>
      </div>
    );
  }

  if (!mfaStatus?.enabled) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldOff className="h-4 w-4" />
          <span className="text-body">Two-factor authentication is not enabled.</span>
        </div>
        <TotpSetup onEnabled={fetchStatus} />
      </div>
    );
  }

  // MFA is enabled
  return (
    <div className="flex flex-col gap-4" data-testid="mfa-enabled-section">
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <ShieldCheck className="h-4 w-4" />
        <span className="text-body font-medium">
          Two-factor authentication is enabled
        </span>
      </div>

      {mfaStatus.recoveryCodesRemaining !== undefined && (
        <p
          className={`text-sm ${
            mfaStatus.recoveryCodesRemaining < 3
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-muted-foreground'
          }`}
        >
          Recovery codes remaining: {mfaStatus.recoveryCodesRemaining}
          {mfaStatus.recoveryCodesRemaining < 3 && (
            <span className="font-medium"> — Consider regenerating your codes</span>
          )}
        </p>
      )}

      {/* Regenerate Recovery Codes */}
      {showRegenerate && regeneratedCodes ? (
        <RecoveryCodeDisplay
          codes={regeneratedCodes}
          onDone={() => {
            setShowRegenerate(false);
            setRegeneratedCodes(null);
            fetchStatus();
          }}
        />
      ) : (
        <Button
          variant="outline"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          data-testid="regenerate-codes-btn"
        >
          {isRegenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            'Regenerate Recovery Codes'
          )}
        </Button>
      )}

      {/* Disable 2FA */}
      {showDisable ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <h4 className="mb-3 font-medium text-destructive">Disable Two-Factor Authentication</h4>
          <p className="mb-3 text-caption text-muted-foreground">
            Enter your current TOTP code to disable 2FA.
          </p>
          <TotpInput
            onSubmit={handleDisable}
            error={disableError}
            isLoading={isDisabling}
            label=""
          />
          <Button
            variant="link"
            onClick={() => {
              setShowDisable(false);
              setDisableError(undefined);
            }}
            className="mt-2 text-caption text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="destructive"
          onClick={() => setShowDisable(true)}
          data-testid="disable-2fa-btn"
        >
          Disable Two-Factor Authentication
        </Button>
      )}
    </div>
  );
};

export default SecuritySettings;

