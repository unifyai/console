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
import { useAccountVerification } from '@/hooks/Team/useAccountVerification';
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
    const { control, formState: { errors }, setValue, getValues } = useFormContext<AssistantFormData>();
    const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);
    const [isCancelHovered, setIsCancelHovered] = React.useState(false);

    const account = useWatch({
        control,
        name: `social_accounts.${index}`,
    });

    const fieldNames = React.useMemo(() => ({
        identifier: `social_accounts.${index}.identifier` as const,
        isVerified: `social_accounts.${index}.isVerified` as const,
        isVerifying: `social_accounts.${index}.isVerifying` as const,
        verificationCodeSent: `social_accounts.${index}.verificationCodeSent` as const,
        verificationSentAt: `social_accounts.${index}.verificationSentAt` as const,
        verificationAttempts: `social_accounts.${index}.verificationAttempts` as const,
        verificationError: `social_accounts.${index}.verificationError` as const,
    }), [index]);

    const {
        isVerifying,
        isVerificationFlowActive,
        verificationError,
        cooldown,
        verificationInput,
        setVerificationInput,
        handleVerify,
        handleCancelVerification,
        handleSubmitCode,
    } = useAccountVerification({
        platform,
        fieldNames,
        assistantActions
    });
    
    const handleVerifyClick = (isRetry: boolean) => {
        const identifier = getValues(fieldNames.identifier);
        if (!identifier || identifier.trim() === '') {
            toast.error(`Please enter a ${platform} phone number to verify.`);
            return;
        }
        handleVerify(isRetry);
    };

    const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(fieldNames.identifier, newValue, { shouldDirty: true });
        if (getValues(fieldNames.isVerified)) {
            setValue(fieldNames.isVerified, false, { shouldDirty: true });
        }
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

    const socialAccountErrors = errors.social_accounts?.[index]?.identifier;
    
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                {getPlatformIcon(platform)}

                <div className="relative flex-1">
                    {isVerificationFlowActive ? (
                        <Input
                            id={`social_accounts_${index}_verification_code`}
                            placeholder="Enter verification code..."
                            value={verificationInput}
                            onChange={(e) => setVerificationInput(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleSubmitCode(); }}}
                            className={cn("h-9 pr-[5.5rem]", verificationError && "border-destructive")}
                        />
                    ) : (
                        <Input
                            id={`social_accounts_${index}_identifier`}
                            placeholder={`Your ${platform} phone number...`}
                            className="h-9"
                            value={account.identifier || ''}
                            disabled={isVerifying}
                            onChange={handleIdentifierChange}
                        />
                    )}
                    
                    {isVerificationFlowActive && (
                         <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                             <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild>
                                 <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-primary" onClick={handleSubmitCode}>
                                     <span className="text-xl mt-1">↳</span>
                                 </Button>
                             </TooltipTrigger><TooltipContent><p>Submit Code</p></TooltipContent></Tooltip></TooltipProvider>
                             <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild>
                                 <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-primary" onClick={() => handleVerifyClick(true)} disabled={cooldown > 0}>
                                     <RefreshCw className={cn("h-4 w-4 mt-0.5", cooldown > 0 && "opacity-50")} />
                                 </Button>
                             </TooltipTrigger><TooltipContent><p>{cooldown > 0 ? `Retry in ${cooldown}s` : "Resend Code"}</p></TooltipContent></Tooltip></TooltipProvider>
                         </div>
                    )}
                </div>

                {account.isVerified ? (
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center justify-center h-8 w-8 cursor-help">
                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Number Verified</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    <TooltipProvider delayDuration={100}>
                        <Tooltip open={!isVerifying ? isTooltipOpen : false} onOpenChange={setIsTooltipOpen}>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button" variant="ghost" size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-primary"
                                    onMouseEnter={() => { if(isVerifying) setIsCancelHovered(true) }}
                                    onMouseLeave={() => { if(isVerifying) setIsCancelHovered(false) }}
                                    onClick={isVerifying ? handleCancelVerification : () => handleVerifyClick(false)}
                                >
                                    {isVerifying ? (
                                        isCancelHovered ? <X className="h-4 w-4 text-destructive" /> : <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="h-4 w-4 hover:text-primary" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>{isVerifying ? "Cancel" : `Costs ${cost.toFixed(2)} credits to pair with your assistant. Verify first to link.`}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* Trash Button */}
                {!account.isInitial && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-destructive" onClick={() => onRemove(index)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {socialAccountErrors ? (
                <p className="text-sm font-medium text-destructive mt-1 pl-7">{socialAccountErrors.message}</p>
            ) : verificationError ? (
                <p className="text-sm font-medium text-destructive mt-1 pl-7 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{verificationError}</p>
            ) : null }
        </div>
    );
};