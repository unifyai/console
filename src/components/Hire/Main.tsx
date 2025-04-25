'use client';

import * as React from 'react';
import { useForm } from "react-hook-form";
import type { PersonaFormData, HirePreset } from '@/types/assistants/hire';
import { HireForm } from './HireForm';
import { PresetsPanel } from './PresetsPanel';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/UI/button';
import { LayoutList } from 'lucide-react';

/* Placeholder data */
import { faker } from '@faker-js/faker';


export function createRandomHirePreset(): HirePreset {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
        id: faker.string.uuid(),
        firstName: firstName,
        lastName: lastName,
        age: faker.number.int({ min: 22, max: 55 }),
        region: faker.location.countryCode('alpha-2'),
        about: `I am a dedicated and results-driven professional with over ${faker.number.int({min: 3, max: 10})} years of experience in fast-paced environments. ` + faker.lorem.paragraph(),
        avatarUrl: faker.image.avatarGitHub(), // Using github avatars for presets
    };
}

export function generateHirePresets(count: number = 10): HirePreset[] {
    return faker.helpers.multiple(createRandomHirePreset, { count });
}

const hirePresets = generateHirePresets(12);
/* End placeholder data */


export default function Main() {
  const [isPresetsOpen, setIsPresetsOpen] = React.useState(true); // State for animation trigger

  const formMethods = useForm<PersonaFormData>({ defaultValues: { /* ... */ } });
  const { setValue, watch } = formMethods;

  // Clean up preview URL effect
  React.useEffect(() => { /* ... */ }, [watch]);

  const handleFormSubmit = (data: PersonaFormData) => { /* ... */ };

  // Toggles the preset panel state
  const handleTogglePresets = () => {
    setIsPresetsOpen(prev => !prev);
  };

  // Handler specifically for closing (used by the panel's close button)
  const handleClosePresets = () => {
      setIsPresetsOpen(false);
  }

  const handlePresetSelect = (preset: HirePreset) => {
    // ... (preset selection logic using setValue - unchanged) ...
    setValue("firstName", preset.firstName);
    setValue("lastName", preset.lastName);
    setValue("age", preset.age);
    setValue("region", preset.region);
    setValue("about", preset.about);
    setValue("avatarFile", null);
    const currentPreview = watch("avatarPreview");
    if (currentPreview && currentPreview.startsWith('blob:')) URL.revokeObjectURL(currentPreview);
    setValue("avatarPreview", preset.avatarUrl);
  };

  // Handler for removing the uploaded/previewed image
  const handleImageRemove = () => {
      const currentPreview = watch("avatarPreview");
      if (currentPreview && currentPreview.startsWith('blob:')) { // Only revoke blob URLs
         URL.revokeObjectURL(currentPreview);
      }
      setValue("avatarFile", null);
      setValue("avatarPreview", null);
      // Also reset the file input visually if needed (already done in ImageUpload)
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
             {/* Use a ScrollArea if HireForm content might exceed viewport height */}
             {/* <ScrollArea className="h-full"> */}
                <HireForm
                    formMethods={formMethods}
                    onSubmit={handleFormSubmit}
                    onImageRemove={handleImageRemove} // Pass down remove handler
                    // onOpenPresets removed
                />
            {/* </ScrollArea> */}
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
                        presets={hirePresets}
                        onPresetSelect={handlePresetSelect}
                        onClose={handleClosePresets} // Pass close handler
                    />
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}