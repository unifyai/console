import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { Button } from "@/components/UI/button";
import { Label } from "@/components/UI/label";
import { Separator } from "@/components/UI/separator";
import { Mail, Phone, X, Trash2, Loader2, AlertTriangle, PenLine } from "lucide-react";
import { WhatsApp } from '@mui/icons-material';
import type { Assistant } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/UI/scroll-area';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/UI/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import Markdown from 'react-markdown';
import { Dialog, DialogContent } from '@/components/UI/dialog';
import { AssistantPhotoViewer } from './Hire/AssistantHirePhotoPreview';

interface AssistantProfilePanelProps {
    assistant: Assistant;
    onClose: () => void;
    onDeleteAssistant: (assistant: Assistant) => Promise<void>;
    onEdit: (assistant: Assistant) => void;
}

export function AssistantProfilePanel({
    assistant,
    onClose,
    onDeleteAssistant,
    onEdit,
}: AssistantProfilePanelProps) {
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isAlertOpen, setIsAlertOpen] = React.useState(false);
    const [isVideoDialogOpen, setIsVideoDialogOpen] = React.useState(false);

    const handleDeleteConfirm = async () => {
        if (!assistant || isDeleting) return;

        setIsDeleting(true);
        try {
            await onDeleteAssistant(assistant);
            setIsAlertOpen(false);
        } catch (error) {
             console.error("Error occurred during delete confirmation (handled by parent):", error);
             setIsAlertOpen(false);
        } finally {
             setIsDeleting(false);
        }
    };

    if (!assistant) return null;

    const photoSrc = assistant.signedProfilePhotoUrl || (assistant.profile_photo ?? undefined);
    const videoSrc = assistant.signedProfileVideoUrl || (assistant.profile_video ?? undefined);
    const displayName = `${assistant.first_name} ${assistant.surname}`;

    return (
        <>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <div className="h-full flex flex-col w-full bg-background">
                    {/* Header */}
                    <div className="px-4 py-3.5 sm:px-6 sm:py-3.5 border-b flex-shrink-0">
                        <div className='flex items-center justify-between'>
                            <h2 className="text-lg font-semibold">{`${displayName}'s profile`}</h2>
                            <div className="flex items-center gap-1">
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(assistant)}>
                                                <PenLine className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" align="end" className="max-w-xs text-sm">
                                            <p>Edit Assistant</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" align="end" className="max-w-xs text-sm">
                                            <p>Close Profile</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="py-4 sm:py-6 space-y-6">
                            {/* Basic Info */}
                            <div className="flex items-start gap-4 sm:gap-6 px-4 sm:px-6">
                                <AssistantPhotoViewer
                                    previewUrl={photoSrc}
                                    videoUrl={videoSrc}
                                    isPlayable={true}
                                    onClick={() => {
                                        if (videoSrc) setIsVideoDialogOpen(true);
                                    }}
                                    className="flex-shrink-0"
                                    avatarClassName="h-16 w-16 sm:h-20 sm:w-20"
                                    fallbackText={`${assistant.first_name?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
                                />
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm flex-1">
                                    <Label className="text-muted-foreground">First Name</Label>
                                    <span>{assistant.first_name}</span>
                                    <Label className="text-muted-foreground">Last Name</Label>
                                    <span>{assistant.surname}</span>
                                    <Label className="text-muted-foreground">Age</Label>
                                    <span>{assistant.age ?? 'N/A'}</span>
                                    <Label className="text-muted-foreground">Region</Label>
                                    <span>{assistant.region ?? 'N/A'}</span>
                                </div>
                            </div>

                            <Separator />

                            {/* About Section */}
                            <div className="px-4 sm:px-6 space-y-2 group">
                                <Label className="text-base font-semibold">About Me</Label>
                                <div className="text-sm text-muted-foreground prose prose-sm max-w-none prose-p:my-1">
                                    <Markdown>{assistant.about || "No description provided."}</Markdown>
                                </div>
                            </div>

                            <Separator />

                            {/* Assistant Contact Section */}
                            <div className="px-4 sm:px-6 space-y-3 group/assistant-contact">
                                <h3 className="text-base font-semibold">My Contact</h3>
                                <div className="space-y-4 text-sm">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate">{assistant.email || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span>{assistant.phone || 'N/A'}</span>
                                    </div>
                                    {assistant.assistant_whatsapp_number && (
                                        <div className="flex items-center gap-3">
                                            <WhatsApp className="h-4 w-4 text-muted-foreground" />
                                            <span>{assistant.assistant_whatsapp_number}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer Action Buttons */}
                    <div className="px-4 py-3 sm:px-6 sm:py-4 border-t flex justify-end items-center flex-shrink-0">
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" size="sm" disabled={isDeleting}>
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                End contract
                            </Button>
                        </AlertDialogTrigger>
                    </div>
                </div>

                {/* Alert Dialog Content */}
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center">
                            <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
                            Confirm End Contract
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to remove <strong>{displayName}</strong> from your team. This action cannot be undone. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className={cn(
                                "bg-destructive hover:bg-destructive/90",
                                isDeleting && "cursor-not-allowed opacity-70"
                            )}
                        >
                            {isDeleting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Proceed
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
                <DialogContent className="max-w-4xl w-auto p-0 bg-black border-0">
                    <video src={videoSrc} controls autoPlay className="w-full h-auto max-h-[90vh] rounded-lg" />
                </DialogContent>
            </Dialog>
        </>
    );
}