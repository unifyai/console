import * as React from 'react';
import { WhatsApp, Facebook, Instagram, LinkedIn, Twitter, GitHub } from '@mui/icons-material';
import { 
    MessageCircle,
    MessageSquare,
    Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const getPlatformIcon = (platform: string, className?: string): React.ReactElement | null => {
    const iconClassName = cn("h-6 w-6", className);

    switch(platform.toLowerCase()) {
        case 'whatsapp':
            return <WhatsApp className={iconClassName} />;
        case 'instagram':
            return <Instagram className={iconClassName} />;
        case 'facebook':
            return <Facebook className={iconClassName} />;
        case 'twitter':
            return <Twitter className={iconClassName} />;
        case 'linkedin':
            return <LinkedIn className={iconClassName} />;
        case 'telegram':
            return <Send className={iconClassName} />;
        case 'github':
            return <GitHub className={iconClassName} />;
        case 'imessage':
            return <MessageCircle className={iconClassName} />;
        case 'signal':
            return <MessageSquare className={iconClassName} />;
        default:
            return null;
    }
}