'use client';

import * as React from 'react';
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/UI/input";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { Separator } from "@/components/UI/separator";
import { ImageUpload } from './AssistantHireImageUpload';
import { AssistantFormData, AssistantActions } from '@/types/team/assistant';
import { VoiceCustomization } from './AssistantHireVoiceCustomization';
import { Volume2, User, LetterText, BriefcaseBusiness, Mail, Phone, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

const staticSkillsText = `I come with the same foundational skills as all other assistants on the platform. I can then specialize in whichever area you want me to, as you show me how to do the tasks and I can learn from examples and then take on these tasks myself if you want.`;
const EMAIL_DOMAIN_WITH_AT = "@unify.ai";

export interface HireFormProps {
  formMethods: UseFormReturn<AssistantFormData>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  assistantActions: AssistantActions;
  onVoiceProcessingStateChange?: (isProcessing: boolean) => void;
  allAssistantEmails: string[];
}

export function HireForm({
    formMethods,
    onSubmit,
    isSubmitting,
    assistantActions,
    onVoiceProcessingStateChange,
    allAssistantEmails,
}: HireFormProps) {
  const { register, formState: { errors }, watch, setValue, getValues, trigger } = formMethods;

  const imagePreviewUrl = watch("imagePreview");
  const firstName = watch("first_name");
  const surname = watch("surname");
  const rhfEmail = watch("email");

  const [emailLocalPart, setEmailLocalPart] = React.useState('');

  // Sync local part state from RHF's full email (e.g., on preset selection or reset)
  React.useEffect(() => {
    if (rhfEmail && rhfEmail.endsWith(EMAIL_DOMAIN_WITH_AT)) {
        const local = rhfEmail.substring(0, rhfEmail.length - EMAIL_DOMAIN_WITH_AT.length);
        if (local !== emailLocalPart) { // Avoid unnecessary state updates
            setEmailLocalPart(local);
        }
    } else if (rhfEmail) { // If email doesn't have domain (e.g. invalid state), show as is
         if (rhfEmail !== emailLocalPart) {
            setEmailLocalPart(rhfEmail);
         }
    } else { // If RHF email is empty
        if (emailLocalPart !== '') {
            setEmailLocalPart('');
        }
    }
  }, [rhfEmail]); // Only rhfEmail dependency

  // Auto-generate email based on names if not manually edited
  React.useEffect(() => {
    const generateEmailLocalPartFromName = (fname: string, sname: string) => {
        const cleanFname = fname?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        const cleanSname = sname?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        if (cleanFname && cleanSname) {
            return `${cleanFname}-${cleanSname}`;
        } else if (cleanFname) {
            return cleanFname;
        } else if (cleanSname) {
            return cleanSname;
        }
        return "new-assistant"; // Fallback
    };

    if (!getValues("emailManuallyEdited") && (firstName || surname)) {
        const newLocal = generateEmailLocalPartFromName(firstName, surname);
        setValue("email", `${newLocal}${EMAIL_DOMAIN_WITH_AT}`, { shouldValidate: true });
    }
  }, [firstName, surname, setValue, getValues]);


  const handleLocalPartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLocalPart = event.target.value.replace(/[@\s]/g, ''); // Prevent @ or spaces
    setEmailLocalPart(newLocalPart); // Update local state for the input
    setValue("email", `${newLocalPart}${EMAIL_DOMAIN_WITH_AT}`, { shouldValidate: true }); // Update RHF's full email
    setValue("emailManuallyEdited", true);
    trigger("email");
  };


  const handleNewFileForUpload = (file: File | null) => {
    const currentPreview = getValues("imagePreview");
    if (currentPreview && currentPreview.startsWith('blob:')) {
      URL.revokeObjectURL(currentPreview);
    }
    setValue("imageFile", file, { shouldValidate: false });
    if (file) {
      setValue("imagePreview", URL.createObjectURL(file));
    } else {
      setValue("imagePreview", null);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 h-full flex flex-col">
     <fieldset disabled={isSubmitting} className="group flex-1 space-y-6 min-h-0 overflow-y-auto pr-1">
          <div className="space-y-2">
            <div className='flex gap-2 items-center text-muted-foreground'>
              <User className="h-4 w-4"/>
              <Label className="text-base font-semibold">Profile</Label>
            </div>
            <div className="flex flex-col sm:flex-row items-start gap-6 pt-1">
              <ImageUpload
                previewUrl={imagePreviewUrl}
                onFileChange={handleNewFileForUpload}
                className="flex-shrink-0 pt-2"
                disabled={isSubmitting}
              />
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 flex-1">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input id="first_name" {...register("first_name", { required: "First name is required" })} />
                  {errors.first_name && <p className="text-sm font-medium text-destructive mt-1">{errors.first_name.message}</p>}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="surname">Last Name</Label>
                  <Input id="surname" {...register("surname", { required: "Last name is required" })} />
                  {errors.surname && <p className="text-sm font-medium text-destructive mt-1">{errors.surname.message}</p>}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" type="number" {...register("age", { valueAsNumber: true, min: { value: 1, message: "Age must be positive" }})} />
                  {errors.age && <p className="text-sm font-medium text-destructive mt-1">{errors.age.message}</p>}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="region">Region</Label>
                  <Input id="region" placeholder="e.g., United States" {...register("region")} />
                  {errors.region && <p className="text-sm font-medium text-destructive mt-1">{errors.region.message}</p>}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Section */}
          <div className="space-y-2">
            <div className='flex gap-2 items-center text-muted-foreground'>
              <Smartphone className="h-4 w-4"/>
              <Label className="text-base font-semibold">Contact Details</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-1">
                <div>
                    <Label htmlFor="email_local_part">Assistant Email</Label>
                    <div className="flex items-center rounded-md">
                        <Input
                            id="email_local_part" 
                            type="text"
                            value={emailLocalPart}
                            onChange={handleLocalPartChange}
                            placeholder="new-assistant"
                            className="flex-grow focus-visible:ring-0 focus-visible:ring-offset-0 rounded-r-none"
                            aria-describedby="email_domain_part"
                        />
                        <span
                            id="email_domain_part"
                            className="px-3 py-2 bg-muted text-muted-foreground text-sm rounded-r-md border-l border-input select-none"
                        >
                            {EMAIL_DOMAIN_WITH_AT}
                        </span>
                    </div>
                    <input type="hidden" {...register("email", {
                        required: "Email is required",
                        pattern: {
                            value: new RegExp(`^[a-zA-Z0-9._-]+${EMAIL_DOMAIN_WITH_AT.replace(/\./g, '\\.')}$`),
                            message: `Email must use valid characters and end with ${EMAIL_DOMAIN_WITH_AT}`
                        },
                        validate: (value) => {
                            if (value.startsWith('@')) return `Email local part cannot be empty.`;
                            if (allAssistantEmails.includes(value)) {
                                return "This email is already in use by another assistant.";
                            }
                            return true;
                        }
                    })} />
                    {errors.email && <p className="text-sm font-medium text-destructive mt-1">{errors.email.message}</p>}
                </div>
                <div>
                    <Label htmlFor="user_phone">Your Phone Number (for Assistant to contact)</Label>
                    <Input
                        id="user_phone"
                        type="tel"
                        placeholder="e.g., +15551234567"
                        {...register("user_phone", {
                            // Add pattern validation for phone numbers if desired
                            pattern: {
                              value: /^\+[1-9]\d{1,14}$/,
                              message: "Enter a valid international phone number (e.g., +15551234567)"
                            }
                        })}
                    />
                    {errors.user_phone && <p className="text-sm font-medium text-destructive mt-1">{errors.user_phone.message}</p>}
                </div>
                <div>
                    <Label htmlFor="assistant_phone">Assistant Phone Number</Label>
                    <Input
                        id="assistant_phone"
                        type="text"
                        placeholder="Will be provisioned during hiring"
                        disabled={true}
                        className="bg-muted/50 cursor-not-allowed"
                    />
                </div>
            </div>
          </div>


          <Separator />
            <div className="space-y-2">
                <div className='flex gap-2 items-center text-muted-foreground'>
                  <Volume2 className="h-4 w-4"/>
                  <Label className="text-base font-semibold">Voice</Label>
                </div>
                <VoiceCustomization
                    assistantActions={assistantActions}
                    onVoiceSelected={(selectedVoice) => {
                        setValue("voice_id", selectedVoice?.voice_id, { shouldValidate: !!selectedVoice?.voice_id });
                        setValue("voice_name", selectedVoice?.name, { shouldValidate: !!selectedVoice?.name });
                        setValue("voice_description", selectedVoice?.description ?? selectedVoice?.name, { shouldValidate: !!selectedVoice?.description });
                        setValue("voice_gender", selectedVoice?.gender, { shouldValidate: !!selectedVoice?.gender });
                        setValue("voice_language", selectedVoice?.language, { shouldValidate: !!selectedVoice?.language });
                        setValue("voice_exists", selectedVoice?.isUserVoiceInOrchestra ?? false, { shouldValidate: true });
                    }}
                    initialVoiceId={getValues("voice_id")}
                    disabled={isSubmitting}
                    onProcessingStateChange={onVoiceProcessingStateChange}
                />
                 {errors.voice_id && <p className="text-sm font-medium text-destructive mt-1">{errors.voice_id.message}</p>}
                 {errors.voice_language && !errors.voice_id && <p className="text-sm font-medium text-destructive mt-1">{errors.voice_language.message}</p>}
            </div>

          <Separator />

          <div className="space-y-2">
            <div className='flex gap-2 items-center text-muted-foreground'>
              <LetterText className="h-4 w-4"/>
              <Label className="text-base font-semibold">About</Label>
            </div>
            <Textarea id="about" placeholder="Describe the persona's background, personality, etc." className="min-h-[100px]" {...register("about", { required: "About description is required" })}/>
            {errors.about && <p className="text-sm font-medium text-destructive mt-1">{errors.about.message}</p>}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className='flex gap-2 items-center text-muted-foreground'>
              <BriefcaseBusiness className="h-4 w-4"/>
              <Label className="text-base font-semibold">Skills</Label>
            </div>
            <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50"> {staticSkillsText} </p>
          </div>
     </fieldset>
    </form>
  );
}