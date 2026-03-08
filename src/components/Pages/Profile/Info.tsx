import { Input } from '../../UI/input';
import { Label } from '../../UI/label';
import { Button } from '../../UI/button';
import { User } from '@/types/user';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';
import { Info, Eye, EyeOff, Check } from 'lucide-react';
import * as React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhoneVerificationState } from './Form';

const ApiKeyField: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div>
      <div className="flex flex-row items-center gap-2 pb-1">
        <Label>API Key</Label>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-caption max-w-xs">
              <p>
                Used for programmatic integration, see{' '}
                <a
                  href="https://docs.unify.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  docs
                </a>
                .
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            value={isVisible ? apiKey : '••••••••••••••••••••••••••••••••'}
            className="text-code cursor-pointer"
            readOnly
            onClick={handleCopy}
          />
          {isCopied && (
            <span className="text-caption absolute right-3 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 duration-150 animate-in fade-in">
              Copied!
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={() => setIsVisible(!isVisible)}
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : isVisible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

interface UserInfoProps {
  formState: { name: any; lastName: any; jobTitle: any; bio: any; timezone: any };
  user: User;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTimezoneChange: (value: string) => void;
  onPrem: string | undefined;
  phoneState: PhoneVerificationState;
  handlePhoneChange: (value: string) => void;
  handleVerifyPhone: (isRetry?: boolean) => Promise<void>;
  handleCancelVerification: () => void;
  handleSubmitVerificationCode: () => void;
  setVerificationInput: (value: string) => void;
  isVerificationFlowActive: boolean;
}

const UserInfo = ({
  formState,
  user,
  handleInputChange,
  handleTimezoneChange,
  onPrem,
  phoneState,
  handlePhoneChange,
  handleVerifyPhone,
  handleCancelVerification,
  handleSubmitVerificationCode,
  setVerificationInput,
  isVerificationFlowActive,
}: UserInfoProps) => {
  const timezoneOptions = React.useMemo(() => generateTimezoneOptions(), []);

  return (
    <div className="profile-form tutorial-user-information">
      <div className="text-body flex flex-col gap-4">
        <div>
          <div className="flex flex-row items-center gap-2 pb-1">
            <Label>About</Label>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right" className="text-caption max-w-xs">
                  <p>
                    You can edit this field anytime. Your assistant(s) will also update it as they
                    learn more about you.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            type="text"
            name="bio"
            value={formState.bio}
            className="w-full"
            onChange={handleInputChange}
            readOnly={Boolean(onPrem)}
          />
        </div>
        <div>
          <Label>Timezone</Label>
          <Select
            value={formState.timezone}
            onValueChange={handleTimezoneChange}
            disabled={Boolean(onPrem)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a timezone..." />
            </SelectTrigger>
            <SelectContent>
              {timezoneOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Phone Number</Label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="tel"
                placeholder="e.g., +15551234567"
                value={phoneState.phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                disabled={phoneState.isVerifying || phoneState.isPhoneVerified || Boolean(onPrem)}
                className="flex-1"
              />
              {phoneState.isPhoneVerified ? (
                <Button type="button" variant="default" className="h-9" disabled>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Verified
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => handleVerifyPhone(false)}
                  disabled={
                    phoneState.isVerifying || !phoneState.phoneNumber.trim() || Boolean(onPrem)
                  }
                >
                  {phoneState.isVerifying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {phoneState.isVerifying ? 'Verifying...' : 'Verify'}
                </Button>
              )}
            </div>
            {isVerificationFlowActive && (
              <div className="flex items-start gap-3 border-l-2 border-muted pl-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter verification code..."
                      value={phoneState.verificationInput}
                      onChange={(e) => setVerificationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSubmitVerificationCode();
                        }
                      }}
                      className={cn('h-9', phoneState.verificationError && 'border-destructive')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={handleSubmitVerificationCode}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {phoneState.verificationError && (
                    <p className="text-body text-error mt-1 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {phoneState.verificationError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => handleVerifyPhone(true)}
                    disabled={phoneState.cooldown > 0}
                  >
                    {phoneState.cooldown > 0 ? `Resend (${phoneState.cooldown}s)` : 'Resend'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-9"
                    onClick={handleCancelVerification}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {phoneState.verificationError && !isVerificationFlowActive && (
              <p className="text-body text-error mt-1 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {phoneState.verificationError}
              </p>
            )}
            {phoneState.phoneNumber.trim() &&
              !phoneState.isPhoneVerified &&
              !phoneState.isVerifying && (
                <p className="text-body-muted">Phone number must be verified before saving.</p>
              )}
          </div>
        </div>
        <ApiKeyField apiKey={user.apiKey} />
      </div>
    </div>
  );
};

export default UserInfo;
