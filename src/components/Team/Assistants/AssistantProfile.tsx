import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { Button } from "@/components/UI/button";
import { Textarea } from "@/components/UI/textarea";
import { Input } from "@/components/UI/input";
import { Label } from "@/components/UI/label";
import { Separator } from "@/components/UI/separator";
import { Mail, Phone, Save, Undo2, X, Trash2, Loader2, AlertTriangle, PlusCircle, PenLine } from "lucide-react";
import { WhatsApp } from '@mui/icons-material';
import type { Assistant, AssistantActions, AssistantUpdatePayload, SocialAccount, AvailableSocialPlatform, AssistantFormData } from '@/types/team/assistant';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/UI/scroll-area';
import { FormProvider, useForm, useFieldArray } from 'react-hook-form';
import { SocialAccountInput } from './Hire/SocialAccountInput';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/UI/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/UI/alert-dialog";
import { toast } from 'sonner';
import { ASSISTANT_ONBOARDING_FEE } from '@/constants/assistants/settings';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface AssistantProfilePanelProps {
    assistant: Assistant;
    onClose: () => void;
    onUpdateProfile: (id: string, payload: Partial<AssistantUpdatePayload>) => Promise<any>; 
    onDeleteAssistant: (assistant: Assistant) => Promise<void>;
    assistantActions: AssistantActions;
    availableSocialPlatforms: AvailableSocialPlatform[];
    isLoadingSocialPlatforms: boolean;
}

