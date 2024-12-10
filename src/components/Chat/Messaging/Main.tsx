"use client";

import { Button } from "@/components/UI/button";
import { ChatBubble, ChatBubbleMessage } from "@/components/UI/Chat/chat-bubble";
import { ChatInput } from "@/components/UI/Chat/chat-input";
import { ChatMessageList } from "@/components/UI/Chat/chat-message-list";
import { CornerDownLeft, Trash } from "lucide-react";
import { Endpoint } from "@/types/chat/endpoints";
import { useQueryState } from "nuqs";
import { DefaultRoutingParams } from "@/lib/chat/chat";
import { Arguments, Parameters, AssistantMessage, ChatHistory, ChatFrame, ChatWrapper } from "@/types/chat/chat";
import { chat, clearChat } from "@/utils/chat/chat/server";
import { generateInput, getEndpointChat, iterateStreamResponse } from "@/utils/chat/chat/client";
import { useEffect, useRef, useState } from "react";
import { defaultModelArgs } from "@/constants/chat";
import MarkdownRender from "./MarkdownRender";
import MessageHeader from "./MessageHeader";
import ActionButton from "@/components/Common/Buttons/Action";
import ChatPinning from "./ChatPinning";
import { StreamResponseChunk } from "@/utils/chat/chat/stream";
import { SendHorizontal } from "lucide-react";


