'use client';

import * as React from 'react';
import { useFormContext, Controller, useWatch } from 'react-hook-form';
import { Input } from "@/components/UI/input";
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { Label } from "@/components/UI/label";
import { Check, Trash2, Loader2, RefreshCw, X, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssistantFormData, AssistantActions } from '@/types/assistants/assistant';
import { getPlatformIcon } from '@/utils/assistants/platform-utils';
import { useAccountVerification } from '@/hooks/Assistants/useAccountVerification';
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
    const { control, formState: { errors }, setValue, getValues, clearErrors } = useFormContext<AssistantFormData>();
    const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);

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
        if (errors.social_accounts?.[index]?.identifier) {
            clearErrors(fieldNames.identifier);
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
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {getPlatformIcon(platform, "h-4 w-4 text-muted-foreground")}
                    <Label className="capitalize">{platform}</Label>
                </div>
                {!account.isInitial && (
                    <Button type="button" variant="ghost" size="sm" className="h-auto p-1 text-xs font-semibold text-muted-foreground hover:text-destructive" onClick={() => onRemove(index)} disabled={isVerifying}>Remove</Button>
                )}
            </div>
            <div className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                    <Input
                        id={`social_accounts_${index}_identifier`}
                        placeholder={`Your ${platform} phone number...`}
                        className="h-9 flex-1"
                        value={account.identifier || ''}
                        disabled={isVerifying || account.isVerified}
                        onChange={handleIdentifierChange}
                    />
                    {account.isVerified ? (
                        <Button type="button" variant="default" className="h-9" disabled>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Verified
                        </Button>
                    ) : (
                        <TooltipProvider delayDuration={100}>
                            <Tooltip open={!isVerifying ? isTooltipOpen : false} onOpenChange={setIsTooltipOpen}>
                                <TooltipTrigger asChild>
                                    <Button type="button" variant="outline" className="h-9" onClick={() => handleVerifyClick(false)} disabled={isVerifying || !account.identifier}>
                                        {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        {isVerifying ? 'Verifying...' : 'Verify'}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p>Costs ${cost.toFixed(2)} credits to pair with your assistant. Verify first to link.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                {isVerificationFlowActive && (
                <div className="pl-4 flex items-start gap-3 border-l-2 border-muted">
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                            <Input
                                id={`social_accounts_${index}_verification_code`}
                                placeholder="Enter verification code..."
                                value={verificationInput}
                                onChange={(e) => setVerificationInput(e.target.value)}
                                onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleSubmitCode(); }}}
                                className={cn("h-9", verificationError && "border-destructive")}
                            />
                            <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleSubmitCode}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                         {verificationError && <p className="text-sm font-medium text-destructive mt-1 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{verificationError}</p>}
                    </div>
                    <div className="flex items-center gap-2 pt-0">
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => handleVerifyClick(true)} disabled={cooldown > 0}>
                            {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}
                        </Button>
                        <Button type="button" variant="warning" size="sm" className="h-9" onClick={handleCancelVerification}>
                            Cancel
                        </Button>
                    </div>
                </div>
                )}
                {socialAccountErrors && !isVerificationFlowActive ? (
                    <p className="text-sm font-medium text-destructive mt-1">{socialAccountErrors.message}</p>
                ) : null}
            </div>
        </div>
    );
};