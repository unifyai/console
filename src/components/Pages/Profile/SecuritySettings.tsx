'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/UI/button';
import { Loader2 } from 'lucide-react';
import TotpSetup from '@/components/Common/Auth/TotpSetup';
import TotpInput from '@/components/Common/Auth/TotpInput';
import RecoveryCodeDisplay from '@/components/Common/Auth/RecoveryCodeDisplay';
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
  const router = useRouter();
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDisable, setShowDisable] = useState(false);
  const [disableError, setDisableError] = useState<string | undefined>();
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableWithRecovery, setDisableWithRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
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
    async (code: string, isRecovery = false) => {
      setDisableError(undefined);
      setIsDisabling(true);

      const payload = isRecovery ? { recoveryCode: code } : { code };

      try {
        const res = await fetch('/api/auth/mfa/disable', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          setDisableError(data.message ?? data.error ?? 'Failed to disable 2FA.');
          setIsDisabling(false);
          return;
        }

        toast.success('Two-factor authentication has been disabled.');
        setShowDisable(false);
        setDisableWithRecovery(false);
        setRecoveryCode('');
        await fetchStatus();
        router.refresh();
      } catch {
        setDisableError('Failed to disable 2FA.');
      } finally {
        setIsDisabling(false);
      }
    },
    [fetchStatus, router]
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
      <TotpSetup
        autoStart
        onEnabled={() => {
          setMfaStatus({ enabled: true }); // Optimistic update to prevent button flash
          fetchStatus(); // Confirm from server
          router.refresh();
        }}
      />
    );
  }

  // MFA is enabled
  return (
    <div className="flex flex-col gap-4" data-testid="mfa-enabled-section">
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
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4">
          <h4 className="mb-3 font-medium text-destructive">Disable Two-Factor Authentication</h4>

          {!disableWithRecovery ? (
            <>
              <p className="text-caption mb-3 text-muted-foreground">
                Enter your current TOTP code to disable 2FA.
              </p>
              <TotpInput
                onSubmit={(code) => handleDisable(code, false)}
                error={disableError}
                isLoading={isDisabling}
                label=""
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="link"
                  onClick={() => {
                    setDisableWithRecovery(true);
                    setDisableError(undefined);
                  }}
                  className="text-caption h-auto p-0 text-muted-foreground"
                >
                  Use a recovery code instead
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-caption mb-3 text-muted-foreground">
                Enter one of your recovery codes to disable 2FA.
              </p>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="Enter recovery code"
                  className="text-caption w-full rounded-md border border-input bg-background px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="disable-recovery-input"
                  autoFocus
                />
                {disableError && <p className="text-caption text-destructive">{disableError}</p>}
                <Button
                  onClick={() => handleDisable(recoveryCode.trim(), true)}
                  disabled={isDisabling || !recoveryCode.trim()}
                  variant="destructive"
                  data-testid="disable-recovery-submit"
                >
                  {isDisabling ? 'Disabling...' : 'Disable with Recovery Code'}
                </Button>
              </div>
              <Button
                variant="link"
                onClick={() => {
                  setDisableWithRecovery(false);
                  setDisableError(undefined);
                  setRecoveryCode('');
                }}
                className="text-caption mt-2 h-auto p-0 text-muted-foreground"
              >
                Use authenticator app instead
              </Button>
            </>
          )}

          <div className="mt-2">
            <Button
              variant="link"
              onClick={() => {
                setShowDisable(false);
                setDisableError(undefined);
                setDisableWithRecovery(false);
                setRecoveryCode('');
              }}
              className="text-caption h-auto p-0 text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
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