const Messaging = ({ endpoints, chatWrapper }: {
    endpoints: Endpoint[],
    chatWrapper: (props: ChatWrapper) => Promise<StreamResponseChunk<ChatFrame>>
}) => {
    // endpoint selection
    const [selectedEndpointsParam,] = useQueryState("endpoints");
    const selectedEndpoints: Endpoint[] = selectedEndpointsParam ? selectedEndpointsParam.split(",").map(
        ep => endpoints.find(endpoint => `${endpoint.code}@${endpoint.provider}` == ep)
    ).filter(ep => ep != undefined) : [];

    // pinned endpoints
    const [pinnedEndpointsParam, setPinnedEndpointsParam] = useQueryState("pinned");
    const pinnedEndpointsStr = pinnedEndpointsParam ? pinnedEndpointsParam.split(",") : selectedEndpoints.slice(0, 3).map(ep => `${ep.code}@${ep.provider}`);
    const pinnedEndpoints = pinnedEndpointsStr.map(ep => endpoints.find(endpoint => `${endpoint.code}@${endpoint.provider}` == ep)!);
    const setPinnedEndpoints = (endpoints: Endpoint[]) => (
        setPinnedEndpointsParam(endpoints.map(ep => `${ep.code}@${ep.provider}`).join(","))
    );

    // non pinned endpoints
    const nonPinnedEndpoints = selectedEndpoints.filter(ep => !pinnedEndpointsStr.includes(`${ep.code}@${ep.provider}`));

    // chatref for auto-scroll
    const chatRef = useRef<HTMLDivElement>(null);

    // chat states
    const [chatHistory, setChatHistory] = useState<ChatHistory>([]);
    const [message, setMessage] = useState<string>(
        "Tell me a joke"
    );
    const [chatKey, setChatKey] = useState<string | undefined>(undefined);
    const complete = (
        !chatHistory || !chatHistory.length || !(chatHistory.at(-1) as AssistantMessage[]
        ).some(message => message.thinking));

    // parameters
    const [parameters, setParameters] = useState<Parameters>({
        routing: DefaultRoutingParams,
        modelArguments: defaultModelArgs as Arguments,
        modelInputs: generateInput(defaultModelArgs as Arguments, null, [{
            content: "YOUR_MESSAGE",
            role: "user"
        }]),
    });

    // update params and auto-scroll
    useEffect(() => {
        chatRef.current?.scrollTo({ top: chatRef.current?.scrollHeight, behavior: "smooth" })
        setParameters((params) => {
            return {
                ...params,
                modelInputs: generateInput(
                    params.modelArguments,
                    params.modelInputs ?? null,
                    [
                        ...getEndpointChat(selectedEndpoints[selectedEndpoints.length - 1], chatHistory),
                        {
                            content: "YOUR_MESSAGE",
                            role: "user"
                        }
                    ]
                ),
            };
        });
    }, [chatHistory]);

    // submit message
    const sendMessage = async () => {
        const newChatHistory: ChatHistory = [
            ...chatHistory,
            { content: message, role: "user" }
        ];
        setMessage("");

        let responses: AssistantMessage[] = selectedEndpoints.map((endpoint) => {
            return {
                content: "",
                thinking: true,
                role: "assistant",
                endpoint: endpoint,
            };
        });
        setChatHistory([
            ...newChatHistory,
            responses
        ]);
        let prevResponses = responses;
        if (chatHistory.length > 0)
            prevResponses = chatHistory.at(-1) as AssistantMessage[];

        for await (const frame of iterateStreamResponse(chatWrapper({
            key: chatKey,
            message,
            endpoints: selectedEndpoints,
            parameters,
            prevResponses,
        }))) {
            const { key, endpoint, delta, error, done } = frame;

            setChatKey(key);

            const responseIdx = selectedEndpoints.findIndex(
                (ep) => (
                    ep.router ?
                        (ep.code == endpoint.code) :
                        (ep.code == endpoint.code && ep.provider == endpoint.provider)
                )
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
                    endpoint: selectedEndpoints[responseIdx],
                    error: true,
                };
                setChatHistory([
                    ...newChatHistory,
                    responses
                ]);
                continue;
            }

            responses[responseIdx] = {
                content: responses[responseIdx].content + delta,
                thinking: !done,
                role: "assistant",
                endpoint: selectedEndpoints[responseIdx],
                metrics: frame.metrics,
            };
            setChatHistory([
                ...newChatHistory,
                responses
            ]);
        }
    };

    // pinning handlers
    const handleUnpinEndpoint = (endpoint: Endpoint) => {
        const newPinnedEndpoints = pinnedEndpoints.filter(
            ep => ep.code != endpoint.code || ep.provider != endpoint.provider
        );
        setPinnedEndpoints(newPinnedEndpoints);
    }
    const handlePinEndpoint = (endpoint: Endpoint) => {
        const newPinnedEndpoints = [...pinnedEndpoints, endpoint];
        setPinnedEndpoints(newPinnedEndpoints);
    }

    // clear chat
    const handleClearChat = async () => {
        setChatHistory([]);

        if (!chatKey) return;

        clearChat(chatKey);
        setChatKey(undefined);
    };

    // message handler
    const handleMessageSent = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (message.trim().length === 0) return;
        if (complete) {
            sendMessage();
        }
    };

    // Wrap with ChatMessageList
    return (<div className="relative w-full h-full bg-background tutorial-chat-interface">
        <div className="absolute bottom-0 w-full pb-4">
            <div className="h-[70vh]">
                <ChatMessageList className="text-sm overflow-y-auto" ref={chatRef}>
                    {chatHistory.map((chat, index) => {
                        if (chat instanceof Array) {
                            return (
                                <div className="flex gap-4" key={index}>
                                    {chat.filter(
                                        (ch) => pinnedEndpointsStr.includes(`${ch.endpoint.code}@${ch.endpoint.provider}`)
                                    ).map((ch, idx) => {
                                        const model = ch.endpoint.code;
                                        const provider = ch.endpoint.provider;
                                        return (
                                            <ChatBubble variant="received" key={idx} className={
                                                pinnedEndpointsStr.length == 3 ? "w-1/3" : "w-1/2"
                                            }>
                                                <ChatBubbleMessage variant="received" isLoading={ch.content.length == 0}>
                                                    <MessageHeader model={model} provider={provider} content={ch.content} cost={ch.metrics?.cost} />
                                                    <MarkdownRender content={ch.content} index={index} subIndex={idx} />
                                                </ChatBubbleMessage>
                                            </ChatBubble>
                                        );
                                    })}
                                </div>
                            )
                        }
                        else {
                            return (
                                <ChatBubble variant="sent" key={index}>
                                    <ChatBubbleMessage variant="sent">
                                        <MarkdownRender content={chat.content} index={index} subIndex={0} />
                                    </ChatBubbleMessage>
                                </ChatBubble>
                            )
                        }
                    })}
                </ChatMessageList>
            </div>
            <div className="mx-4">
                {chatHistory.length > 0 ? <div className="w-fit mx-auto mb-4">
                    <ActionButton tooltip={"Clear Chat"} icon={<Trash />} variant={"outline"} onClick={handleClearChat} />
                </div> : <></>}
                <div className="bg-background my-2 flex">
                    <ChatPinning
                        endpoints={nonPinnedEndpoints}
                        side="left"
                        pinTooltipContent={
                            pinnedEndpoints.length < 3
                                ? "Pin to chat"
                                : "You can only pin 3 endpoints. Unpin another endpoint first"
                        }
                        handleClick={(endpoint: Endpoint) => pinnedEndpoints.length < 3 ? handlePinEndpoint(endpoint) : undefined}
                    />
                    <ChatPinning
                        endpoints={pinnedEndpoints}
                        side="right"
                        pinTooltipContent={"Unpin from chat"}
                        handleClick={handleUnpinEndpoint}
                    />
                </div>
                <form
                    className="h-fit rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring p-1 mt-auto"
                >
                    <ChatInput
                        placeholder={selectedEndpoints.length ? "Type your message here..." : "Please select an endpoint to continue..."}
                        className={
                            "min-h-12 resize-none rounded-lg bg-background border-0 p-3 shadow-none focus-visible:ring-0 "
                            + (selectedEndpoints.length ? "" : "pointer-events-none")
                        }
                        onChange={(e) => setMessage(e.target.value)}
                        value={selectedEndpoints.length ? message : ""}
                    />
                    <div className="flex items-center justify-end p-0 pt-0">
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleMessageSent}
                        disabled={!complete || selectedEndpoints.length === 0 || message.trim().length === 0}
                        className={`transition-colors ${
                            (!complete || selectedEndpoints.length === 0) 
                                ? '' 
                                : 'hover:bg-primary group'
                        }`}
                    >
                        <SendHorizontal className={`h-4 w-4 transition-colors ${
                            (!complete || selectedEndpoints.length === 0) 
                                ? 'text-muted-foreground' 
                                : 'text-primary group-hover:text-primary-foreground'
                        }`} />
                        <span className="sr-only">Send message</span>
                    </Button>
                </div>
                </form>
            </div>
        </div>
    </div>);
};


export default Messaging;
