import { Input } from "../../UI/input";
import { Label } from "../../UI/label";
import { Button } from "../../UI/button";
import { User } from "@/types/user";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { generateTimezoneOptions } from "@/utils/assistants/timezone-utils";
import { Info } from "lucide-react";
import * as React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { cn } from "@/lib/utils";
import { PhoneVerificationState } from "./Form";

interface UserInfoProps {
  formState: { name: any; last_name: any; job_title: any; bio: any; timezone: any; };
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
    <div className="mt-4 profile-form tutorial-user-information">
      <p className="text-title">Change your personal information</p>
      <div className="grid grid-cols-2 gap-4 text-body">
        <div className="mt-2">
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
        <div className="mt-2">
          <Label>Last Name</Label>
          <Input 
            type="text" 
            name="last_name" 
            value={formState.last_name} 
            className="w-full" 
            onChange={handleInputChange} 
            readOnly={Boolean(onPrem)}
          />
        </div>
        <div className="mt-2">
          <Label>Email</Label>
          <Input 
            type="text" 
            name="email" 
            value={user?.email || ""} 
            className="w-full" 
            readOnly={true}
          />
        </div>
        <div className="mt-2">
          <Label>Job Title</Label>
          <Input 
            type="text" 
            name="job_title" 
            value={formState.job_title} 
            className="w-full" 
            onChange={handleInputChange} 
            readOnly={Boolean(onPrem)}
          />
        </div>
        <div className="mt-2 col-span-2">
          <div className="flex flex-row gap-2 items-center pb-1">
            <Label>About</Label>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-caption">
                  <p>You can edit this field anytime. Your assistant(s) will also update it as they learn more about you.</p>
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
        <div className="mt-2 col-span-2">
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
              {timezoneOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 col-span-2">
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
                  disabled={phoneState.isVerifying || !phoneState.phoneNumber.trim() || Boolean(onPrem)}
                >
                  {phoneState.isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {phoneState.isVerifying ? 'Verifying...' : 'Verify'}
                </Button>
              )}
            </div>
            {isVerificationFlowActive && (
              <div className="pl-4 flex items-start gap-3 border-l-2 border-muted">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter verification code..."
                      value={phoneState.verificationInput}
                      onChange={(e) => setVerificationInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmitVerificationCode(); } }}
                      className={cn("h-9", phoneState.verificationError && "border-destructive")}
                    />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleSubmitVerificationCode}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {phoneState.verificationError && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />{phoneState.verificationError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-0">
                  <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => handleVerifyPhone(true)} disabled={phoneState.cooldown > 0}>
                    {phoneState.cooldown > 0 ? `Resend (${phoneState.cooldown}s)` : 'Resend'}
                  </Button>
                  <Button type="button" variant="secondary" size="sm" className="h-9" onClick={handleCancelVerification}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {phoneState.verificationError && !isVerificationFlowActive && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />{phoneState.verificationError}
              </p>
            )}
            {phoneState.phoneNumber.trim() && !phoneState.isPhoneVerified && !phoneState.isVerifying && (
              <p className="text-sm text-muted-foreground">Phone number must be verified before saving.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInfo;
