'use client';

import * as React from 'react';
import { useForm, UseFormReturn } from "react-hook-form";
import type { PersonaFormData } from '@/types/assistants/hire';
import { Input } from "@/components/UI/input";
import { Textarea } from "@/components/UI/textarea";
import { Button } from "@/components/UI/button";
import { Label } from "@/components/UI/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/UI/card";
import { Separator } from "@/components/UI/separator";
import { ImageUpload } from './ImageUpload';
import { Loader2 } from "lucide-react";

const staticSkillsText = `I come with the same foundational skills as all other assistants on the platform. I can then specialize in whichever area you want me to, as you show me how to do the tasks and I can learn from examples and then take on these tasks myself if you want.`;

interface HireFormProps {
  formMethods: UseFormReturn<PersonaFormData>;
  onSubmit: (data: PersonaFormData) => void;
  onImageRemove: () => void;
  isSubmitting: boolean;
}

export function HireForm({ formMethods, onSubmit, onImageRemove, isSubmitting }: HireFormProps) {
  // Destructure formState.errors
  const { register, handleSubmit, formState: { errors }, watch, setValue } = formMethods;

  const imagePreviewUrl = watch("imagePreview");

  const handleFileChange = (file: File | null) => {
    const currentPreview = watch("imagePreview");
    if (currentPreview && currentPreview.startsWith('blob:')) {
      URL.revokeObjectURL(currentPreview);
    }

    // Use correct field name: imageFile
    setValue("imageFile", file, { shouldValidate: false });

    if (file) {
      const newPreviewUrl = URL.createObjectURL(file);
      setValue("imagePreview", newPreviewUrl);
    } else {
      setValue("imagePreview", null);
    }
  };

  return (
    // Use the form's handleSubmit to automatically trigger validation
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-4 sm:px-8 sm:py-6 h-full overflow-y-auto">
     {/* Disable fieldset during submission */}
     <fieldset disabled={isSubmitting} className="group">
      <Card className="rounded-none border-none shadow-none group-disabled:opacity-50 transition-opacity">
         <CardHeader className="px-0 pt-0">
          <CardTitle>Hire Assistant</CardTitle>
          <CardDescription>Define the profile details for your new hire. All fields are required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-0 pb-0">

          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Image Upload - Requirement checked in Main.tsx */}
            <ImageUpload
              previewUrl={imagePreviewUrl}
              onFileChange={handleFileChange}
              onRemove={onImageRemove}
              className="flex-shrink-0"
              disabled={isSubmitting}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 flex-1">
              {/* First Name */}
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                    id="firstName"
                    aria-invalid={errors.firstName ? "true" : "false"}
                    {...register("firstName", { required: "First name is required" })}
                />
                {errors.firstName && <p className="text-sm font-medium text-destructive mt-1">{errors.firstName.message}</p>}
              </div>
              {/* Last Name */}
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                    id="lastName"
                    aria-invalid={errors.lastName ? "true" : "false"}
                    {...register("lastName", { required: "Last name is required" })}
                 />
                 {errors.lastName && <p className="text-sm font-medium text-destructive mt-1">{errors.lastName.message}</p>}
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
              {/* Hire Button */}
              <div className="col-span-2 flex items-center gap-3 pt-2">
                 <Button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Hiring...
                        </>
                      ) : "Hire me" }
                 </Button>
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

        </CardContent>
      </Card>
     </fieldset>
    </form>
  );
}