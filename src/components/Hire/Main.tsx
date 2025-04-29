'use client';

import * as React from 'react';
import { useForm } from "react-hook-form";
import type { PersonaFormData, HirePreset } from '@/types/assistants/hire';
import { HireForm } from './HireForm';
import { PresetsPanel } from './PresetsPanel';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/UI/button';
import { LayoutList } from 'lucide-react';
import assistantPresets from "@/constants/assistants/assistant_presets";

// Helper function to shuffle an array (Fisher-Yates algorithm)
const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]; // Create a copy to avoid mutating the original
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export default function Main() {
  const [isPresetsOpen, setIsPresetsOpen] = React.useState(true); // State for animation trigger
  const [sampledPresets, setSampledPresets] = React.useState<HirePreset[]>([]);

  const formMethods = useForm<PersonaFormData>({ defaultValues: { /* Initialize defaults if any */ } });
  const { setValue, watch, reset } = formMethods; // Added reset

  // Sample presets on component mount
  React.useEffect(() => {
    const shuffled = shuffleArray(assistantPresets as HirePreset[]);
    setSampledPresets(shuffled.slice(0, 10));
  }, []); // Empty dependency array ensures this runs only once on mount

  // Clean up preview URL effect
  React.useEffect(() => {
    const subscription = watch((value, { name }) => {
      // Clean up old blob URL if avatarFile changes and preview exists
      if (name === 'avatarFile' && value.avatarPreview?.startsWith('blob:')) {
        // This cleanup logic seems redundant with handleImageRemove and handleFileChange
        // Keep an eye if issues arise, might need refinement.
      }
    });
    // Cleanup function for the watcher
    return () => subscription.unsubscribe();
  }, [watch]);


  const handleFormSubmit = (data: PersonaFormData) => {
      console.log("Hiring Assistant with data:", data);
      // TODO: Implement actual API call using createAssistant action
      // 1. Handle image upload (if data.avatarFile exists) to get a URL
      // 2. Call createAssistant action with the form data and image URL
      // 3. Handle response (success/error), maybe show toast notification
      // 4. Potentially reset form or navigate away on success
      alert(`Hiring ${data.firstName} (implementation pending)`);
      // Example reset after submission:
      // reset({ // Reset form to initial state or specific values
      //   firstName: '', lastName: '', age: '', region: '', about: '', avatarFile: null, avatarPreview: null
      // });
  };

  // Toggles the preset panel state
  const handleTogglePresets = () => {
    setIsPresetsOpen(prev => !prev);
  };

  // Handler specifically for closing (used by the panel's close button)
  const handleClosePresets = () => {
      setIsPresetsOpen(false);
  }

  const handlePresetSelect = (preset: HirePreset) => {
    setValue("firstName", preset.first_name);
    setValue("lastName", preset.last_name);
    setValue("age", preset.age);
    setValue("region", preset.region);
    setValue("about", preset.about);
    // Clear any existing file and revoke old blob URL if necessary
    handleImageRemove(); // Use existing remove logic to clean up
    setValue("avatarPreview", preset.image_url); // Set preset image URL
  };

  // Handler for removing the uploaded/previewed image
  const handleImageRemove = () => {
      const currentPreview = watch("avatarPreview");
      if (currentPreview && currentPreview.startsWith('blob:')) { // Only revoke blob URLs
         URL.revokeObjectURL(currentPreview);
      }
      setValue("avatarFile", null);
      setValue("avatarPreview", null);
      // Resetting the file input value is handled within ImageUpload component
  }

  return (
    // Use flex for the main layout container
    <div className="flex h-full w-full overflow-hidden">

        {/* Hire Form Container (Takes remaining space or full width initially) */}
        <div className="flex-1 h-full min-w-0 relative"> {/* Added relative */}
             {/* Button positioned top-right relative to this container */}
             <Button
                variant="outline"
                size="icon"
                className="absolute top-4 right-4 z-10 w-8 h-8" // Position top-right
                onClick={handleTogglePresets}
                aria-label="Toggle available hires"
             >
                <LayoutList className="h-4 w-4" />
             </Button>
             {/* HireForm now manages its own scrolling */}
            <HireForm
                formMethods={formMethods}
                onSubmit={handleFormSubmit}
                onImageRemove={handleImageRemove}
            />
        </div>

        {/* Presets Panel (Animated Div) */}
        <AnimatePresence initial={false}>
            {isPresetsOpen && (
                <motion.div
                    key="presets-panel"
                    initial={{ width: "0%", opacity: 0, x: "0%" }} // Start collapsed
                    animate={{ width: "50%", opacity: 1, x: "0%" }}
                    exit={{ width: "0%", opacity: 0, x: "0%" }}
                    transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                    className="h-full flex-shrink-0 border-l overflow-hidden bg-background" // Add border-l
                 >
                    {/* Render panel content only when needed */}
                    <PresetsPanel
                        presets={sampledPresets} // Use sampled presets
                        onPresetSelect={handlePresetSelect}
                        onClose={handleClosePresets} // Pass close handler
                    />
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}