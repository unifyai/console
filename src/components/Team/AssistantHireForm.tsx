'use client';

import * as React from 'react';
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/UI/input";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { Separator } from "@/components/UI/separator";
import { ImageUpload } from './AssistantHireImageUpload';
import { AssistantFormData, AssistantActions, VoiceOption, VoicePreset as VoicePresetType } from '@/types/team/assistant'; // Ensure VoicePresetType if still used
import { VoiceCustomization } from './VoiceCustomization'; 
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { SupportedLanguage } from '@cartesia/cartesia-js/api';


const staticSkillsText = `I come with the same foundational skills as all other assistants on the platform. I can then specialize in whichever area you want me to, as you show me how to do the tasks and I can learn from examples and then take on these tasks myself if you want.`;

interface HireFormProps {
  formMethods: UseFormReturn<AssistantFormData>;
  onSubmit: (data: AssistantFormData) => void;
  onImageRemove: () => void;
  isSubmitting: boolean;
  assistantActions: AssistantActions; 
}

export function HireForm({ 
    formMethods, 
    onSubmit, 
    onImageRemove, 
    isSubmitting,
    assistantActions,
}: HireFormProps) {
  const { register, handleSubmit, formState: { errors }, watch, setValue, getValues } = formMethods;

  const imagePreviewUrl = watch("imagePreview");

  const handleFileChange = (file: File | null) => {
    const currentPreview = getValues("imagePreview");
    if (currentPreview && currentPreview.startsWith('blob:')) URL.revokeObjectURL(currentPreview);
    setValue("imageFile", file, { shouldValidate: false });
    if (file) setValue("imagePreview", URL.createObjectURL(file));
    else setValue("imagePreview", null);
  };

  const internalOnSubmit = (data: AssistantFormData) => onSubmit(data); 

  return (
    <form onSubmit={handleSubmit(internalOnSubmit)} className="space-y-6 h-full flex flex-col"> 
     <fieldset disabled={isSubmitting} className="group flex-1 space-y-6 min-h-0 overflow-y-auto pr-1">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <ImageUpload
              previewUrl={imagePreviewUrl}
              onFileChange={handleFileChange}
              onRemove={onImageRemove}
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

          <Separator />
            <div >
                <Label className="text-base font-semibold">Voice</Label>
                <p className="text-xs text-muted-foreground mb-2">Select a preset voice or create a new one for the assistant.</p>
                <VoiceCustomization
                    assistantActions={assistantActions}
                    onVoiceSelected={(voiceId, languageCode) => {
                        setValue("voice_id", voiceId, { shouldValidate: !!voiceId }); // Validate if voiceId is present
                        setValue("voice_language", languageCode, { shouldValidate: !!languageCode });
                    }}
                    initialVoiceId={getValues("voice_id")}
                    initialLanguageCode={getValues("voice_language") as SupportedLanguage | null}
                    disabled={isSubmitting}
                />
                 {errors.voice_id && <p className="text-sm font-medium text-destructive mt-1">{errors.voice_id.message}</p>}
                 {errors.voice_language && !errors.voice_id && <p className="text-sm font-medium text-destructive mt-1">{errors.voice_language.message}</p>}
            </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="about" className="text-base font-semibold">About</Label> 
            <Textarea id="about" placeholder="Describe the persona's background, personality, etc." className="min-h-[100px]" {...register("about", { required: "About description is required" })}/>
            {errors.about && <p className="text-sm font-medium text-destructive mt-1">{errors.about.message}</p>}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-base font-semibold">Skills</Label>
            <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50"> {staticSkillsText} </p>
          </div>
     </fieldset>
    </form>
  );
}