export function AssistantProfilePanel({
    assistant,
    onClose,
    onUpdateProfile,
    onDeleteAssistant,
    assistantActions,
    availableSocialPlatforms,
    isLoadingSocialPlatforms,
}: AssistantProfilePanelProps) {
    
    const [isSaving, setIsSaving] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isAlertOpen, setIsAlertOpen] = React.useState(false);
    const [justAddedPlatform, setJustAddedPlatform] = React.useState<string | null>(null);

    const formMethods = useForm<AssistantFormData>();
    const { control, register, handleSubmit, reset, formState: { errors, isDirty } } = formMethods;
    const { fields, append, remove } = useFieldArray({ control, name: "social_accounts" });

    React.useEffect(() => {
        if (assistant) {
            const socialAccounts: SocialAccount[] = [];
            if (assistant.user_whatsapp_number) {
                socialAccounts.push({
                    platform: 'whatsapp',
                    identifier: assistant.user_whatsapp_number,
                    isVerified: true,
                    isVerifying: false,
                    verificationCodeSent: null,
                    verificationSentAt: null,
                    verificationAttempts: 0,
                    verificationError: null,
                });
            }

            reset({
                about: assistant.about || '',
                user_phone: assistant.user_phone || '',
                social_accounts: socialAccounts,
            });
            setIsSaving(false);
            setIsDeleting(false);
        }
    }, [assistant, reset]);

    const handleSaveAll = handleSubmit(async (formData) => {
        if (isSaving) return;
        if (formData.social_accounts?.some(acc => !acc.isVerified)) {
            toast.error("Please verify all added social accounts before saving.");
            return;
        }

        setIsSaving(true);
        const whatsappAccount = formData.social_accounts?.find(acc => acc.platform === 'whatsapp');
        const payload: Partial<AssistantUpdatePayload> = {
            about: formData.about,
            user_phone: formData.user_phone,
            user_whatsapp_number: whatsappAccount ? whatsappAccount.identifier : null,
        };

        try {
            await onUpdateProfile(assistant.agent_id, payload);
            reset(formData); // This updates the form's default values to the new state, clearing `isDirty`
        } catch (e) {
            console.error("Failed to update profile", e);
        } finally {
            setIsSaving(false);
        }
    });

    const handleDiscardAll = () => {
        if (assistant) {
            const socialAccounts: SocialAccount[] = [];
            if (assistant.user_whatsapp_number) {
                socialAccounts.push({ platform: 'whatsapp', identifier: assistant.user_whatsapp_number, isVerified: true, isVerifying: false, verificationCodeSent: null, verificationSentAt: null, verificationAttempts: 0, verificationError: null });
            }
            reset({
                about: assistant.about || '',
                user_phone: assistant.user_phone || '',
                social_accounts: socialAccounts,
            });
        }
    };

     const handleDeleteConfirm = async () => {
        if (!assistant || isDeleting) return;

        setIsDeleting(true);
        try {
            await onDeleteAssistant(assistant);
            setIsAlertOpen(false);
        } catch (error) {
             console.error("Error occurred during delete confirmation (handled by parent):", error)
             setIsAlertOpen(false);
        } finally {
             setIsDeleting(false);
        }
     };
     
    const handleAddSocialAccount = (platform: string) => {
        if (fields.some(field => field.platform === platform)) {
            toast.info(`You have already added an account for ${platform}.`);
            return;
        }
        append({ platform: platform, identifier: '', isVerified: false, isVerifying: false, verificationCodeSent: null, verificationSentAt: null, verificationAttempts: 0, verificationError: null });
        setJustAddedPlatform(platform);
    };

    if (!assistant) return null;

    const photoSrc = assistant.signedProfilePhotoUrl || assistant.profile_photo;
    const displayName = `${assistant.first_name} ${assistant.surname}`;

    return (
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <FormProvider {...formMethods}>
                <form onSubmit={handleSaveAll} className="h-full flex flex-col w-full bg-background">
                    {/* Header */}
                    <div className="px-4 py-3.5 sm:px-6 sm:py-3.5 border-b flex-shrink-0">
                        <div className='flex items-center justify-between'>
                            <h2 className="text-lg font-semibold">{`${displayName}'s profile`}</h2>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} disabled={isSaving}>
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close Profile</span>
                            </Button>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="py-4 sm:py-6 space-y-6">
                            {/* Basic Info */}
                            <div className="flex items-start gap-4 sm:gap-6 px-4 sm:px-6">
                                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border">
                                    <AvatarImage src={photoSrc ?? undefined} alt={displayName} />
                                    <AvatarFallback className="text-xl">
                                        {`${assistant.first_name?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm flex-1">
                                    <Label className="text-muted-foreground">First Name</Label>
                                    <span>{assistant.first_name}</span>
                                    <Label className="text-muted-foreground">Last Name</Label>
                                    <span>{assistant.surname}</span>
                                    <Label className="text-muted-foreground">Age</Label>
                                    <span>{assistant.age ?? 'N/A'}</span>
                                    <Label className="text-muted-foreground">Region</Label>
                                    <span>{assistant.region ?? 'N/A'}</span>
                                </div>
                            </div>

                            <Separator />

                            {/* About Section */}
                            <div className="px-4 sm:px-6 space-y-2 group">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor={`about-${assistant.agent_id}`} className="text-base font-semibold">About Me</Label>
                                    <TooltipProvider delayDuration={100}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <PenLine className="h-4 w-4 text-muted-foreground" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Editable Section</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Textarea
                                    id={`about-${assistant.agent_id}`}
                                    {...register("about")}
                                    placeholder="Enter details about the assistant..."
                                    disabled={isSaving}
                                    className="text-sm min-h-[100px] resize-none peer"
                                    rows={4}
                                />
                            </div> 

                            <Separator />

                            {/* Contact Section */}
                            <div className="px-4 sm:px-6 space-y-3 group/contact">
                                <h3 className="text-base font-semibold">My Contact</h3>
                                <div className="space-y-4 text-sm">
                                    {/* Assistant-owned details (display only) */}
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate">{assistant.email || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span>{assistant.phone || 'N/A'}</span>
                                    </div>
                                    {assistant.assistant_whatsapp_number && (
                                        <div className="flex items-center gap-3">
                                            <WhatsApp className="h-4 w-4 text-muted-foreground" />
                                            <span>{assistant.assistant_whatsapp_number}</span>
                                        </div>
                                    )}

                                    <Separator className="my-3"/>

                                    {/* User-owned details (editable) */}
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-semibold">Where Can I Reach Out?</h3>
                                        <TooltipProvider delayDuration={100}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <PenLine className="h-4 w-4 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Editable Section</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`user-phone-${assistant.agent_id}`}>Your Phone Number</Label>
                                        <Input
                                            id={`user-phone-${assistant.agent_id}`}
                                            type="tel"
                                            placeholder="e.g., +15551234567"
                                            {...register("user_phone", {
                                                required: "Your phone number is required.",
                                                pattern: { value: /^\+[1-9]\d{7,14}$/, message: "Enter a valid international phone number (e.g., +15551234567)" },
                                            })}
                                            className="h-9"
                                            disabled={isSaving}
                                        />
                                        {errors.user_phone && <p className="text-sm font-medium text-destructive mt-1">{errors.user_phone.message}</p>}
                                    </div>

                                    {fields.map((field, index) => {
                                        const platformInfo = availableSocialPlatforms.find(p => p.name === field.platform);
                                        const platformCost = platformInfo?.cost ?? ASSISTANT_ONBOARDING_FEE;
                                        return <SocialAccountInput key={field.id} index={index} platform={field.platform} justAddedPlatform={justAddedPlatform} onRemove={() => remove(index)} clearJustAdded={() => setJustAddedPlatform(null)} assistantActions={assistantActions} cost={platformCost} />;
                                    })}
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button type="button" variant="outline" className="w-full border-dashed" disabled={isLoadingSocialPlatforms || (availableSocialPlatforms.length > 0 && availableSocialPlatforms.every(p => fields.some(f => f.platform === p.name)))}>
                                                <PlusCircle className="mr-2 h-4 w-4" /> Add Social Account
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                                            {isLoadingSocialPlatforms ? <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
                                                : availableSocialPlatforms.length > 0 ? (
                                                availableSocialPlatforms.map(platform => (
                                                    <DropdownMenuItem key={platform.name} onSelect={() => handleAddSocialAccount(platform.name)} disabled={fields.some(f => f.platform === platform.name)} className="capitalize flex justify-between">
                                                        <span>{platform.name}</span>
                                                        <span className="text-muted-foreground text-xs">{platform.cost.toFixed(2)} credits</span>
                                                    </DropdownMenuItem>
                                                ))
                                            ) : <DropdownMenuItem disabled>No platforms available.</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer Action Buttons */}
                    <div className="px-4 py-3 sm:px-6 sm:py-4 border-t flex justify-between items-center flex-shrink-0">
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" size="sm" disabled={isDeleting || isSaving}>
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                End contract
                            </Button>
                        </AlertDialogTrigger>
                        {isDirty && (
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="warning" size="sm" onClick={handleDiscardAll} disabled={isSaving} className="flex items-center">
                                    <Undo2 className="h-4 w-4"/> 
                                    Undo
                                </Button>
                                <Button type="submit" size="sm" disabled={isSaving} className="flex items-center">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 
                                    Update
                                </Button>
                            </div>
                        )}
                    </div>
                </form>
            </FormProvider>

            {/* Alert Dialog Content */}
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center">
                        <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
                        Confirm End Contract
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        You are about to remove <strong>{displayName}</strong> from your team. This action cannot be undone. Are you sure?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                        className={cn(
                            "bg-destructive hover:bg-destructive/90",
                            isDeleting && "cursor-not-allowed opacity-70"
                        )}
                    >
                        {isDeleting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Proceed
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
  );
}