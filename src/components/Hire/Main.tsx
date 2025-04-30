
'use client';

import * as React from 'react';
import { useForm } from "react-hook-form";
import type { PersonaFormData, HirePreset, HireActions, CreateAssistantImageResponse } from '@/types/assistants/hire';
import { HireForm } from './HireForm';
import { PresetsPanel } from './PresetsPanel';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/UI/button';
import { LayoutList } from 'lucide-react';
import assistantPresets from "@/constants/assistants/assistant_presets";
import { Toaster, toast } from 'sonner';
import { ResponseProps } from '@/types/common';

const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export default function Main({ hireActions }: { hireActions: HireActions }) {
    
    const [isPresetsOpen, setIsPresetsOpen] = React.useState(true);
    const [sampledPresets, setSampledPresets] = React.useState<HirePreset[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const formMethods = useForm<PersonaFormData>({
        defaultValues: {
            firstName: '',
            lastName: '',
            age: '',
            region: '',
            about: '',
            imageFile: null,
            imagePreview: null,
        },
    });

    const { setValue, watch, reset, getValues, setError, clearErrors } = formMethods;

    React.useEffect(() => {
        const shuffled = shuffleArray(assistantPresets as HirePreset[]);
        setSampledPresets(shuffled.slice(0, 10));
    }, []);

    React.useEffect(() => {
        const subscription = watch(() => {});
        return () => subscription.unsubscribe();
    }, [watch]);

    const uploadImageToGCS = async (file: File, signedUrl: string): Promise<boolean> => {
         try {
             const response = await fetch(signedUrl, {
                 method: 'PUT',
                 headers: { 'Content-Type': file.type },
                 body: file,
             });
             if (!response.ok) {
                 const errorText = await response.text();
                 console.error("GCS Upload Failed:", response.status, errorText);
                 toast.error(`Image upload failed: ${response.statusText} (Status: ${response.status})`);
                 return false;
             }
             return true;
         } catch (error: any) {
            console.error("Error during GCS fetch:", error);
            toast.error(`Image upload network error: ${error.message}`);
            return false;
         }
     };
 
    const handleFormSubmit = async (data: PersonaFormData) => {

        setIsSubmitting(true);
        clearErrors();
        const toastId = toast.loading("Processing request...");
        let finalImageUrlToSend: string | null = null;
        let uploadedFilePath: string | null = null;
        let bucketName: string | null = null;

        try {
            // 1. Handle Image Upload / Preset Check
            toast.loading("Hiring assistant...", { id: toastId });
            const imageFile = data.imageFile;

            if (imageFile instanceof File) {
                const createImageResult = await hireActions.createImage(
                    imageFile.type,
                    imageFile.size
                );
            
                // Check if the action returned an error object
                if ('message' in createImageResult || ('success' in createImageResult && !createImageResult.success)) {
                    const errorResult = createImageResult as ResponseProps;
                    const errorMsg = errorResult.detail || errorResult.message || "Failed to get image upload details.";
                    console.error("Error from createImage action:", errorResult);
                    toast.error(errorMsg, { id: toastId });
                    setIsSubmitting(false);
                    return; // Stop execution
                }
            
                // If successful, proceed (cast needed as TS knows it could be ResponseProps)
                const successResult = createImageResult as CreateAssistantImageResponse;
                const { signedUrl, filePath: returnedFilePath, bucketName: returnedBucketName } = successResult;
            
                bucketName = returnedBucketName;
                uploadedFilePath = returnedFilePath;
            
                const uploadSuccess = await uploadImageToGCS(imageFile, signedUrl);

            } else if (data.imagePreview && !data.imagePreview.startsWith('blob:')) {
                finalImageUrlToSend = data.imagePreview;
            } else {

            }

            if (!finalImageUrlToSend) {
                toast.error("Profile photo is required. Please upload one or select a preset.", { id: toastId });
                setIsSubmitting(false);
                return;
            }

            // 3. Prepare data
            const ageNumber = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;

            // 4. Call createAssistant action
            const result = await hireActions.create(
                data.firstName,
                data.lastName,
                ageNumber,
                data.region,
                finalImageUrlToSend,
                data.about
            );

            // 5. Handle response
             if (result && 'agent_id' in result && result.agent_id) {
                toast.success(`Assistant ${result.first_name || data.firstName} hired!`, { id: toastId, duration: 4000 });
                reset();
                handleImageRemove();
            } else {
                const errorResult = result as ResponseProps;
                const errorMessage = errorResult?.detail || errorResult?.message || errorResult?.error || "Failed to hire assistant.";
                toast.error(errorMessage, { id: toastId, duration: 5000 });
            }


        } catch (error: any) {
             toast.error(`An error occurred: ${error.message}`, { id: toastId, duration: 5000 });
        } finally {
            setIsSubmitting(false);
        }
    }; 

    const handleTogglePresets = () => {
        setIsPresetsOpen(prev => !prev);
    };

    const handleClosePresets = () => {
        setIsPresetsOpen(false);
    }

    const handlePresetSelect = (preset: HirePreset) => {
        handleImageRemove();
        setValue("firstName", preset.first_name, { shouldValidate: true });
        setValue("lastName", preset.last_name, { shouldValidate: true });
        setValue("age", preset.age, { shouldValidate: true });
        setValue("region", preset.region, { shouldValidate: true });
        setValue("about", preset.about, { shouldValidate: true });
        setValue("imagePreview", preset.image_url);
        clearErrors();
    };

    const handleImageRemove = () => {
        const currentPreview = getValues("imagePreview");
        if (currentPreview && currentPreview.startsWith('blob:')) {
            URL.revokeObjectURL(currentPreview);
        }
        setValue("imageFile", null);
        setValue("imagePreview", null);
    }

    return (
        <>
        <Toaster richColors position="bottom-right" />
        <div className="flex h-full w-full overflow-hidden">
            {/* Hire Form Container */}
            <div className="flex-1 h-full min-w-0 relative">
                <Button
                    variant="outline"
                    size="icon"
                    className="absolute top-4 right-4 z-10 w-8 h-8"
                    onClick={handleTogglePresets}
                    aria-label="Toggle available hires"
                    disabled={isSubmitting}
                >
                    <LayoutList className="h-4 w-4" />
                </Button>
                <HireForm
                    formMethods={formMethods}
                    onSubmit={handleFormSubmit}
                    onImageRemove={handleImageRemove}
                    isSubmitting={isSubmitting}
                />
            </div>

            {/* Presets Panel */}
            <AnimatePresence initial={false}>
                {isPresetsOpen && (
                    <motion.div
                        key="presets-panel"
                        initial={{ width: "0%", opacity: 0, x: "0%" }}
                        animate={{ width: "50%", opacity: 1, x: "0%" }}
                        exit={{ width: "0%", opacity: 0, x: "0%" }}
                        transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                        className="h-full flex-shrink-0 border-l overflow-hidden bg-background"
                    >
                        <PresetsPanel
                            presets={sampledPresets}
                            onPresetSelect={handlePresetSelect}
                            onClose={handleClosePresets}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
        </>
    );
}