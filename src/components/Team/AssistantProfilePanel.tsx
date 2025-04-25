import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { Button } from "@/components/UI/button";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { Separator } from "@/components/UI/separator";
import { Mail, Phone, Linkedin, Save, Undo2, X } from "lucide-react"; // Keep X for close
import type { Assistant } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import ActionButton from '../Common/Buttons/Action';
import { ScrollArea } from '@/components/UI/scroll-area';

interface AssistantProfilePanelProps {
    assistant: Assistant; // Assume non-null when rendered
    onClose: () => void; // Renamed from onOpenChange
    // onUpdateProfile: (id: string, updates: Partial<Assistant>) => void;
}

export function AssistantProfilePanel({
    assistant,
    onClose,
}: AssistantProfilePanelProps) {  

    const [about, setAbout] = React.useState(assistant?.about || '');
    const [skills, setSkills] = React.useState(assistant?.skills || '');
    const [isEditingAbout, setIsEditingAbout] = React.useState(false);
    const [isEditingSkills, setIsEditingSkills] = React.useState(false);

    const originalAbout = React.useRef(assistant?.about || '');
    const originalSkills = React.useRef(assistant?.skills || '');

    // Update state if the assistant prop changes
    React.useEffect(() => {
        if (assistant) {
        setAbout(assistant.about);
        setSkills(assistant.skills);
        originalAbout.current = assistant.about;
        originalSkills.current = assistant.skills;
        setIsEditingAbout(false); // Reset edit state on assistant change
        setIsEditingSkills(false);
        } else {
            // Clear state if assistant becomes null (panel closes/no selection)
            setAbout('');
            setSkills('');
            setIsEditingAbout(false);
            setIsEditingSkills(false);
        }
    }, [assistant]);

    const handleSaveAbout = () => {
        console.log("Saving About for:", assistant?.id, "New About:", about);
        alert("Save About changes? (Placeholder)");
        originalAbout.current = about;
        // Call onUpdateProfile(assistant.id, { about }) here
        setIsEditingAbout(false);
    };

    const handleDiscardAbout = () => {
        setAbout(originalAbout.current);
        setIsEditingAbout(false);
    };

    const handleSaveSkills = () => {
        console.log("Saving Skills for:", assistant?.id, "New Skills:", skills);
        alert("Save Skills changes? (Placeholder)");
        originalSkills.current = skills;
        // Call onUpdateProfile(assistant.id, { skills }) here
        setIsEditingSkills(false);
    };

    const handleDiscardSkills = () => {
        setSkills(originalSkills.current);
        setIsEditingSkills(false);
    };


    if (!assistant) return null; // Don't render anything if no assistant data

    return (

        <div className="h-full flex flex-col w-full bg-background">
            {/* Manual Header */}
            <div className="px-4 py-3.5 sm:px-6 sm:py-3.5 border-b flex-shrink-0">
                <div className='flex items-center justify-between'>
                    <h2 className="text-lg font-semibold">{`${assistant.firstName} ${assistant.lastName}'s profile`}</h2> {/* Changed to h2 */}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close Profile</span>
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="py-4 sm:py-6 space-y-6">
                    {/* Basic Info */}
                    <div className="flex items-start gap-4 sm:gap-6 px-4 sm:px-4">
                        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border">
                            <AvatarImage src={assistant.avatarUrl} alt={`${assistant.firstName} ${assistant.lastName}`} />
                            <AvatarFallback className="text-xl">
                                {`${assistant.firstName?.[0] ?? ''}${assistant.lastName?.[0] ?? ''}`.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm flex-1">
                            <Label className="text-muted-foreground">First Name</Label>
                            <span>{assistant.firstName}</span>
                            <Label className="text-muted-foreground">Last Name</Label>
                            <span>{assistant.lastName}</span>
                            <Label className="text-muted-foreground">Age</Label>
                            <span>{assistant.age ?? 'N/A'}</span>
                            <Label className="text-muted-foreground">Region</Label>
                            <span>{assistant.region ?? 'N/A'}</span>
                        </div>
                    </div>

                    <Separator />

                    {/* About Section */}
                    <div className="px-4 sm:px-4 space-y-2 relative group">
                        <Label htmlFor={`about-${assistant.id}`} className="text-base font-semibold">About</Label>
                        <Textarea
                            id={`about-${assistant.id}`}
                            value={about}
                            onChange={(e) => { setAbout(e.target.value); setIsEditingAbout(true); }}
                            placeholder="Enter details about the assistant..."
                            className={cn(
                                "text-sm min-h-[100px] resize-none",
                                isEditingAbout ? "border-primary focus-visible:ring-primary/50" : "border-transparent bg-transparent focus-visible:bg-background focus-visible:border-input focus-visible:ring-input"
                            )}
                            rows={4}
                        />
                        {isEditingAbout && (
                            <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <ActionButton tooltip="Save About" icon={<Save className="h-4 w-4 text-green-600"/>} onClick={handleSaveAbout} variant="ghost" size="sm" className="hover:bg-green-100"/>
                                <ActionButton tooltip="Discard About" icon={<Undo2 className="h-4 w-4 text-amber-600"/>} onClick={handleDiscardAbout} variant="ghost" size="sm" className="hover:bg-amber-100"/>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Skills Section */}
                    <div className="px-4 sm:px-4 space-y-2 relative group">
                        <Label htmlFor={`skills-${assistant.id}`} className="text-base font-semibold">Skills</Label>
                        <Textarea
                            id={`skills-${assistant.id}`}
                            value={skills}
                            onChange={(e) => { setSkills(e.target.value); setIsEditingSkills(true); }}
                            placeholder="List assistant's skills..."
                            className={cn(
                                "text-sm min-h-[100px] resize-none",
                                isEditingSkills ? "border-primary focus-visible:ring-primary/50" : "border-transparent bg-transparent focus-visible:bg-background focus-visible:border-input focus-visible:ring-input"
                            )}
                            rows={4}
                        />
                        {isEditingSkills && (
                            <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <ActionButton tooltip="Save Skills" icon={<Save className="h-4 w-4 text-green-600"/>} onClick={handleSaveSkills} variant="ghost" size="sm" className="hover:bg-green-100"/>
                                <ActionButton tooltip="Discard Skills" icon={<Undo2 className="h-4 w-4 text-amber-600"/>} onClick={handleDiscardSkills} variant="ghost" size="sm" className="hover:bg-amber-100"/>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Contact Section */}
                    <div className="px-4 sm:px-4 space-y-3">
                        <h3 className="text-base font-semibold">Contact</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <a href={`mailto:${assistant.email}`} className="hover:underline text-primary truncate">
                                    {assistant.email}
                                </a>
                            </div>
                            <div className="flex items-center gap-3">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{assistant.phone}</span>
                            </div>
                            {assistant.linkedinUrl && (
                                <div className="flex items-center gap-3">
                                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                                    <a href={assistant.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary truncate">
                                        LinkedIn Profile
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>

  );
}