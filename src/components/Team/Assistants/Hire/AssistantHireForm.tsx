// src/components/Team/AssistantHireForm.tsx
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
import { Volume2, User, LetterText, BriefcaseBusiness } from 'lucide-react';

const staticSkillsText = `I come with the same foundational skills as all other assistants on the platform. I can then specialize in whichever area you want me to, as you show me how to do the tasks and I can learn from examples and then take on these tasks myself if you want.`;

export interface HireFormProps {
  formMethods: UseFormReturn<AssistantFormData>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  assistantActions: AssistantActions;
}

export function HireForm({
    formMethods,
    onSubmit,
    isSubmitting,
    assistantActions,
}: HireFormProps) {
  const { register, formState: { errors }, watch, setValue, getValues } = formMethods;

  const imagePreviewUrl = watch("imagePreview");

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