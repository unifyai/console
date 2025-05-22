
import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AssistantFormData, AssistantPreset, AssistantActions } from '@/types/team/assistant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { LayoutList, Loader2, Shuffle } from 'lucide-react';
import { PresetsPanelProps } from '@/components/Team/Assistants/Hire/Presets/AssistantHirePresetsList';
import { HireFormProps } from '@/components/Team/Assistants/Hire/AssistantHireForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

interface AssistantHireProps extends Partial<PresetsPanelProps>, Partial<HireFormProps> {
    isHireDialogOpen: boolean;
    isHireSubmitting: boolean;
    setIsHireDialogOpen: (value: React.SetStateAction<boolean>) => void;
    isAssistantPresetsOpen: boolean;
    setIsAssistantPresetsOpen: (value: React.SetStateAction<boolean>) => void;
    handleRandomizePreset: () => void;
    currentFilteredPresets: AssistantPreset[];
    handleHireFormSubmitInternal: (e?: React.BaseSyntheticEvent<object, any, any>) => Promise<void>;
    children: React.ReactNode;
}

export function AssistantHire ({
    isHireDialogOpen,
    isHireSubmitting,
    setIsHireDialogOpen,
    isAssistantPresetsOpen,
    setIsAssistantPresetsOpen,
    handleRandomizePreset,
    currentFilteredPresets,
    handleHireFormSubmitInternal,
    children
}: AssistantHireProps) {
    const [hireForm, presetsPanel] = React.Children.toArray(children);

    return (
        <Dialog open={isHireDialogOpen} onOpenChange={(open) => { if (!isHireSubmitting) setIsHireDialogOpen(open); }}>
            <DialogContent className={cn("max-w-4xl h-[85vh] flex flex-col p-0 gap-0", isAssistantPresetsOpen && "max-w-6xl")} onInteractOutside={(e) => { if (isHireSubmitting) e.preventDefault(); }}>
                <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                    <DialogTitle>Hire Assistant</DialogTitle>
                    <DialogDescription>Hire an existing assistant or create your own.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Hire Form Section */}
                    <div className={cn("flex-1 h-full min-w-0 relative transition-all duration-300 ease-in-out", "pl-6 pr-14 py-4 overflow-y-auto")}>
                        <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
                            <TooltipProvider delayDuration={100}>
                                <Tooltip><TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setIsAssistantPresetsOpen(prev => !prev)} disabled={isHireSubmitting}>
                                        <LayoutList className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{isAssistantPresetsOpen ? "Hide Presets" : "Show Presets"}</p></TooltipContent></Tooltip>
                            </TooltipProvider>
                            <TooltipProvider delayDuration={100}>
                                <Tooltip><TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className="w-8 h-8" onClick={handleRandomizePreset} disabled={isHireSubmitting || currentFilteredPresets.length === 0}>
                                        <Shuffle className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{"Randomize from Presets"}</p></TooltipContent></Tooltip>
                            </TooltipProvider>
                        </div>
                        {hireForm}
                    </div>

                    {/* Presets Panel Section */}
                    {isAssistantPresetsOpen && (
                        <motion.div
                            key="hire-presets-panel"
                            initial={{ width: "0%", opacity: 0 }}
                            animate={{ width: "40%", opacity: 1 }}
                            exit={{ width: "0%", opacity: 0 }}
                            transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }}
                            className="h-full flex-shrink-0 overflow-hidden bg-background"
                        >
                            {presetsPanel}
                        </motion.div>
                    )}
                </div>

                <DialogFooter className="px-6 py-3 border-t flex-shrink-0">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isHireSubmitting}>Cancel</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleHireFormSubmitInternal} className="bg-green-600 hover:bg-green-700 text-white" disabled={isHireSubmitting}>
                        {isHireSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Hiring...</>) : "Hire Assistant"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
