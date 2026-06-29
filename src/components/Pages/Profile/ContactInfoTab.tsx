'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '@/types/user';
import { Input } from '@/components/UI/input';
import PhoneInput from '@/components/UI/phone-input';
import { Label } from '@/components/UI/label';
import { Button } from '@/components/UI/button';
import { Loader2, CheckCircle2, AlertCircle, Send, Mail } from 'lucide-react';
import { WhatsApp } from '@mui/icons-material';
import { FaDiscord } from 'react-icons/fa';
import { cn } from '@/lib/utils';
// Verification is handled server-side via orchestra endpoints
import { toast } from 'sonner';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { useAutoSave } from '@/hooks/Account/useAutoSave';
import { SaveStatus } from './SaveStatus';

interface VerificationState {
  value: string;
  isVerified: boolean;
  isVerifying: boolean;
  isSaving: boolean;
  codeSent: boolean;
  verificationConfirmed: boolean;
  verificationError: string | null;
  verificationInput: string;
  cooldown: number;
}

function createVerificationState(initialValue: string | null): VerificationState {
  return {
    value: initialValue || '',
    isVerified: !!initialValue,
    isVerifying: false,
    isSaving: false,
    codeSent: false,
    verificationConfirmed: false,
    verificationError: null,
    verificationInput: '',
    cooldown: 0,
  };
}

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

interface VerificationFieldProps {
  label: string;
  icon: React.ReactNode;
  state: VerificationState;
  onValueChange: (value: string) => void;
  onVerify: (isRetry?: boolean) => void;
  onCancel: () => void;
  onSubmitCode: () => void;
  onCodeChange: (value: string) => void;
  onEdit: () => void;
  onRemove: () => void;
  placeholder?: string;
  inputId?: string;
  countryTestId?: string;
}

