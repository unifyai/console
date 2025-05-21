'use client';

import * as React from 'react';
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/UI/input";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { Separator } from "@/components/UI/separator";
import { ImageUpload } from './AssistantHireImageUpload';
import { AssistantFormData, AssistantActions, VoiceOption, VoicePreset as CartesiaVoicePresetType } from '@/types/team/assistant'; // Corrected VoicePreset import
import { VoiceCustomization } from './VoiceCustomization'; 
import { Button } from '../UI/button';
import { Volume2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
  const aboutText = watch("about");
  const selectedVoiceId = watch("voice_id"); // Matches AssistantFormData
  const selectedVoiceLanguageCode = watch("voice_language"); // Matches AssistantFormData

  const [isPlayingAbout, setIsPlayingAbout] = React.useState(false);
  const [isPlayingSkills, setIsPlayingSkills] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleFileChange = (file: File | null) => {
    const currentPreview = getValues("imagePreview");
    if (currentPreview && currentPreview.startsWith('blob:')) URL.revokeObjectURL(currentPreview);
    setValue("imageFile", file, { shouldValidate: false });
    if (file) setValue("imagePreview", URL.createObjectURL(file));
    else setValue("imagePreview", null);
  };

  const internalOnSubmit = (data: AssistantFormData) => onSubmit(data); 

  const playTTS = async (text: string | null | undefined, setIsPlayingState: React.Dispatch<React.SetStateAction<boolean>>) => {
    if (!text || !selectedVoiceId || !selectedVoiceLanguageCode) {
        toast.error("Please select a voice and ensure text is available to preview.");
        return;
    }
    if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause(); audioRef.current.currentTime = 0;
        setIsPlayingState(false); 
        if (setIsPlayingState === setIsPlayingAbout && isPlayingAbout) return;
        if (setIsPlayingState === setIsPlayingSkills && isPlayingSkills) return;
    }

    setIsPlayingState(true);
    const toastId = toast.loading("Generating audio preview...");

    try {
        const result = await assistantActions.voice.generateTTS(selectedVoiceId, text, selectedVoiceLanguageCode as SupportedLanguage);
        if (result instanceof ArrayBuffer) { // Check for ArrayBuffer
            const blob = new Blob([result], { type: 'audio/wav' }); // Create Blob on client
            const audioURL = URL.createObjectURL(blob);
            if (audioRef.current) {
                audioRef.current.src = audioURL;
                audioRef.current.play().catch(e => { console.error("Audio play error:", e); toast.error("Could not play audio.", { id: toastId }); setIsPlayingState(false); });
                audioRef.current.onended = () => { setIsPlayingState(false); URL.revokeObjectURL(audioURL); };
                audioRef.current.onerror = () => { toast.error("Error loading audio source.", {id: toastId}); setIsPlayingState(false); URL.revokeObjectURL(audioURL); }
            }
            toast.success("Audio preview ready.", { id: toastId, duration: 2000 });
        } else { // Handle ResponseProps (error case)
            toast.error(result.detail || "Failed to generate TTS.", { id: toastId }); setIsPlayingState(false);
        }
    } catch (error: any) {
        toast.error(`TTS Error: ${error.message}`, { id: toastId }); setIsPlayingState(false);
    }
  };

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
                <Input id="age" type="number" {...register("age", { required: "Age is required", valueAsNumber: true, min: { value: 1, message: "Age must be positive" }})}/>
                 {errors.age && <p className="text-sm font-medium text-destructive mt-1">{errors.age.message}</p>}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="region">Region</Label>
                <Input id="region" placeholder="e.g., United States" {...register("region", { required: "Region is required" })} />
                 {errors.region && <p className="text-sm font-medium text-destructive mt-1">{errors.region.message}</p>}
              </div>
            </div>
          </div>

          <Separator />
            <div className="space-y-2">
                <Label className="text-base font-semibold">Voice</Label>
                <VoiceCustomization
                    assistantActions={assistantActions}
                    onVoiceSelected={(voiceId, languageCode) => {
                        setValue("voice_id", voiceId, { shouldValidate: true });
                        setValue("voice_language", languageCode, { shouldValidate: true });
                    }}
                    initialVoiceId={getValues("voice_id")}
                    initialLanguageCode={getValues("voice_language")}
                    disabled={isSubmitting}
                />
                 {errors.voice_id && <p className="text-sm font-medium text-destructive mt-1">{errors.voice_id.message}</p>}
            </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between items-center"> 
              <Label htmlFor="about" className="text-base font-semibold">About</Label> 
              <Button type="button" variant="ghost" size="icon" onClick={() => playTTS(aboutText, setIsPlayingAbout)}
                disabled={isSubmitting || isPlayingAbout || !selectedVoiceId || !aboutText || !selectedVoiceLanguageCode}
                title="Preview About" className="h-7 w-7"
              > {isPlayingAbout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />} </Button> 
            </div>
            <Textarea id="about" placeholder="Persona background, personality..." className="min-h-[100px]" {...register("about", { required: "About description is required" })}/>
            {errors.about && <p className="text-sm text-destructive mt-1">{errors.about.message}</p>}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">Skills</Label>
              <Button type="button" variant="ghost" size="icon" onClick={() => playTTS(staticSkillsText, setIsPlayingSkills)}
                disabled={isSubmitting || isPlayingSkills || !selectedVoiceId || !selectedVoiceLanguageCode}
                title="Preview Skills" className="h-7 w-7"
              > {isPlayingSkills ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />} </Button>
            </div>
            <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50"> {staticSkillsText} </p>
          </div>
          <audio ref={audioRef} className="hidden" />
     </fieldset>
    </form>
  );
}