'use client';

import * as React from 'react';
import { useFormContext, Controller, useWatch } from 'react-hook-form';
import { Input } from "@/components/UI/input";
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { Check, Trash2, Loader2, RefreshCw, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssistantFormData, AssistantActions } from '@/types/team/assistant';
import { getPlatformIcon } from '@/utils/team/platform-utils';
import { toast } from 'sonner';

interface SocialAccountInputProps {
    index: number;
    platform: string;
    justAddedPlatform: string | null;
    assistantActions: AssistantActions;
    onRemove: (index: number) => void;
    clearJustAdded: () => void;
    cost: number;
}

export const SocialAccountInput: React.FC<SocialAccountInputProps> = ({ 
    index, 
    platform, 
    justAddedPlatform, 
    assistantActions,
    onRemove, 
    clearJustAdded,
    cost
}) => {
    const { control, formState: { errors }, getValues, setValue, trigger } = useFormContext<AssistantFormData>();
    const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);
    const [verificationInput, setVerificationInput] = React.useState('');
    const [lastRetryTime, setLastRetryTime] = React.useState<number>(0);
    const [cooldown, setCooldown] = React.useState(0);
    const [isCancelHovered, setIsCancelHovered] = React.useState(false);

    const account = useWatch({
        control,
        name: `social_accounts.${index}`,
    });

    React.useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (cooldown > 0) {
            interval = setInterval(() => {
                setCooldown(prev => Math.max(0, prev - 1));
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [cooldown]);

    const startCooldown = () => {
        setCooldown(30);
        setLastRetryTime(Date.now());
    };

    React.useEffect(() => {
        if (platform === justAddedPlatform) {
            setIsTooltipOpen(true);
            const timer = setTimeout(() => {
                setIsTooltipOpen(false);
                clearJustAdded();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [platform, justAddedPlatform, clearJustAdded]);

    const handleVerify = async (isRetry = false) => {
        if (isRetry && cooldown > 0) {
            toast.info(`Please wait ${cooldown}s before retrying.`);
            return;
        }

        const isValid = await trigger(`social_accounts.${index}.identifier`);
        if (!isValid) {
            toast.error("Please enter a valid international phone number for verification.");
            return;
        }
        
        const identifier = getValues(`social_accounts.${index}.identifier`);
        setValue(`social_accounts.${index}.isVerifying`, true);
        setValue(`social_accounts.${index}.verificationError`, null);
        if (isRetry) {
             setValue(`social_accounts.${index}.verificationAttempts`, 0);
             setVerificationInput('');
        }
        startCooldown();

        const result = await assistantActions.contact.verifySocialAccount(platform, identifier);
        
        if ('detail' in result) {
            const errorMsg = result.detail || "Failed to send verification code.";
            toast.error(errorMsg);
            setValue(`social_accounts.${index}.verificationError`, errorMsg);
            setValue(`social_accounts.${index}.isVerifying`, false);
        } else {
            toast.success(`Verification code sent to ${identifier}`);
            setValue(`social_accounts.${index}.verificationCodeSent`, result.verification_code);
            setValue(`social_accounts.${index}.verificationSentAt`, new Date(result.sent_at));
        }
    };

    const handleCancelVerification = () => {
        setValue(`social_accounts.${index}.isVerifying`, false);
        setValue(`social_accounts.${index}.verificationCodeSent`, null);
        setValue(`social_accounts.${index}.verificationSentAt`, null);
        setValue(`social_accounts.${index}.verificationError`, null);
        setValue(`social_accounts.${index}.verificationAttempts`, 0);
        setVerificationInput('');
    };

    const handleSubmitCode = () => {
        const sentCode = getValues(`social_accounts.${index}.verificationCodeSent`);
        const sentAt = getValues(`social_accounts.${index}.verificationSentAt`);
        
        if (!sentCode || !sentAt) return;

        // Check for timeout (5 minutes)
        if (Date.now() - sentAt.getTime() > 5 * 60 * 1000) {
            setValue(`social_accounts.${index}.verificationError`, "Verification code expired. Please retry.");
            toast.error("Verification code expired. Please retry.");
            return;
        }

        // Check attempts
        const attempts = getValues(`social_accounts.${index}.verificationAttempts`);
        if (attempts >= 3) {
            setValue(`social_accounts.${index}.verificationError`, "Too many attempts. Please send a new code.");
            toast.error("Too many attempts. Please send a new code.");
            return;
        }

        if (verificationInput === sentCode) {
            toast.success("Account verified successfully!");
            setValue(`social_accounts.${index}.isVerified`, true);
            handleCancelVerification(); 
        } else {
            setValue(`social_accounts.${index}.verificationAttempts`, attempts + 1);
            const newError = "Incorrect code. Please try again.";
            setValue(`social_accounts.${index}.verificationError`, newError);
            toast.error(newError);
        }
    };

    const socialAccountErrors = errors.social_accounts?.[index]?.identifier;

    if (account?.isVerified) {
        return (
             <div className="flex items-center gap-2 p-2 pl-3 rounded-md bg-green-50 border border-green-200">
                {getPlatformIcon(platform)}
                <span className="text-sm font-medium text-green-800 flex-1">{account.identifier}</span>
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:bg-transparent hover:text-destructive"
                    onClick={() => onRemove(index)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        );
    }
    
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                {getPlatformIcon(platform)}

                <div className="relative flex-1">
                    {account.isVerifying && account.verificationCodeSent ? (
                        <Input
                            id={`social_accounts_${index}_verification_code`}
                            placeholder="Enter verification code..."
                            value={verificationInput}
                            onChange={(e) => setVerificationInput(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleSubmitCode(); }}}
                            className={cn("h-9 pr-[5.5rem]", account.verificationError && "border-destructive")}
                        />
                    ) : (
                        <Controller
                            name={`social_accounts.${index}.identifier`}
                            control={control}
                            rules={{ 
                                required: `${platform} identifier is required.`,
                                pattern: {
                                    value: /^\+[1-9]\d{7,14}$/,
                                    message: "Enter a valid international phone number (e.g., +15551234567)"
                                }
                            }}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    id={`social_accounts_${index}_identifier`}
                                    placeholder={`Your ${platform} phone number...`}
                                    className="h-9"
                                    disabled={account.isVerifying || account.isVerified}
                                />
                            )}
                        />
                    )}
                    
                    {account.isVerifying && account.verificationCodeSent && (
                         <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                             <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild>
                                 <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-primary" onClick={handleSubmitCode}>
                                     <span className="text-xl -mt-1">↳</span>
                                 </Button>
                             </TooltipTrigger><TooltipContent><p>Submit Code</p></TooltipContent></Tooltip></TooltipProvider>
                             <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild>
                                 <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-primary" onClick={() => handleVerify(true)} disabled={cooldown > 0}>
                                     <RefreshCw className={cn("h-4 w-4", cooldown > 0 && "opacity-50")} />
                                 </Button>
                             </TooltipTrigger><TooltipContent><p>{cooldown > 0 ? `Retry in ${cooldown}s` : "Resend Code"}</p></TooltipContent></Tooltip></TooltipProvider>
                         </div>
                    )}
                </div>

                {/* Primary Action Button (Verify -> Loader/Cancel) */}
                <TooltipProvider delayDuration={100}>
                    <Tooltip open={account.isVerifying ? false : isTooltipOpen} onOpenChange={setIsTooltipOpen}>
                        <TooltipTrigger asChild>
                            <Button
                                type="button" variant="ghost" size="icon"
                                className="h-8 w-8 text-muted-foreground hover:bg-transparent"
                                onMouseEnter={() => { if(account.isVerifying) setIsCancelHovered(true) }}
                                onMouseLeave={() => { if(account.isVerifying) setIsCancelHovered(false) }}
                                onClick={account.isVerifying ? handleCancelVerification : () => handleVerify(false)}
                                disabled={account.isVerified}
                            >
                                {account.isVerifying ? (
                                    isCancelHovered ? <X className="h-4 w-4 text-destructive" /> : <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4 hover:text-primary" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>{account.isVerifying ? "Cancel Verification" : `Costs ${cost.toFixed(2)} credits to pair with your assistant. Verify first to link.`}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {/* Trash Button */}
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-destructive" onClick={() => onRemove(index)}>
                    <Trash2 className="h-4 w-4" />
                </Button>

            </div>
            {socialAccountErrors ? (
                <p className="text-sm font-medium text-destructive mt-1 pl-7">{socialAccountErrors.message}</p>
            ) : account.verificationError ? (
                <p className="text-sm font-medium text-destructive mt-1 pl-7 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{account.verificationError}</p>
            ) : null }
        </div>
    );
};