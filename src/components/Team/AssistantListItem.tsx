import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { MessageSquare, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assistant } from "@/types/team/assistant";
import ActionButton from '../Common/Buttons/Action';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/UI/hover-card";

interface AssistantListItemProps {
    assistant: Assistant;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onChat: (id: string) => void;
}

export function AssistantListItem({
    assistant,
    isSelected,
    onSelect,
    onChat,
}: AssistantListItemProps) {
    const handleSelect = () => {
        onSelect(assistant.id);
    };

    const handleChatClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChat(assistant.id);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log("Delete Assistant:", assistant.id);
        alert(`Delete assistant ${assistant.name}? (Placeholder)`);
    }

    return (
        <div
            className={cn(
                "flex items-center justify-between p-2 rounded-md group cursor-pointer",
                !isSelected && "hover:bg-muted",
                isSelected && "bg-primary text-primary-foreground"
            )}
            onClick={handleSelect}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleSelect()}
        >
            <div className="flex items-center gap-3 min-w-0">
                <HoverCard openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                        <Avatar className="h-8 w-8 cursor-default flex-shrink-0">
                            <AvatarImage src={assistant.avatarUrl} alt={assistant.name} />
                            <AvatarFallback>{assistant.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" side="right" align="start">
                        {/* Hover card content... */}
                        <div className="flex justify-between space-x-4">
                             <Avatar>
                                 <AvatarImage src={assistant.avatarUrl} />
                                 <AvatarFallback>{assistant.name.substring(0,2).toUpperCase()}</AvatarFallback>
                             </Avatar>
                             <div className="space-y-1 flex-1">
                                 <h4 className="text-sm font-semibold">{assistant.name}</h4>
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
                <span className="text-sm font-medium truncate">{assistant.name}</span>
            </div>

            {/* Icons visible on hover or when selected */}
            <div className={cn(
                "flex items-center gap-1 transition-opacity flex-shrink-0",-
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
                <ActionButton
                    tooltip="Chat with assistant"
                    icon={<MessageSquare className="h-4 w-4" />}
                    onClick={handleChatClick}
                    size="sm"
                 />
                <ActionButton
                    tooltip="Delete assistant"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={handleDeleteClick}
                    size="sm"
                    variant='warning'
                />
            </div>
        </div>
    );
}