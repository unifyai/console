import React, { useEffect } from "react";
import { defaultModelArgs } from "@/constants/chat";
import { Arguments, Parameters, AssistantMessage, ChatHistory } from "@/types/chat/chat";
import { generateInput, getEndpointChat, iterateStreamResponse } from "@/utils/chat/chat/client";
import { chat, clearChat } from "@/utils/chat/chat/server";
import { Endpoint } from "@/types/chat/endpoints";

export const DefaultRoutingParams: Parameters["routing"] = {
    strategy: "quality",
    minThroughput: 0,
    maxLatency: 10,
    maxInputCost: 1,
    maxOutputCost: 1,
};

const useChat = (
    selectedEndpoints: Endpoint[],
    setSelectedEndpoints: (endpoints: Endpoint[]) => void,
    defaultMessage: boolean = false,
    residualMessage: string | undefined = undefined
) => {
    const [chatHistory, setChatHistory] = React.useState<ChatHistory>([]);
    const [message, setMessage] = React.useState<string>(
        (defaultMessage || residualMessage) ?
            residualMessage && residualMessage.length ?
                residualMessage : "Give me a short paragraph explaining the potential benefits of dynamically routing prompts to different LLMs"
            : ""
    );
    const [parameters, setParameters] = React.useState<Parameters>({
        routing: DefaultRoutingParams,
        modelArguments: defaultModelArgs as Arguments,
        modelInputs: generateInput(defaultModelArgs as Arguments, null, [{
            content: "YOUR_MESSAGE",
            role: "user"
        }]),
    });
    const [chatKey, setChatKey] = React.useState<string | undefined>(undefined);

    useEffect(() => {
        console.dir({
            ...parameters,
            modelInputs: generateInput(
                defaultModelArgs as Arguments,
                generateInput(defaultModelArgs as Arguments, null, [{
                    content: "YOUR_MESSAGE",
                    role: "user"
                }]),
                [
                    ...getEndpointChat(selectedEndpoints[selectedEndpoints.length - 1], chatHistory),
                    {
                        content: "YOUR_MESSAGE",
                        role: "user"
                    }
                ]
            )
        });
        // setParameters({
        //     ...parameters,
        //     modelInputs: generateInput(
        //         defaultModelArgs as Arguments,
        //         generateInput(defaultModelArgs as Arguments, null, [{
        //             content: "YOUR_MESSAGE",
        //             role: "user"
        //         }]),
        //         [
        //             ...getEndpointChat(selectedEndpoints[selectedEndpoints.length - 1], chatHistory),
        //             {
        //                 content: "YOUR_MESSAGE",
        //                 role: "user"
        //             }
        //         ]
        //     )
        // });
    }, [chatHistory, selectedEndpoints]);

    // const handleClearChat = async () => {
    //     setChatHistory([]);

    //     if (!chatKey) return;

    //     clearChat(chatKey);
    //     setChatKey(undefined);
    // };

    // const sendMessage = async (apiKey: string) => {
    //     const newChatHistory: ChatHistory = [
    //         ...chatHistory,
    //         { content: message, role: "user" }
    //     ];
    //     setMessage("");

    //     let responses: AssistantMessage[] = selectedEndpoints.map((endpoint) => {
    //         return {
    //             content: "",
    //             thinking: true,
    //             role: "assistant",
    //             endpoint: endpoint,
    //         };
    //     });
    //     setChatHistory([
    //         ...newChatHistory,
    //         responses
    //     ]);
    //     let prevResponses = responses;
    //     if (chatHistory.length > 0)
    //         prevResponses = chatHistory.at(-1) as AssistantMessage[];

    //     for await (const frame of iterateStreamResponse(chat({
    //         endpoints: selectedEndpoints,
    //         message,
    //         parameters,
    //         key: chatKey,
    //         prevResponses: prevResponses,
    //         apiKey: apiKey
    //     }))) {
    //         const { key, endpoint, delta, error, done } = frame;

    //         setChatKey(key);

    //         const responseIdx = selectedEndpoints.findIndex(
    //             (ep) => (
    //                 ep.router ?
    //                     (ep.code == endpoint.code) :
    //                     (ep.code == endpoint.code && ep.provider == endpoint.provider)
    //             )
    //         );

    //         if (responseIdx === -1) {
    //             console.error("Received response from an endpoint not in the list");
    //             continue;
    //         }

    //         if (error) {
    //             responses[responseIdx] = {
    //                 content: "An error occurred",
    //                 role: "assistant",
    //                 thinking: false,
    //                 endpoint: selectedEndpoints[responseIdx],
    //                 error: true,
    //             };
    //             setChatHistory([
    //                 ...newChatHistory,
    //                 responses
    //             ]);
    //             continue;
    //         }

    //         responses[responseIdx] = {
    //             content: responses[responseIdx].content + delta,
    //             thinking: !done,
    //             role: "assistant",
    //             endpoint: selectedEndpoints[responseIdx],
    //             metrics: frame.metrics,
    //         };
    //         setChatHistory([
    //             ...newChatHistory,
    //             responses
    //         ]);
    //     }
    // };

    // return {
    //     chatHistory,
    //     message,
    //     setMessage,
    //     sendMessage,
    //     clearChat: handleClearChat,
    //     selectedEndpoints,
    //     setSelectedEndpoints,
    //     parameters,
    //     setParameters,
    //     DefaultRoutingParams,
    // };
};

export default useChat;
