import * as React from 'react';
import { useFormContext, useWatch, Path, PathValue, FieldValues } from 'react-hook-form';
import { toast } from 'sonner';
import { AssistantActions } from '@/types/assistants/assistant';

type FieldNames<T extends FieldValues> = {
  identifier: Path<T>;
  isVerified: Path<T>;
  isVerifying: Path<T>;
  verificationCodeSent: Path<T>;
  verificationSentAt: Path<T>;
  verificationAttempts: Path<T>;
  verificationError: Path<T>;
};

interface UseAccountVerificationProps<T extends FieldValues> {
  platform: string;
  fieldNames: FieldNames<T>;
  assistantActions: AssistantActions;
  validationPattern?: RegExp;
  validationMessage?: string;
}

export function useAccountVerification<T extends FieldValues>({
  platform,
  fieldNames,
  assistantActions,
  validationPattern = /^\+[1-9]\d{7,14}$/,
  validationMessage = 'Enter a valid international phone number (e.g., +15551234567)',
}: UseAccountVerificationProps<T>) {
  const { control, setValue, getValues, trigger } = useFormContext<T>();

  const [verificationInput, setVerificationInput] = React.useState('');
  const [cooldown, setCooldown] = React.useState(0);

  const [isVerifying, verificationCodeSent, verificationError] = useWatch({
    control,
    name: [fieldNames.isVerifying, fieldNames.verificationCodeSent, fieldNames.verificationError],
  }) as [boolean, string | null, string | null];

  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (cooldown > 0) {
      interval = setInterval(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cooldown]);

  const resetVerificationState = React.useCallback(() => {
    setValue(fieldNames.isVerifying, false as PathValue<T, typeof fieldNames.isVerifying>, {
      shouldDirty: true,
    });
    setValue(
      fieldNames.verificationCodeSent,
      null as PathValue<T, typeof fieldNames.verificationCodeSent>,
      { shouldDirty: true }
    );
    setValue(
      fieldNames.verificationSentAt,
      null as PathValue<T, typeof fieldNames.verificationSentAt>,
      { shouldDirty: true }
    );
    setValue(
      fieldNames.verificationError,
      null as PathValue<T, typeof fieldNames.verificationError>,
      { shouldDirty: true }
    );
    setValue(
      fieldNames.verificationAttempts,
      0 as PathValue<T, typeof fieldNames.verificationAttempts>,
      { shouldDirty: true }
    );
    setVerificationInput('');
  }, [setValue, fieldNames]);

  const handleVerify = async (isRetry = false) => {
    if (isRetry && cooldown > 0) {
      toast.info(`Please wait ${cooldown}s before retrying.`);
      return;
    }

    const isValid = await trigger(fieldNames.identifier);
    if (!isValid) return;

    const identifier = getValues(fieldNames.identifier) as string;
    setValue(fieldNames.isVerifying, true as PathValue<T, typeof fieldNames.isVerifying>, {
      shouldDirty: true,
    });
    setValue(
      fieldNames.verificationError,
      null as PathValue<T, typeof fieldNames.verificationError>,
      { shouldDirty: true }
    );

    if (isRetry) {
      setValue(
        fieldNames.verificationAttempts,
        0 as PathValue<T, typeof fieldNames.verificationAttempts>,
        { shouldDirty: true }
      );
      setVerificationInput('');
    }
    setCooldown(30);

    const result = await assistantActions.contact.verifySocialAccount(platform, identifier);

    if ('detail' in result) {
      const errorMsg = 'Failed to send verification code.';
      toast.error(errorMsg);
      setValue(
        fieldNames.verificationError,
        errorMsg as PathValue<T, typeof fieldNames.verificationError>,
        { shouldDirty: true }
      );
      setValue(fieldNames.isVerifying, false as PathValue<T, typeof fieldNames.isVerifying>, {
        shouldDirty: true,
      });
    } else {
      toast.success(`Verification code sent to ${identifier}`);
      setValue(
        fieldNames.verificationCodeSent,
        result.verificationCode as PathValue<T, typeof fieldNames.verificationCodeSent>,
        { shouldDirty: true }
      );
      setValue(
        fieldNames.verificationSentAt,
        new Date(result.sentAt) as PathValue<T, typeof fieldNames.verificationSentAt>,
        { shouldDirty: true }
      );
    }
  };

  const handleCancelVerification = () => {
    resetVerificationState();
  };

  const handleSubmitCode = () => {
    const sentCode = getValues(fieldNames.verificationCodeSent) as string | null;
    const sentAt = getValues(fieldNames.verificationSentAt) as Date | null;
    if (!sentCode || !sentAt) return;

    if (Date.now() - sentAt.getTime() > 5 * 60 * 1000) {
      setValue(
        fieldNames.verificationError,
        'Code expired. Please retry.' as PathValue<T, typeof fieldNames.verificationError>,
        { shouldDirty: true }
      );
      return;
    }
    const attempts = getValues(fieldNames.verificationAttempts) as number;
    if (attempts >= 3) {
      setValue(
        fieldNames.verificationError,
        'Too many attempts. Send new code.' as PathValue<T, typeof fieldNames.verificationError>,
        { shouldDirty: true }
      );
      return;
    }

    if (verificationInput === sentCode) {
      toast.success('Account verified successfully!');
      setValue(fieldNames.isVerified, true as PathValue<T, typeof fieldNames.isVerified>, {
        shouldDirty: true,
      });
      resetVerificationState();
    } else {
      setValue(
        fieldNames.verificationAttempts,
        (attempts + 1) as PathValue<T, typeof fieldNames.verificationAttempts>,
        { shouldDirty: true }
      );
      setValue(
        fieldNames.verificationError,
        'Incorrect code.' as PathValue<T, typeof fieldNames.verificationError>,
        { shouldDirty: true }
      );
    }
  };

  const isVerificationFlowActive = !!(isVerifying && verificationCodeSent);

  return {
    isVerifying,
    isVerificationFlowActive,
    verificationError,
    cooldown,
    verificationInput,
    setVerificationInput,
    handleVerify,
    handleCancelVerification,
    handleSubmitCode,
  };
}
