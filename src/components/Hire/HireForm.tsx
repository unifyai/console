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

// Define static skills text
const staticSkillsText = `I come with the same foundational skills as all other assistants on the platform. I can then specialize in whichever area you want me to, as you show me how to do the tasks and I can learn from examples and then take on these tasks myself if you want.`;

interface HireFormProps {
    formMethods: UseFormReturn<PersonaFormData>;
    onSubmit: (data: PersonaFormData) => void;
    onImageRemove: () => void; // Add prop for image removal callback
    // onOpenPresets prop removed
}

export function HireForm({ formMethods, onSubmit, onImageRemove }: HireFormProps) {
  // ... register, handleSubmit, watch, setValue ...
  const { register, handleSubmit, formState: { errors }, watch, setValue } = formMethods;

    // Watch the avatar preview URL to update the ImageUpload component
  const avatarPreview = watch("avatarPreview");

  const handleFileChange = (file: File | null) => {
    setValue("avatarFile", file, { shouldValidate: true }); // Store the file object

    // Create/revoke preview URL
    const currentPreview = watch("avatarPreview");
    if (currentPreview) {
      URL.revokeObjectURL(currentPreview); // Clean up old preview
    }
    if (file) {
      setValue("avatarPreview", URL.createObjectURL(file));
    } else {
      setValue("avatarPreview", null);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-4 sm:px-8 sm:py-6 h-full overflow-y-auto"> {/* Example padding */}
    <Card className="rounded-none border-none shadow-none"> {/* Remove styling */}
        <CardHeader className="px-0 pt-0"> {/* Adjust padding if needed */}
          <CardTitle>Hire Assistant</CardTitle>
          <CardDescription>Define the profile details for your new hire.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-0 pb-0"> {/* Adjust padding if needed */}

          <div className="flex flex-col sm:flex-row items-start gap-6">
            <ImageUpload
              previewUrl={avatarPreview}
              onFileChange={handleFileChange}
              onRemove={onImageRemove} // Pass down remove handler
              className="flex-shrink-0"
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 flex-1">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" {...register("firstName")} />
                {/* Add error display if needed */}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" {...register("lastName")} />
              </div>
              <div>
                <Label htmlFor="age">Age</Label>
                 {/* Use text type for easier handling, parse on submit */}
                <Input id="age" type="number" {...register("age")} />
              </div>
              <div>
                <Label htmlFor="region">Region</Label>
                <Input id="region" {...register("region")} placeholder="e.g., US, EU" />
              </div>
              {/* Action Buttons */}
              <div className="col-span-2 flex items-center gap-3 pt-2">
                 <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
                    Hire me
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
              {...register("about")}
            />
          </div>

          <Separator />

          {/* Skills Section (Non-Editable) */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Skills</Label>
            <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
              {staticSkillsText}
            </p>
          </div>

        </CardContent>
      </Card>
    </form>
  );
}