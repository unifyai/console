'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types/user';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Button } from '@/components/UI/button';
import { Loader2, CheckCircle2, AlertCircle, Send, Mail } from 'lucide-react';
import { WhatsApp } from '@mui/icons-material';
import { cn } from '@/lib/utils';
// Verification is handled server-side via orchestra endpoints
import { toast } from 'sonner';
import SecondaryButton from '@/components/Common/Buttons/Secondary';
import PrimaryButton from '@/components/Common/Buttons/Primary';

interface VerificationState {
  value: string;
  isVerified: boolean;
  isVerifying: boolean;
  codeSent: boolean;
  verificationError: string | null;
  verificationInput: string;
  cooldown: number;
}

function createVerificationState(initialValue: string | null): VerificationState {
  return {
    value: initialValue || '',
    isVerified: !!initialValue,
    isVerifying: false,
    codeSent: false,
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
  placeholder?: string;
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
  placeholder = 'e.g., +15551234567',
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
        <Input
          type="tel"
          placeholder={placeholder}
          value={state.value}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={state.isVerifying || state.isVerified}
          className={cn('flex-1', showFormatError && 'border-destructive')}
        />
        {state.isVerified ? (
          <>
            <Button type="button" variant="default" className="h-9" disabled>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Verified
            </Button>
            <Button type="button" variant="outline" className="h-9" onClick={onEdit}>
              Change
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => onVerify(false)}
            disabled={state.isVerifying || !isValidFormat}
          >
            {state.isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {state.isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        )}
      </div>
      {showFormatError && (
        <p className="text-body text-strong flex items-center gap-1.5 text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          Enter a valid international number starting with + (e.g., +15551234567)
        </p>
      )}
      {isFlowActive && (
        <div className="flex items-start gap-3 border-l-2 border-muted pl-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter verification code..."
                value={state.verificationInput}
                onChange={(e) => onCodeChange(e.target.value)}
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
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
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
              disabled={state.cooldown > 0}
            >
              {state.cooldown > 0 ? `Resend (${state.cooldown}s)` : 'Resend'}
            </Button>
            <Button type="button" variant="secondary" size="sm" className="h-9" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {hasValue && isValidFormat && !state.isVerified && !state.isVerifying && (
        <p className="text-body-muted">Number must be verified before saving.</p>
      )}
    </div>
  );
};

const ContactInfoTab = ({ user }: { user: User }) => {
  const router = useRouter();
  const [phoneState, setPhoneState] = useState<VerificationState>(
    createVerificationState(user.phoneNumber)
  );
  const [whatsappState, setWhatsappState] = useState<VerificationState>(
    createVerificationState(user.whatsappNumber)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [changeMade, setChangeMade] = useState(false);

  const [initialPhone] = useState(user.phoneNumber || '');
  const [initialWhatsapp] = useState(user.whatsappNumber || '');

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
        verificationError: null,
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
          }));
        } else {
          toast.success(`Verification code sent to ${state.value}`);
          setter((prev) => ({
            ...prev,
            codeSent: true,
          }));
        }
      } catch {
        toast.error('Failed to send verification code.');
        setter((prev) => ({
          ...prev,
          verificationError: 'Network error. Please try again.',
          isVerifying: false,
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
      if (!state.codeSent || !state.verificationInput.trim()) return;

      try {
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

        if (data.success) {
          toast.success('Number verified successfully!');
          setter((prev) => ({
            ...prev,
            isVerified: true,
            isVerifying: false,
            codeSent: false,
            verificationError: null,
            verificationInput: '',
          }));
          setChangeMade(true);
        } else {
          setter((prev) => ({
            ...prev,
            verificationError: data.detail || 'Incorrect code. Please try again.',
          }));
        }
      } catch {
        setter((prev) => ({
          ...prev,
          verificationError: 'Network error. Please try again.',
        }));
      }
    },
    []
  );

  const handleCancel = useCallback(
    (setter: React.Dispatch<React.SetStateAction<VerificationState>>) => {
      setter((prev) => ({
        ...prev,
        isVerifying: false,
        codeSent: false,
        verificationError: null,
        verificationInput: '',
      }));
    },
    []
  );

  const handleValueChange = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<VerificationState>>,
      initialValue: string,
      otherState: VerificationState,
      value: string
    ) => {
      const matchesInitial = value === initialValue && !!initialValue;
      const matchesOtherVerified = otherState.isVerified && value === otherState.value && !!value;
      setter((prev) => ({
        ...prev,
        value,
        isVerified: matchesInitial || matchesOtherVerified,
        verificationError: null,
      }));
      setChangeMade(true);
    },
    []
  );

  const handleEdit = useCallback(
    (setter: React.Dispatch<React.SetStateAction<VerificationState>>) => {
      setter((prev) => ({
        ...prev,
        isVerified: false,
        isVerifying: false,
        codeSent: false,
        verificationError: null,
        verificationInput: '',
      }));
    },
    []
  );

  const phoneNeedsVerification = phoneState.value.trim() !== '' && !phoneState.isVerified;
  const whatsappNeedsVerification = whatsappState.value.trim() !== '' && !whatsappState.isVerified;
  const canSave = changeMade && !phoneNeedsVerification && !whatsappNeedsVerification;

  const handleReset = () => {
    setPhoneState(createVerificationState(initialPhone || null));
    setWhatsappState(createVerificationState(initialWhatsapp || null));
    setChangeMade(false);
  };

  const handleSave = async () => {
    if (!canSave) {
      if (phoneNeedsVerification || whatsappNeedsVerification) {
        toast.error('Please verify all numbers before saving.');
      }
      return;
    }

    setIsSaving(true);
    const minDelay = new Promise((r) => setTimeout(r, 800));

    try {
      const formData = new FormData();
      formData.append('name', user.name || '');
      formData.append('lastName', user.lastName || '');
      formData.append('jobTitle', user.jobTitle || '');
      formData.append('bio', user.bio || '');
      formData.append('email', user.email || '');
      formData.append('timezone', user.timezone || '');
      formData.append('phoneNumber', phoneState.value.trim() || '');
      formData.append('whatsappNumber', whatsappState.value.trim() || '');

      const response = await fetch('/api/profile/updateUser', {
        method: 'POST',
        body: formData,
      });

      await minDelay;

      if (response.ok) {
        toast.success('Contact info updated successfully!');
        setChangeMade(false);
        router.refresh();
      } else {
        const data = await response.json().catch(() => null);
        const errMsg =
          typeof data?.error === 'string' ? data.error : 'Error updating contact info.';
        toast.error(errMsg);
      }
    } catch {
      toast.error('Error updating contact info.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Label>Email</Label>
        </div>
        <Input type="email" value={user.email} disabled className="mt-2" />
      </div>

      <VerificationField
        label="Phone Number"
        icon={<span className="text-muted-foreground">📱</span>}
        state={phoneState}
        onValueChange={(v) => handleValueChange(setPhoneState, initialPhone, whatsappState, v)}
        onVerify={(isRetry) => handleVerify(setPhoneState, 'phone', phoneState, isRetry)}
        onCancel={() => handleCancel(setPhoneState)}
        onSubmitCode={() => handleSubmitCode(setPhoneState, phoneState, 'phone')}
        onCodeChange={(v) =>
          setPhoneState((prev) => ({ ...prev, verificationInput: v, verificationError: null }))
        }
        onEdit={() => handleEdit(setPhoneState)}
      />

      <VerificationField
        label="WhatsApp Number"
        icon={<WhatsApp sx={{ fontSize: '18px' }} className="text-muted-foreground" />}
        state={whatsappState}
        onValueChange={(v) => handleValueChange(setWhatsappState, initialWhatsapp, phoneState, v)}
        onVerify={(isRetry) => handleVerify(setWhatsappState, 'whatsapp', whatsappState, isRetry)}
        onCancel={() => handleCancel(setWhatsappState)}
        onSubmitCode={() => handleSubmitCode(setWhatsappState, whatsappState, 'whatsapp')}
        onCodeChange={(v) =>
          setWhatsappState((prev) => ({ ...prev, verificationInput: v, verificationError: null }))
        }
        onEdit={() => handleEdit(setWhatsappState)}
      />

      {changeMade && (
        <div className="flex w-fit gap-2">
          <SecondaryButton onClick={handleReset} label="Cancel" />
          <PrimaryButton
            onClick={handleSave}
            disabled={!canSave || isSaving}
            isLoading={isSaving}
            label={
              phoneNeedsVerification || whatsappNeedsVerification ? 'Verify Numbers First' : 'Save'
            }
          />
        </div>
      )}
    </div>
  );
};

export default ContactInfoTab;
