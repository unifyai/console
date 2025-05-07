'use client';

import * as React from 'react';
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/UI/input";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { Separator } from "@/components/UI/separator";
import { ImageUpload } from './AssistantHireImageUpload';
import { AssistantFormData } from '@/types/team/assistant';

const staticSkillsText = `I come with the same foundational skills as all other assistants on the platform. I can then specialize in whichever area you want me to, as you show me how to do the tasks and I can learn from examples and then take on these tasks myself if you want.`;

interface HireFormProps {
  formMethods: UseFormReturn<AssistantFormData>;
  onSubmit: (data: AssistantFormData) => void;
  onImageRemove: () => void;
  isSubmitting: boolean;
  // No need for 'children' prop if submit button is inside
}

export function HireForm({ formMethods, onSubmit, onImageRemove, isSubmitting }: HireFormProps) {
  const { register, handleSubmit, formState: { errors }, watch, setValue, getValues } = formMethods; // Added getValues

  const imagePreviewUrl = watch("imagePreview");

  const handleFileChange = (file: File | null) => {
    const currentPreview = getValues("imagePreview"); // Use getValues here
    if (currentPreview && currentPreview.startsWith('blob:')) {
      URL.revokeObjectURL(currentPreview);
    }

    setValue("imageFile", file, { shouldValidate: false }); // No change needed here

    if (file) {
      const newPreviewUrl = URL.createObjectURL(file);
      setValue("imagePreview", newPreviewUrl);
    } else {
      setValue("imagePreview", null);
    }
  };

  // This internal submit handler is called by RHF's handleSubmit
  const internalOnSubmit = (data: AssistantFormData) => {
      onSubmit(data); // Call the prop onSubmit passed from parent
  };

  return (
    // Use the form's handleSubmit which wraps internalOnSubmit
    <form onSubmit={handleSubmit(internalOnSubmit)} className="space-y-6 h-full flex flex-col"> 
     {/* Disable fieldset during submission */}
     <fieldset disabled={isSubmitting} className="group flex-1 space-y-6 min-h-0 overflow-y-auto pr-1">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Image Upload */}
            <ImageUpload
              previewUrl={imagePreviewUrl}
              onFileChange={handleFileChange}
              onRemove={onImageRemove}
              className="flex-shrink-0 pt-2" // Adjusted padding
              disabled={isSubmitting}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 flex-1">
              {/* First Name */}
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                    id="first_name"
                    aria-invalid={errors.first_name ? "true" : "false"}
                    {...register("first_name", { required: "First name is required" })}
                />
                {errors.first_name && <p className="text-sm font-medium text-destructive mt-1">{errors.first_name.message}</p>}
              </div>
              {/* Last Name */}
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="surname">Last Name</Label>
                <Input
                    id="surname"
                    aria-invalid={errors.surname ? "true" : "false"}
                    {...register("surname", { required: "Last name is required" })}
                 />
                 {errors.surname && <p className="text-sm font-medium text-destructive mt-1">{errors.surname.message}</p>}
              </div>
              {/* Age */}
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="age">Age</Label>
                <Input
                    id="age"
                    type="number"
                    aria-invalid={errors.age ? "true" : "false"}
                    {...register("age", {
                        required: "Age is required",
                        valueAsNumber: true,
                        min: { value: 1, message: "Age must be positive" }
                    })}
                />
                 {errors.age && <p className="text-sm font-medium text-destructive mt-1">{errors.age.message}</p>}
              </div>
              {/* Region */}
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="region">Region</Label>
                <Input
                    id="region"
                    placeholder="e.g., United States, China"
                    aria-invalid={errors.region ? "true" : "false"}
                    {...register("region", { required: "Region is required" })}
                />
                 {errors.region && <p className="text-sm font-medium text-destructive mt-1">{errors.region.message}</p>}
              </div>
            </div>
          </div>

          <Separator />

          {/* About Section */}
          <div className="space-y-2">
            <Label htmlFor="about" className="text-base font-semibold">About</Label>
            <Textarea
              id="about"
              placeholder="Describe the persona's background, personality, etc."
              className="min-h-[100px]"
              aria-invalid={errors.about ? "true" : "false"}
              {...register("about", { required: "About description is required" })}
            />
             {errors.about && <p className="text-sm font-medium text-destructive mt-1">{errors.about.message}</p>}
          </div>

          <Separator />

          {/* Skills Section (Static - No validation needed) */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Skills</Label>
            <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
              {staticSkillsText}
            </p>
          </div>
     </fieldset>

    </form>
  );
}