const VerificationField = ({
  label,
  icon,
  state,
  onValueChange,
  onVerify,
  onCancel,
  onSubmitCode,
  onCodeChange,
  onEdit,
  onRemove,
  placeholder = '5551234567',
  inputId,
  countryTestId,
}: VerificationFieldProps) => {
  const isFlowActive = state.isVerifying && state.codeSent;
  const hasValue = state.value.trim().length > 0;
  const isValidFormat = PHONE_PATTERN.test(state.value.trim());
  const showFormatError = hasValue && !isValidFormat && !state.isVerified && !state.isVerifying;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <Label>{label}</Label>
      </div>
      <div className="flex items-center gap-2">
        <PhoneInput
          id={inputId}
          countryTestId={countryTestId}
          placeholder={placeholder}
          value={state.value}
          onChange={onValueChange}
          disabled={state.isVerifying || state.isVerified}
          invalid={showFormatError}
          className="flex-1"
        />
        {state.isVerified ? (
          <>
            <Button type="button" variant="default" className="h-9" disabled>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Verified
            </Button>
            <Button type="button" variant="outline" className="h-9" onClick={onEdit}>
              Change
            </Button>
            <Button type="button" variant="ghost" className="h-9" onClick={onRemove}>
              Remove
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => (state.isVerifying ? onCancel() : onVerify(false))}
            disabled={
              state.isVerifying ? state.isSaving || state.verificationConfirmed : !isValidFormat
            }
          >
            Verify
          </Button>
        )}
      </div>
      {showFormatError && (
        <p className="text-body text-strong flex items-center gap-1.5 text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          Enter a valid phone number for the selected country.
        </p>
      )}
      {isFlowActive && (
        <div className="flex items-start gap-3 border-l-2 border-muted pl-4">
          <div className="flex-1 space-y-1">
            {state.verificationConfirmed ? (
              <div className="flex items-center gap-2">
                <p className="text-body-muted">
                  {state.isSaving
                    ? 'Code accepted. Saving this number...'
                    : 'Code accepted. Save to finish.'}
                </p>
                {!state.isSaving && (
                  <Button type="button" variant="outline" size="sm" onClick={onSubmitCode}>
                    Retry save
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter verification code..."
                  value={state.verificationInput}
                  onChange={(e) => onCodeChange(e.target.value)}
                  disabled={state.isSaving}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSubmitCode();
                    }
                  }}
                  className={cn('h-9', state.verificationError && 'border-destructive')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={onSubmitCode}
                  disabled={state.isSaving}
                >
                  {state.isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            {state.verificationError && (
              <p className="text-body text-strong mt-1 flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {state.verificationError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => onVerify(true)}
              disabled={state.cooldown > 0 || state.isSaving || state.verificationConfirmed}
            >
              {state.cooldown > 0 ? `Resend (${state.cooldown}s)` : 'Resend'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9"
              onClick={onCancel}
              disabled={state.isSaving || state.verificationConfirmed}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {hasValue && isValidFormat && !state.isVerified && !state.isVerifying && (
        <p className="text-body-muted">Verify this number to save it.</p>
      )}
    </div>
  );
};

type ContactField = 'phoneNumber' | 'whatsappNumber' | 'discordId';

const ContactInfoTab = ({ user }: { user: User }) => {
  // Phone/WhatsApp verification sends codes over Twilio (reported by Orchestra
  // via the comms-layer probe). Without those credentials the verification
  // request 503s, so hide the fields rather than offer a flow that can't work.
  const { contactPhone, contactWhatsapp } = useFeatures();
  const [phoneState, setPhoneState] = useState<VerificationState>(
    createVerificationState(user.phoneNumber)
  );
  const [whatsappState, setWhatsappState] = useState<VerificationState>(
    createVerificationState(user.whatsappNumber)
  );
  const [discordId, setDiscordId] = useState(user.discordId || '');

  // Last value successfully persisted per field. Eager writes only fire when a
  // value differs from this, so re-verifying an unchanged number is a no-op.
  const savedRef = useRef<Record<ContactField, string>>({
    phoneNumber: user.phoneNumber || '',
    whatsappNumber: user.whatsappNumber || '',
    discordId: user.discordId || '',
  });

  useEffect(() => {
    setPhoneState(createVerificationState(user.phoneNumber));
    setWhatsappState(createVerificationState(user.whatsappNumber));
    setDiscordId(user.discordId || '');
    savedRef.current = {
      phoneNumber: user.phoneNumber || '',
      whatsappNumber: user.whatsappNumber || '',
      discordId: user.discordId || '',
    };
  }, [user.id, user.phoneNumber, user.whatsappNumber, user.discordId]);

  const persistField = useCallback(
    async (partial: Partial<Record<ContactField, string>>): Promise<boolean> => {
      const response = await fetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      }).catch(() => null);
      return !!response?.ok;
    },
    []
  );

  const { status, save } = useAutoSave(
    persistField,
    'Could not save your contact info. Please try again.'
  );

  const saveField = useCallback(
    async (field: ContactField, value: string, force = false): Promise<boolean> => {
      if (!force && value === savedRef.current[field]) return true;
      const ok = await save({ [field]: value });
      if (ok) savedRef.current[field] = value;
      return ok;
    },
    [save]
  );

  // Cooldown timers
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (phoneState.cooldown > 0 || whatsappState.cooldown > 0) {
      interval = setInterval(() => {
        setPhoneState((prev) =>
          prev.cooldown > 0 ? { ...prev, cooldown: Math.max(0, prev.cooldown - 1) } : prev
        );
        setWhatsappState((prev) =>
          prev.cooldown > 0 ? { ...prev, cooldown: Math.max(0, prev.cooldown - 1) } : prev
        );
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phoneState.cooldown, whatsappState.cooldown]);

  const handleVerify = useCallback(
    async (
      setter: React.Dispatch<React.SetStateAction<VerificationState>>,
      platform: 'phone' | 'whatsapp',
      state: VerificationState,
      isRetry = false
    ) => {
      if (isRetry && state.cooldown > 0) {
        toast.info(`Please wait ${state.cooldown}s before retrying.`);
        return;
      }

      setter((prev) => ({
        ...prev,
        isVerifying: true,
        isSaving: false,
        verificationError: null,
        verificationConfirmed: false,
        ...(isRetry ? { verificationInput: '' } : {}),
        cooldown: 60,
      }));

      try {
        const response = await fetch('/api/profile/phone/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: state.value,
            phoneType: platform,
          }),
        });

        const data = await response.json();

        if (!response.ok || (data.detail && !data.expiresInSeconds)) {
          toast.error(data.detail || 'Failed to send verification code.');
          setter((prev) => ({
            ...prev,
            verificationError: data.detail || 'Failed to send verification code.',
            isVerifying: false,
            isSaving: false,
          }));
        } else {
          toast.success(`Verification code sent to ${state.value}`);
          setter((prev) => ({
            ...prev,
            codeSent: true,
            verificationConfirmed: false,
          }));
        }
      } catch {
        toast.error('Failed to send verification code.');
        setter((prev) => ({
          ...prev,
          verificationError: 'Network error. Please try again.',
          isVerifying: false,
          isSaving: false,
        }));
      }
    },
    []
  );

  const handleSubmitCode = useCallback(
    async (
      setter: React.Dispatch<React.SetStateAction<VerificationState>>,
      state: VerificationState,
      platform: 'phone' | 'whatsapp'
    ) => {
      if (!state.codeSent || state.isSaving) return;
      if (!state.verificationConfirmed && !state.verificationInput.trim()) return;

      try {
        setter((prev) => ({
          ...prev,
          isSaving: true,
          verificationError: null,
        }));

        if (!state.verificationConfirmed) {
          const response = await fetch('/api/profile/phone/confirm-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: state.value,
              phoneType: platform,
              code: state.verificationInput,
            }),
          });

          const data = await response.json();

          if (!data.success) {
            setter((prev) => ({
              ...prev,
              isSaving: false,
              verificationError: data.detail || 'Incorrect code. Please try again.',
            }));
            return;
          }

          setter((prev) => ({
            ...prev,
            verificationConfirmed: true,
            verificationError: null,
          }));
        }

        const field = platform === 'phone' ? 'phoneNumber' : 'whatsappNumber';
        const saved = await saveField(field, state.value.trim(), true);

        if (saved) {
          toast.success('Number verified and saved.');
          setter((prev) => ({
            ...prev,
            isVerified: true,
            isVerifying: false,
            isSaving: false,
            codeSent: false,
            verificationConfirmed: false,
            verificationError: null,
            verificationInput: '',
          }));
        } else {
          setter((prev) => ({
            ...prev,
            isSaving: false,
            verificationConfirmed: true,
            verificationError: 'Number verified, but saving failed. Try again.',
          }));
        }
      } catch {
        setter((prev) => ({
          ...prev,
          isSaving: false,
          verificationError: 'Network error. Please try again.',
        }));
      }
    },
    [saveField]
  );

  const handleCancel = useCallback(
    (setter: React.Dispatch<React.SetStateAction<VerificationState>>) => {
      setter((prev) => ({
        ...prev,
        isVerifying: false,
        codeSent: false,
        verificationConfirmed: false,
        verificationError: null,
        verificationInput: '',
        isSaving: false,
      }));
    },
    []
  );

  const handleValueChange = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<VerificationState>>,
      field: 'phoneNumber' | 'whatsappNumber',
      otherState: VerificationState,
      value: string
    ) => {
      const savedValue = savedRef.current[field];
      const matchesSaved = value === savedValue && !!savedValue;
      const matchesOtherVerified = otherState.isVerified && value === otherState.value && !!value;
      setter((prev) => ({
        ...prev,
        value,
        isVerified: matchesSaved,
        verificationError: null,
        verificationConfirmed: false,
      }));
      // Reusing a number already verified on the other channel skips the
      // verification round-trip, so persist it eagerly here.
      if (matchesOtherVerified) {
        void (async () => {
          const saved = await saveField(field, value.trim(), true);
          if (saved) {
            setter((prev) => (prev.value === value ? { ...prev, isVerified: true } : prev));
          }
        })();
      }
    },
    [saveField]
  );

  const handleEdit = useCallback(
    (setter: React.Dispatch<React.SetStateAction<VerificationState>>) => {
      setter((prev) => ({
        ...prev,
        isVerified: false,
        isVerifying: false,
        isSaving: false,
        codeSent: false,
        verificationConfirmed: false,
        verificationError: null,
        verificationInput: '',
      }));
    },
    []
  );

  const handleRemove = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<VerificationState>>,
      field: 'phoneNumber' | 'whatsappNumber'
    ) => {
      setter(createVerificationState(null));
      void saveField(field, '');
    },
    [saveField]
  );

  const handleDiscordBlur = useCallback(() => {
    void saveField('discordId', discordId.trim());
  }, [discordId, saveField]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SaveStatus status={status} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Label>Email</Label>
        </div>
        <Input type="email" value={user.email} disabled className="mt-2" />
      </div>

      {contactPhone && (
        <VerificationField
          label="Phone Number"
          icon={<span className="text-muted-foreground">📱</span>}
          inputId="phone-number-input"
          countryTestId="phone-country-select"
          state={phoneState}
          onValueChange={(v) => handleValueChange(setPhoneState, 'phoneNumber', whatsappState, v)}
          onVerify={(isRetry) => handleVerify(setPhoneState, 'phone', phoneState, isRetry)}
          onCancel={() => handleCancel(setPhoneState)}
          onSubmitCode={() => handleSubmitCode(setPhoneState, phoneState, 'phone')}
          onCodeChange={(v) =>
            setPhoneState((prev) => ({ ...prev, verificationInput: v, verificationError: null }))
          }
          onEdit={() => handleEdit(setPhoneState)}
          onRemove={() => handleRemove(setPhoneState, 'phoneNumber')}
        />
      )}

      {contactWhatsapp && (
        <VerificationField
          label="WhatsApp Number"
          icon={<WhatsApp sx={{ fontSize: '18px' }} className="text-muted-foreground" />}
          inputId="whatsapp-number-input"
          countryTestId="whatsapp-country-select"
          state={whatsappState}
          onValueChange={(v) =>
            handleValueChange(setWhatsappState, 'whatsappNumber', phoneState, v)
          }
          onVerify={(isRetry) => handleVerify(setWhatsappState, 'whatsapp', whatsappState, isRetry)}
          onCancel={() => handleCancel(setWhatsappState)}
          onSubmitCode={() => handleSubmitCode(setWhatsappState, whatsappState, 'whatsapp')}
          onCodeChange={(v) =>
            setWhatsappState((prev) => ({ ...prev, verificationInput: v, verificationError: null }))
          }
          onEdit={() => handleEdit(setWhatsappState)}
          onRemove={() => handleRemove(setWhatsappState, 'whatsappNumber')}
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FaDiscord className="h-4 w-4 text-muted-foreground" />
          <Label>Discord User ID</Label>
        </div>
        <Input
          type="text"
          placeholder="e.g., 123456789012345678"
          value={discordId}
          onChange={(e) => setDiscordId(e.target.value)}
          onBlur={handleDiscordBlur}
        />
        <p className="text-body-muted">
          Your Discord user ID (numeric snowflake). Enable Developer Mode in Discord settings, then
          right-click your profile to copy it.
        </p>
      </div>
    </div>
  );
};

export default ContactInfoTab;
