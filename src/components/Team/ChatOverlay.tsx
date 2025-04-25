import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/UI/button";
import { Input } from "@/components/UI/input";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Send, Mic, Bot, X } from "lucide-react";
import type { Assistant } from "@/types/assistants/assistant";
import { faker } from '@faker-js/faker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import ActionButton from '../Common/Buttons/Action';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ChatOverlayProps {
    isOpen: boolean;
    assistant: Assistant | null;
    onClose: () => void;
}

interface Message {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

export function ChatOverlay({ isOpen, assistant, onClose }: ChatOverlayProps) {
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [newMessage, setNewMessage] = React.useState('');
    const [isVoiceMode, setIsVoiceMode] = React.useState(false);
    const scrollAreaRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Reset messages and focus input when chat opens for a specific assistant
    React.useEffect(() => {
        if (isOpen && assistant) {
            setMessages([
                { id: faker.string.uuid(), sender: 'assistant', text: `Hi! How can I help you today?`, timestamp: new Date() },
            ]);
            // Focus input after a short delay to allow animation
            setTimeout(() => inputRef.current?.focus(), 300);
        } else {
            setMessages([]);
        }
    }, [isOpen, assistant]);

    // Scroll to bottom effect
    React.useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
            if (scrollViewport) {
                scrollViewport.scrollTop = scrollViewport.scrollHeight;
            }
        }
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !assistant) return;

        const userMessage: Message = {
            id: faker.string.uuid(),
            sender: 'user',
            text: newMessage,
            timestamp: new Date(),
        };

        // Simulate assistant response
        const assistantResponse: Message = {
             id: faker.string.uuid(),
            sender: 'assistant',
            text: faker.lorem.sentence(),
            timestamp: new Date(Date.now() + 500), // Slight delay
        }

        setMessages(prev => [...prev, userMessage, assistantResponse]);
        setNewMessage('');
    };

    if (!assistant) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key={`chat-${assistant.id}`}
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="absolute bottom-0 left-0 right-0 h-[45vh] bg-background border-t shadow-lg flex flex-col z-10" // Added z-index
                >
                    {/* Header */}
                    <div className="p-3 border-b flex items-center flex-shrink-0">
                        <Avatar className="h-7 w-7 mr-2">
                            <AvatarImage src={assistant.avatarUrl} alt={`${assistant.firstName} ${assistant.lastName}`} />
                            <AvatarFallback>{`${assistant.firstName} ${assistant.lastName}`.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <h3 className="text-sm font-semibold">Chat with {`${assistant.firstName} ${assistant.lastName}`}</h3>
                        <div className='ml-auto flex items-center'>
                            <ActionButton
                                tooltip={isVoiceMode ? "Switch to text input" : "Switch to voice input"}
                                icon={<Mic className="h-4 w-4" />}
                                onClick={() => setIsVoiceMode(!isVoiceMode)}
                                variant={isVoiceMode ? "secondary" : "ghost"}
                                size="sm"
                            />
                            <Button variant="ghost" size="icon" className="ml-1 h-7 w-7" onClick={onClose}>
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close Chat</span>
                            </Button>
                        </div>
                    </div>

                    {/* Message Area */}
                    <ScrollArea className="flex-1 px-4 py-2" ref={scrollAreaRef}>
                         <div className="space-y-4 pb-2">
                            {messages.map((message) => (
                                <div key={message.id} className={
                                    cn("flex items-start gap-3", message.sender === 'user' ? 'justify-end' : 'justify-start')
                                }>
                                    {message.sender === 'assistant' && (
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={assistant.avatarUrl} alt={`${assistant.firstName} ${assistant.lastName}`} />
                                            <AvatarFallback><Bot className='h-4 w-4'/></AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div
                                    className={cn(
                                        "p-2 px-3 rounded-lg max-w-[75%]",
                                        message.sender === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                    )}
                                    >
                                         <p className="text-sm">{message.text}</p>
                                         <p className="text-xs opacity-70 mt-1 text-right">
                                             {format(message.timestamp, 'p')}
                                         </p>
                                     </div>
                                     {message.sender === 'user' && ( 
                                        <Avatar className="h-6 w-6">
                                            {/* Assuming a generic user avatar or initials */}
                                            <AvatarFallback>U</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    {/* Footer Input */}
                    <div className="p-3 border-t flex-shrink-0">
                        <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
                            {isVoiceMode ? ( 
                                <Button type="button" className='flex-1 justify-center' variant="outline">
                                    <Mic className="h-5 w-5 mr-2"/> Listening... (Voice Input Placeholder)
                                </Button>
                             ) : (
                                <Input
                                    ref={inputRef}
                                    placeholder="Enter message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    className="flex-1"
                                    autoComplete='off'
                                />
                            )}
                            <Button type="submit" disabled={!newMessage.trim() && !isVoiceMode} size="icon">
                                <Send className="h-4 w-4" />
                                <span className="sr-only">Send</span>
                            </Button>
                        </form>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}