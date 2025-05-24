import * as React from 'react';
import { MessageLog, MessageMedium } from '@/types/team/activity';
import { Mail, MessageSquare, Phone, PhoneCall, Send, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

interface ActivityLogItemProps {
    item: MessageLog;
}

const getMediumIcon = (medium: MessageMedium): React.ReactElement => {
    const iconProps = { className: "h-4 w-4 text-muted-foreground flex-shrink-0" };
    switch (medium) {
        case MessageMedium.SMS_MESSAGE: return <MessageSquare {...iconProps} />;
        case MessageMedium.EMAIL: return <Mail {...iconProps} />;
        case MessageMedium.WHATSAPP_MSG: return <Send {...iconProps} />; // Using Send for WhatsApp
        case MessageMedium.PHONE_CALL: return <Phone {...iconProps} />;
        case MessageMedium.WHATSAPP_CALL: return <PhoneCall {...iconProps} />;
        default: return <AlertCircle {...iconProps} />; // Fallback icon
    }
};

export function ActivityLogItem({ item }: ActivityLogItemProps) {
    const formattedTimestamp = React.useMemo(() => {
        try {
            return formatDistanceToNowStrict(new Date(item.timestamp), { addSuffix: true });
        } catch (e) {
            return item.timestamp; // Fallback to raw timestamp
        }
    }, [item.timestamp]);
    return (
        <div className="flex items-start gap-3 py-2.5 pr-1">
            {getMediumIcon(item.medium)}
            <div className="flex-1 space-y-0.5 min-w-0">
                <div className="flex justify-between items-baseline text-xs">
                     <TooltipProvider delayDuration={100}>
                        <Tooltip><TooltipTrigger asChild>
                            <p className="font-medium text-foreground truncate">
                                {item.senderName} &rarr; {item.receiverName}
                            </p>
                        </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{`${item.medium.replace("_", " ")} from ${item.senderName} to ${item.receiverName}`}</p></TooltipContent></Tooltip>
                    </TooltipProvider>
                     <TooltipProvider delayDuration={100}>
                        <Tooltip><TooltipTrigger asChild>
                            <p className="text-muted-foreground whitespace-nowrap ml-2">
                                {formattedTimestamp}
                            </p>
                        </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{new Date(item.timestamp).toLocaleString()}</p></TooltipContent></Tooltip>
                    </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground break-words">
                    {item.content}
                </p>
            </div>
        </div>
    );
}