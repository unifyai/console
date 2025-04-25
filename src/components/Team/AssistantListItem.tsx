import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { MessageSquare, Phone, Mail, Contact } from "lucide-react"; // Use Contact icon for ID Card
import { cn } from "@/lib/utils";
import type { Assistant } from "@/types/team/assistant";
import ActionButton from '../Common/Buttons/Action';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/UI/hover-card";

interface AssistantListItemProps {
    assistant: Assistant;
    isSelected: boolean; // Now indicates if profile is open for this user
    onShowProfile: (id: string) => void; // Renamed from onSelect
    onChat: (id: string) => void;
}

export function AssistantListItem({
    assistant,
    isSelected,
    onShowProfile,
    onChat,
}: AssistantListItemProps) {

    const handleChatClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChat(assistant.id);
    };

    const handleProfileClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent potential parent handlers
        onShowProfile(assistant.id);
    }

    const displayName = `${assistant.firstName} ${assistant.lastName}`;

    return (
        <div
            className={cn(
                "flex items-center justify-between p-2 rounded-md group",
                !isSelected && "hover:bg-muted",
                isSelected && "bg-primary text-primary-foreground"
            )}
        >
            <div className="flex items-center gap-3 min-w-0">
                <HoverCard openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                        <Avatar className="h-8 w-8 cursor-default flex-shrink-0">
                            <AvatarImage src={assistant.avatarUrl} alt={displayName} />
                            <AvatarFallback>{`${assistant.firstName?.[0] ?? ''}${assistant.lastName?.[0] ?? ''}`.toUpperCase()}</AvatarFallback>
                        </Avatar>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" side="right" align="start">
                        {/* Hover card content... (Shows basic contact) */}
                         <div className="flex justify-between space-x-4">
                             <Avatar>
                                 <AvatarImage src={assistant.avatarUrl} />
                                 <AvatarFallback>{`${assistant.firstName?.[0] ?? ''}${assistant.lastName?.[0] ?? ''}`.toUpperCase()}</AvatarFallback>
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
                             </div>
                         </div>
                    </HoverCardContent>
                </HoverCard>
                <span className="text-sm font-medium truncate">{displayName}</span>
            </div>

            {/* Icons always visible or on hover? Let's make them visible on hover/selection */}
            <div className={cn(
                "flex items-center gap-1 transition-opacity flex-shrink-0",
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
                <ActionButton
                    tooltip="Chat with assistant"
                    icon={<MessageSquare className="h-4 w-4" />}
                    onClick={handleChatClick}
                    size="sm"
                />
                <ActionButton
                    tooltip="View Profile" // Updated tooltip
                    icon={<Contact className="h-4 w-4" />} // Changed icon
                    onClick={handleProfileClick} // Changed handler
                    size="sm"
                />
            </div>
        </div>
    );
}