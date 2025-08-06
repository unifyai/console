import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { MessageSquare, Phone, Mail, Contact, History } from "lucide-react";
import { WhatsApp } from '@mui/icons-material';
import { cn } from "@/lib/utils";
import type { Assistant, AssistantStatus } from "@/types/assistants/assistant";
import ActionButton from '../../../../Common/Buttons/Action';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/UI/hover-card";

interface AssistantListItemProps {
    assistant: Assistant;
    isSelected: boolean;
    onShowProfile: (id: string) => void;
    onShowActivityLog: (id: string) => void;
    isFolded: boolean;
}

export function AssistantListItem({
    assistant,
    isSelected,
    onShowProfile,
    onShowActivityLog,
    isFolded,
}: AssistantListItemProps) {

    const handleProfileClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onShowProfile(assistant.agent_id);
    }

    const handleActivityLogClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onShowActivityLog(assistant.agent_id);
    }

    const displayName = `${assistant.first_name} ${assistant.surname}`;
    const photoSrc = assistant.signedProfilePhotoUrl || assistant.profile_photo;
    const isOnline = true;

    if (isFolded) {
        return (
            <HoverCard openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                    <div
                        className={cn(
                            "relative cursor-pointer rounded-full",
                            isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                        onClick={handleProfileClick}
                    >
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={photoSrc ?? undefined} alt={displayName} />
                            <AvatarFallback>{`${assistant.first_name?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {status !== undefined && (
                            <span
                                className={cn(
                                    "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background",
                                    isOnline ? "bg-green-500" : "bg-gray-400"
                                )}
                            />
                        )}
                    </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80" side="right" align="start">
                     <div className="flex justify-between space-x-4">
                         <Avatar>
                             <AvatarImage src={photoSrc ?? undefined} />
                             <AvatarFallback>{`${assistant.first_name?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}</AvatarFallback>
                         </Avatar>
                         <div className="space-y-1 flex-1">
                             <h4 className="text-sm font-semibold">{displayName}</h4>
                             <div className="flex items-center pt-1 text-xs text-muted-foreground">
                                 <Mail className="mr-2 h-4 w-4 opacity-70" />{" "}
                                 <a href={`mailto:${assistant.email}`} className="truncate hover:underline">
                                     {assistant.email}
                                 </a>
                             </div>
                             <div className="flex items-center pt-1 text-xs text-muted-foreground">
                                 <Phone className="mr-2 h-4 w-4 opacity-70" />{" "}
                                 <span className="truncate">{assistant.phone}</span>
                             </div>
                             {assistant.assistant_whatsapp_number && (
                                 <div className="flex items-center pt-1 text-xs text-muted-foreground">
                                     <WhatsApp className="mr-2 h-4 w-4 opacity-70" />{" "}
                                     <span className="truncate">{assistant.assistant_whatsapp_number}</span>
                                 </div>
                             )}
                         </div>
                     </div>
                </HoverCardContent>
            </HoverCard>
        );
    }

    return (
        <div
            className={cn(
                "flex items-center justify-between p-2 rounded-md group cursor-pointer",
                !isSelected && "hover:bg-muted",
                isSelected && "bg-primary text-primary-foreground"
            )}
            onClick={handleProfileClick}
        >
            <div className="flex items-center gap-3 min-w-0">
                <HoverCard openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                        <div className="relative">
                            <Avatar className="h-8 w-8 cursor-default flex-shrink-0">
                                <AvatarImage src={photoSrc ?? undefined} alt={displayName} />
                                <AvatarFallback>{`${assistant.first_name?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            {status !== undefined && (
                                <span
                                    className={cn(
                                        "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background",
                                        isOnline ? "bg-green-500" : "bg-gray-400"
                                    )}
                                />
                            )}
                        </div>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" side="right" align="start">
                         <div className="flex justify-between space-x-4">
                             <Avatar>
                                 <AvatarImage src={photoSrc ?? undefined} />
                                 <AvatarFallback>{`${assistant.first_name?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}</AvatarFallback>
                             </Avatar>
                             <div className="space-y-1 flex-1">
                                 <h4 className="text-sm font-semibold">{displayName}</h4>
                                 <div className="flex items-center pt-1 text-xs text-muted-foreground">
                                     <Mail className="mr-2 h-4 w-4 opacity-70" />{" "}
                                     <a href={`mailto:${assistant.email}`} className="truncate hover:underline">
                                         {assistant.email}
                                     </a>
                                 </div>
                                 <div className="flex items-center pt-1 text-xs text-muted-foreground">
                                     <Phone className="mr-2 h-4 w-4 opacity-70" />{" "}
                                     <span className="truncate">{assistant.phone}</span>
                                 </div>
                                 {assistant.assistant_whatsapp_number && (
                                     <div className="flex items-center pt-1 text-xs text-muted-foreground">
                                         <WhatsApp className="mr-2 h-4 w-4 opacity-70" />{" "}
                                         <span className="truncate">{assistant.assistant_whatsapp_number}</span>
                                     </div>
                                 )}
                             </div>
                         </div>
                    </HoverCardContent>
                </HoverCard>
                <span className="text-sm font-medium truncate">{displayName}</span>
            </div>
        </div>
    );
}