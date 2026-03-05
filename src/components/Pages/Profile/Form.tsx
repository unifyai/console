'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types/user';
import UserInfo from '@/components/Pages/Profile/Info';
import SecondaryButton from '../../Common/Buttons/Secondary';
import PrimaryButton from '../../Common/Buttons/Primary';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { verifyUserPhone } from '@/lib/user/user';
import { toast } from 'sonner';
import ProfilePhoto from './ProfilePhoto';

export interface PhoneVerificationState {
  phoneNumber: string;
  isPhoneVerified: boolean;
  isVerifying: boolean;
  verificationCodeSent: string | null;
  verificationSentAt: Date | null;
  verificationAttempts: number;
  verificationError: string | null;
  verificationInput: string;
  cooldown: number;
}

const ProfileForm = ({ user, onPrem }: { user: User; onPrem: string | undefined }) => {
  // Form state
  const [formState, setFormState] = useState({
    name: user.name || '',
    lastName: user.lastName || '',
    jobTitle: user.jobTitle || '',
    bio: user.bio || '',
    timezone: user.timezone || '',
  });
  const [initialFormState, setInitialFormState] = useState({ ...formState });
  const [changeMade, setChangeMade] = useState(false);

  // Phone verification state
  const [phoneState, setPhoneState] = useState<PhoneVerificationState>({
    phoneNumber: user.phoneNumber || '',
    isPhoneVerified: !!user.phoneNumber, // Already verified if user has a phone number
    isVerifying: false,
    verificationCodeSent: null,
    verificationSentAt: null,
    verificationAttempts: 0,
    verificationError: null,
    verificationInput: '',
    cooldown: 0,
  });
  const [initialPhoneNumber] = useState(user.phoneNumber || '');

  // Alert state
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  // Cooldown timer for phone verification
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (phoneState.cooldown > 0) {
      interval = setInterval(() => {
        setPhoneState((prev) => ({ ...prev, cooldown: Math.max(0, prev.cooldown - 1) }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phoneState.cooldown]);

  // Automatically set timezone for new users
  useEffect(() => {
    const autoUpdateTimezone = async (tz: string) => {
      const formData = new FormData();
      // Append all current user data to avoid blanking it out on update
      formData.append('name', user.name || '');
      formData.append('lastName', user.lastName || '');
      formData.append('jobTitle', user.jobTitle || '');
      formData.append('bio', user.bio || '');
      formData.append('email', user.email || '');
      formData.append('timezone', tz);

      try {
        const response = await fetch(`/api/profile/updateUser?userID=${user.id}`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          setFormState((prev) => ({ ...prev, timezone: tz }));
          setInitialFormState((prev) => ({ ...prev, timezone: tz }));
        }
      } catch (error) {
        console.error('Failed to auto-update timezone:', error);
      }
    };

    if (!user.timezone) {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTimezone) {
        autoUpdateTimezone(browserTimezone);
      }
    }
  }, [user.id, user.timezone, user.name, user.lastName, user.jobTitle, user.bio, user.email]);

  useEffect(() => {
    if (alert.type) {
      const timer = setTimeout(() => {
        setAlert({ type: null, message: '' });
      }, 5000); // Alert will disappear after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [alert]);

  useEffect(() => {
    setInitialFormState({ ...formState });
  }, [user, formState]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
    setChangeMade(true);
  };

  const handleTimezoneChange = (value: string) => {
    setFormState((prev) => ({ ...prev, timezone: value }));
    setChangeMade(true);
  };

  // Phone number handlers
  const handlePhoneChange = (value: string) => {
    setPhoneState((prev) => ({
      ...prev,
      phoneNumber: value,
      // Reset verification if phone number changes
      isPhoneVerified: value === initialPhoneNumber && !!initialPhoneNumber,
      verificationError: null,
    }));
    setChangeMade(true);
  };

  const handleVerifyPhone = useCallback(
    async (isRetry = false) => {
      if (isRetry && phoneState.cooldown > 0) {
        toast.info(`Please wait ${phoneState.cooldown}s before retrying.`);
        return;
      }

      // Validate phone number format
      const phonePattern = /^\+[1-9]\d{7,14}$/;
      if (!phonePattern.test(phoneState.phoneNumber)) {
        setPhoneState((prev) => ({
          ...prev,
          verificationError: 'Please enter a valid international phone number (e.g., +15551234567)',
        }));
        return;
      }

      setPhoneState((prev) => ({
        ...prev,
        isVerifying: true,
        verificationError: null,
        ...(isRetry ? { verificationAttempts: 0, verificationInput: '' } : {}),
        cooldown: 30,
      }));

      const result = await verifyUserPhone(phoneState.phoneNumber);

      if ('detail' in result) {
        toast.error('Failed to send verification code.');
        setPhoneState((prev) => ({
          ...prev,
          verificationError: result.detail,
          isVerifying: false,
        }));
      } else {
        toast.success(`Verification code sent to ${phoneState.phoneNumber}`);
        setPhoneState((prev) => ({
          ...prev,
          verificationCodeSent: result.verificationCode,
          verificationSentAt: new Date(result.sentAt),
        }));
      }
    },
    [phoneState.phoneNumber, phoneState.cooldown]
  );

  const handleCancelVerification = useCallback(() => {
    setPhoneState((prev) => ({
      ...prev,
      isVerifying: false,
      verificationCodeSent: null,
      verificationSentAt: null,
      verificationError: null,
      verificationAttempts: 0,
      verificationInput: '',
    }));
  }, []);

  const handleSubmitVerificationCode = useCallback(() => {
    if (!phoneState.verificationCodeSent || !phoneState.verificationSentAt) return;

    // Check if code has expired (5 minutes)
    if (Date.now() - phoneState.verificationSentAt.getTime() > 5 * 60 * 1000) {
      setPhoneState((prev) => ({
        ...prev,
        verificationError: 'Code expired. Please request a new code.',
      }));
      return;
    }

    // Check attempt limit
    if (phoneState.verificationAttempts >= 3) {
      setPhoneState((prev) => ({
        ...prev,
        verificationError: 'Too many attempts. Please request a new code.',
      }));
      return;
    }

    if (phoneState.verificationInput === phoneState.verificationCodeSent) {
      toast.success('Phone number verified successfully!');
      setPhoneState((prev) => ({
        ...prev,
        isPhoneVerified: true,
        isVerifying: false,
        verificationCodeSent: null,
        verificationSentAt: null,
        verificationError: null,
        verificationAttempts: 0,
        verificationInput: '',
      }));
    } else {
      setPhoneState((prev) => ({
        ...prev,
        verificationAttempts: prev.verificationAttempts + 1,
        verificationError: 'Incorrect code. Please try again.',
      }));
    }
  }, [
    phoneState.verificationCodeSent,
    phoneState.verificationSentAt,
    phoneState.verificationInput,
    phoneState.verificationAttempts,
  ]);

  const setVerificationInput = useCallback((value: string) => {
    setPhoneState((prev) => ({ ...prev, verificationInput: value, verificationError: null }));
  }, []);

  // Check if phone needs verification before save
  const phoneNeedsVerification =
    phoneState.phoneNumber.trim() !== '' && !phoneState.isPhoneVerified;
  const isVerificationFlowActive = phoneState.isVerifying && phoneState.verificationCodeSent;

  // Handle cancel
  const handleCancel = () => {
    // Reset form state to initial values
    setFormState(initialFormState);
    setChangeMade(false);
    // Reset phone state
    setPhoneState({
      phoneNumber: initialPhoneNumber,
      isPhoneVerified: !!initialPhoneNumber,
      isVerifying: false,
      verificationCodeSent: null,
      verificationSentAt: null,
      verificationAttempts: 0,
      verificationError: null,
      verificationInput: '',
      cooldown: 0,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent save if phone needs verification
    if (phoneNeedsVerification) {
      toast.error('Please verify your phone number before saving.');
      return;
    }

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    formData.append('timezone', formState.timezone);

    // Include phone number (empty string if cleared, or verified phone number)
    const phoneToSave = phoneState.phoneNumber.trim() === '' ? '' : phoneState.phoneNumber;
    formData.append('phoneNumber', phoneToSave);

    // Update profile info
    const profileResponse = await fetch(`/api/profile/updateUser?userID=${user.id}`, {
      method: 'POST',
      body: formData,
    });

    if (profileResponse.ok) {
      setAlert({ type: 'success', message: 'Profile updated successfully!' });
      setInitialFormState({ ...formState });
      setChangeMade(false);
    } else {
      setAlert({ type: 'error', message: 'Error updating profile.' });
    }
  };

  return (
    <div className="mt-10 w-full sm:mt-0">
      <form onSubmit={handleSave}>
        <div className="mb-6 flex items-center gap-5">
          <ProfilePhoto user={user} />
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <Label>First Name</Label>
              <Input
                type="text"
                name="name"
                value={formState.name}
                className="w-full"
                onChange={handleInputChange}
                readOnly={Boolean(onPrem)}
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input
                type="text"
                name="lastName"
                value={formState.lastName}
                className="w-full"
                onChange={handleInputChange}
                readOnly={Boolean(onPrem)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="text"
                name="email"
                value={user?.email || ''}
                className="w-full"
                readOnly={true}
              />
            </div>
            <div>
              <Label>Job Title</Label>
              <Input
                type="text"
                name="jobTitle"
                value={formState.jobTitle}
                className="w-full"
                onChange={handleInputChange}
                readOnly={Boolean(onPrem)}
              />
            </div>
          </div>
        </div>
        <UserInfo
          formState={formState}
          handleInputChange={handleInputChange}
          handleTimezoneChange={handleTimezoneChange}
          user={user}
          onPrem={onPrem}
          phoneState={phoneState}
          handlePhoneChange={handlePhoneChange}
          handleVerifyPhone={handleVerifyPhone}
          handleCancelVerification={handleCancelVerification}
          handleSubmitVerificationCode={handleSubmitVerificationCode}
          setVerificationInput={setVerificationInput}
          isVerificationFlowActive={!!isVerificationFlowActive}
        />
        {changeMade && (
          <div className="mt-5 flex w-fit gap-2">
            <SecondaryButton onClick={handleCancel} disabled={!changeMade} label="Cancel" />
            <PrimaryButton
              type="submit"
              disabled={!changeMade || phoneNeedsVerification}
              label={phoneNeedsVerification ? 'Verify Phone First' : 'Save'}
            />
          </div>
        )}
      </form>
      {alert.type && (
        <Alert variant={alert.type === 'error' ? 'destructive' : 'default'} className="mt-5">
          {alert.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <AlertTitle className="text-title">
            {alert.type === 'error' ? 'Error' : 'Success'}
          </AlertTitle>
          <AlertDescription className="text-body">{alert.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ProfileForm;
