"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/UI/button";
import { ChatBubble, ChatBubbleMessage } from "@/components/UI/Chat/chat-bubble";
import { ChatInput } from "@/components/UI/Chat/chat-input";
import { ChatMessageList } from "@/components/UI/Chat/chat-message-list";
import { SendHorizontal, Trash, Settings2 } from "lucide-react";
import { Endpoint } from "@/types/chat/endpoints";
import {
  Arguments,
  Parameters,
  AssistantMessage,
  ChatHistory,
  ChatFrame,
  ChatWrapper,
  UserMessage,
} from "@/types/chat/chat";
import { defaultModelArgs } from "@/constants/chat";
import {
  generateInput,
  getEndpointChat,
  iterateStreamResponse,
} from "@/utils/chat/chat/client";
import MarkdownRender from "./MarkdownRender";
import MessageHeader from "./MessageHeader";
import { Sheet, SheetTrigger, SheetContent } from "@/components/UI/sheet";
import EndpointsTable from "../Endpoints/Main";
import { StreamResponseChunk } from "@/utils/chat/chat/stream";
import { DefaultRoutingParams } from "@/lib/chat/chat";
import { clearChat } from "@/utils/chat/chat/server";
import ChatPinning from "./ChatPinning";

const Messaging = ({ endpoints, chatWrapper }: {
    endpoints: Endpoint[],
    chatWrapper: (props: ChatWrapper) => Promise<StreamResponseChunk<ChatFrame>>
}) => {
    // State for selected endpoints
    const [selectedEndpoints, setSelectedEndpoints] = useState<Endpoint[]>([]);
    const [pinnedEndpoints, setPinnedEndpoints] = useState<Endpoint[]>([]);
    const unpinnedEndpoints = selectedEndpoints.filter(
        ep => !pinnedEndpoints.some(
            pinned => pinned.code === ep.code && pinned.provider === ep.provider
        )
    );

    // Chat ref for auto-scroll
    const chatRef = useRef<HTMLDivElement>(null);

    // Chat states
    const [chatHistory, setChatHistory] = useState<ChatHistory>([]);
    const [message, setMessage] = useState<string>("");
    const [chatKey, setChatKey] = useState<string | undefined>(undefined);
    const complete =
        !chatHistory.length ||
        !(chatHistory.at(-1) instanceof Array && 
          (chatHistory.at(-1) as AssistantMessage[]).some((msg) => msg.thinking));

    // Parameters
    const [parameters, setParameters] = useState<Parameters>({
        routing: DefaultRoutingParams,
        modelArguments: defaultModelArgs as Arguments,
        modelInputs: generateInput(defaultModelArgs as Arguments, null, [
            { content: "YOUR_MESSAGE", role: "user" },
        ]),
    });

    // Update parameters and auto-scroll
    useEffect(() => {
        chatRef.current?.scrollTo({ top: chatRef.current?.scrollHeight, behavior: "smooth" });
        setParameters((params) => ({
            ...params,
            modelInputs: generateInput(
                params.modelArguments,
                params.modelInputs ?? null,
                [
                    ...(selectedEndpoints.length > 0 ? getEndpointChat(selectedEndpoints[0], chatHistory) : []),
                    { content: "YOUR_MESSAGE", role: "user" },
                ]
            ),
        }));
    }, [chatHistory, selectedEndpoints]);

    // Submit message
    const sendMessage = async () => {
        if (selectedEndpoints.length === 0) {
            alert("Please select at least one endpoint to send messages.");
            return;
        }

        const endpointsToUse = selectedEndpoints;

        const newChatHistory: ChatHistory = [
            ...chatHistory,
            { content: message, role: "user" },
        ];
        setMessage("");

        let responses: AssistantMessage[] = endpointsToUse.map((endpoint) => ({
            content: "",
            thinking: true,
            role: "assistant",
            endpoint: endpoint,
        }));
        setChatHistory([...newChatHistory, responses]);
        let prevResponses =
            chatHistory.length > 0
                ? (chatHistory.at(-1) as AssistantMessage[])
                : responses;

        for await (const frame of iterateStreamResponse(
            chatWrapper({
                key: chatKey,
                message,
                endpoints: endpointsToUse,
                parameters,
                prevResponses,
            })
        )) {
            const { key, endpoint, delta, error, done } = frame;

            setChatKey(key);

            const responseIdx = endpointsToUse.findIndex(
                (ep) => ep.code === endpoint.code && ep.provider === endpoint.provider
            );

            if (responseIdx === -1) {
                console.error("Received response from an endpoint not in the list");
                continue;
            }

            if (error) {
                responses[responseIdx] = {
                    content: "An error occurred",
                    role: "assistant",
                    thinking: false,
                    endpoint: endpointsToUse[responseIdx],
                    error: true,
                };
                setChatHistory([...newChatHistory, responses]);
                continue;
            }

            responses[responseIdx] = {
                content: responses[responseIdx].content + delta,
                thinking: !done,
                role: "assistant",
                endpoint: endpointsToUse[responseIdx],
                metrics: frame.metrics,
            };
            setChatHistory([...newChatHistory, responses]);
        }
    };

    // Function to toggle pinning
    const handlePinToggle = (endpoint: Endpoint) => {
        const isPinned = pinnedEndpoints.some(
            ep => ep.code === endpoint.code && ep.provider === endpoint.provider
        );
        if (isPinned) {
            handleUnpinEndpoint(endpoint);
        } else {
            if (pinnedEndpoints.length >= 3) {
                alert("You can only pin up to 3 endpoints. Unpin another endpoint first.");
                return;
            }
            handlePinEndpoint(endpoint);
        }
    };

    // Functions to handle pinning
    const handlePinEndpoint = (endpoint: Endpoint) => {
        setPinnedEndpoints([...pinnedEndpoints, endpoint]);
    };

    const handleUnpinEndpoint = (endpoint: Endpoint) => {
        setPinnedEndpoints(pinnedEndpoints.filter(
            ep => !(ep.code === endpoint.code && ep.provider === endpoint.provider)
        ));
    };

    // Function to deselect an endpoint
    const handleUnselectEndpoint = (endpoint: Endpoint) => {
        setSelectedEndpoints(selectedEndpoints.filter(
            ep => !(ep.code === endpoint.code && ep.provider === endpoint.provider)
        ));
        setPinnedEndpoints(pinnedEndpoints.filter(
            ep => !(ep.code === endpoint.code && ep.provider === endpoint.provider)
        ));
    };

    // Clear chat
    const handleClearChat = async () => {
        setChatHistory([]);
        if (!chatKey) return;
        clearChat(chatKey);
        setChatKey(undefined);
    };

    // Message handler
    const handleMessageSent = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (message.trim().length === 0) return;
        if (complete) {
            sendMessage();
        }
    };

    // Function to check if an endpoint is pinned
    const isEndpointPinned = (endpoint: Endpoint) => {
        return pinnedEndpoints.some(
            ep => ep.code === endpoint.code && ep.provider === endpoint.provider
        );
    };

    return (
        <div className="relative w-full h-full bg-background tutorial-chat-interface">
            {/* Header */}
            <div className="absolute top-0 w-full p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Chat</h2>
            </div>

            {/* Chat Messages */}
            <div className="absolute bottom-0 w-full pb-4">
                <div className="h-[70vh] mt-16">
                    <ChatMessageList className="text-sm overflow-y-auto" ref={chatRef}>
                        {chatHistory.map((chat, index) => {
                            if (Array.isArray(chat)) {
                                // It's an array of assistant responses
                                const responses = chat as AssistantMessage[];
                                // Filter responses to only include those from pinned endpoints
                                const visibleResponses = responses.filter(ch => isEndpointPinned(ch.endpoint));
                                if (visibleResponses.length === 0) return null; // No pinned responses to display
                                return (
                                    <div className="flex gap-4" key={index}>
                                        {visibleResponses.map((ch, idx) => {
                                            const model = ch.endpoint.code;
                                            const provider = ch.endpoint.provider;
                                            return (
                                                <ChatBubble variant="received" key={idx} className="w-full">
                                                    <ChatBubbleMessage
                                                        variant="received"
                                                        isLoading={ch.content.length === 0}
                                                    >
                                                        <MessageHeader
                                                            model={model}
                                                            provider={provider}
                                                            content={ch.content}
                                                            cost={ch.metrics?.cost}
                                                        />
                                                        <MarkdownRender
                                                            content={ch.content}
                                                            index={index}
                                                            subIndex={idx}
                                                        />
                                                    </ChatBubbleMessage>
                                                </ChatBubble>
                                            );
                                        })}
                                    </div>
                                );
                            } else {
                                // It's a user message
                                const userMessage = chat as UserMessage;
                                return (
                                    <ChatBubble variant="sent" key={index}>
                                        <ChatBubbleMessage variant="sent">
                                            <MessageHeader model={"You"} content={userMessage.content} />
                                            <MarkdownRender
                                                content={userMessage.content}
                                                index={index}
                                                subIndex={0}
                                            />
                                        </ChatBubbleMessage>
                                    </ChatBubble>
                                );
                            }
                        })}
                    </ChatMessageList>
                </div>

                {/* Chat Pinning Components */}
                {selectedEndpoints.length > 0 && (
                    <div className="bg-background my-2 flex px-5">
                        <ChatPinning
                            endpoints={unpinnedEndpoints}
                            side="left"
                            handlePinToggle={handlePinToggle}
                            handleUnselect={handleUnselectEndpoint}
                        />
                        <ChatPinning
                            endpoints={pinnedEndpoints}
                            side="right"
                            handlePinToggle={handlePinToggle}
                            handleUnselect={handleUnselectEndpoint}
                        />
                    </div>
                )}

                {/* Chat Input */}
                <div className="mx-4">
                    {chatHistory.length > 0 && (
                        <div className="w-fit mx-auto mb-4">
                            <Button variant="outline" onClick={handleClearChat}>
                                <Trash className="mr-2" /> Clear Chat
                            </Button>
                        </div>
                    )}
                    <form
                        className="flex justify-between h-fit rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring p-1 mt-auto"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) handleMessageSent(e);
                        }}
                    >
                        <ChatInput
                            placeholder={selectedEndpoints.length === 0 ? "Please select an endpoint..." : "Type your message here..."}
                            className="min-h-24 resize-none rounded-lg bg-background border-0 p-3 shadow-none focus-visible:ring-0"
                            onChange={(e) => setMessage(e.target.value)}
                            value={message}
                            disabled={selectedEndpoints.length === 0}
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleMessageSent}
                            disabled={
                                !complete ||
                                selectedEndpoints.length === 0 ||
                                message.trim().length === 0
                            }
                            className={`mr-2 transition-colors ${
                                !complete || selectedEndpoints.length === 0
                                    ? ""
                                    : "hover:bg-primary group"
                            }`}
                        >
                            <SendHorizontal
                                className={`h-4 w-4 transition-colors ${
                                    !complete || selectedEndpoints.length === 0
                                        ? "text-muted-foreground"
                                        : "text-primary group-hover:text-primary-foreground"
                                }`}
                            />
                            <span className="sr-only">Send message</span>
                        </Button>
                    </form>
                </div>
            </div>

            {/* Select Endpoints Icon */}
            <Sheet>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 z-50"
                    >
                        <Settings2 className="w-6 h-6" />
                        <span className="sr-only">Select Endpoints</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right">
                    <EndpointsTable
                        endpoints={endpoints}
                        selectedEndpoints={selectedEndpoints}
                        setSelectedEndpoints={setSelectedEndpoints}
                    />
                </SheetContent>
            </Sheet>
        </div>
    );
};

export default Messaging;