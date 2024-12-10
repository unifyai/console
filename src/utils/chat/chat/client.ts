import { Endpoint } from "@/types/chat/endpoints";
import { MessageOptionsWithoutCallback, AssistantMessage, UserMessage, ChatHistory, Arguments, ModelInputs, NonChatHistoryArg, ArgumentChatHistory } from "@/types/chat/chat";
import { StreamResponseChunk } from "./stream";

export function iterateStreamResponse<T>(streamResponse: Promise<StreamResponseChunk<T>>) {
  return {
    [Symbol.asyncIterator]: function () {
      return {
        current: streamResponse,
        async next() { 
          const { iteratorResult, next } = await this.current;

          if (next) this.current = next;
          else iteratorResult.done = true;

          return iteratorResult;
        }
      };
    }
  };
}

export const generateInput = <Args extends Arguments, T extends ModelInputs<Args>>(args: Args, input: T | null, chatHistory: (AssistantMessage | UserMessage)[]): T => {
    const newInput: any = { ...input };

    Object.keys(args).forEach((key) => {
        if (args[key].type === "chat_history") {
            return;
        }
        newInput[key] = input?.[key] ?? (args[key] as NonChatHistoryArg).default;
    });

    const chatHistoryArguments = Object.keys(args)
        .filter((key) => args[key].type === "chat_history");

    chatHistoryArguments.forEach((argKey) => {
        const chatArg = args[argKey] as ArgumentChatHistory;
        const chatInput = chatHistory.map((chatObject) => Object.fromEntries(Object.entries(chatArg.structure).map(([key, value]) => {
            if (!("usage" in value) && value.type !== "chat_history") {
                return [key, value.default];
            }
            if (value.type === "chat_history") {
                throw new Error("Nested chat history not supported");
            }

            if (value.usage === "content") {
                return [key, chatObject.content];
            }

            if (value.usage === "role") {
                return [key, chatObject.role === "assistant" ? value.assistantRole : value.userRole];
            }

            return [key, null];
        })));

        newInput[argKey] = chatInput;
    });

    return newInput;
};

export const generateRequest = <T,>(options: MessageOptionsWithoutCallback<T>) => {
    const params = ["c", "t", "i"];
    const body = JSON.stringify({
        model: (
            options.endpoint.router ?
                `router@${["q:1"].concat(options.endpoint.code.split("_").slice(1).map(
                    (value, index) => `${params[index]}:${value}`
                )).join("|")}` : (options.endpoint.code + "@" + options.endpoint.provider)
        ),
        ...options.arguments,
        signature: "chat"
    });
    return {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${options.connection.apiKey}`,
        },
        body: body,
    };
};

export const getEndpointChat = (endpoint: Endpoint, chatHistory: ChatHistory) => {
    const endpointHistory = (chatHistory.map((chat) => {
        if ("content" in chat) {
            return chat;
        }
        const checkEndpoint = (message: AssistantMessage) => {
            const messageEndpoint = message.endpoint;
            if (
                endpoint && ("code" in messageEndpoint && "code" in endpoint)
                && ("provider" in messageEndpoint && "provider" in endpoint)
            ) {
                return messageEndpoint.code == endpoint.code && messageEndpoint.provider == endpoint.provider;
            }
            return message.endpoint === endpoint;
        };
        const assistantMessage = chat.find(checkEndpoint);
        if (!assistantMessage?.error) {
            return assistantMessage;
        }

        return chat.find((message) => !message.error);
    }).filter((chat) => chat !== undefined) as (AssistantMessage | UserMessage)[]);
    const roles = endpointHistory.map(message => message.role);
    const assistantIndex = roles.indexOf("assistant");
    let firstMessageIndex = assistantIndex - 1;
    if (assistantIndex == -1)
        firstMessageIndex = roles.length - 1;
    return endpointHistory.slice(firstMessageIndex);
};

export const getScreenCategory = (size: number) => {
    if (size > 1536)
        return "2xl";
    if (size > 1280)
        return "xl";
    if (size > 1024)
        return "lg";
    if (size > 768)
        return "md";
    if (size > 640)
        return "sm";
    return "xs";
};

export const getMaxBubbles = (category: string) => {
    if (["2xl", "xl"].includes(category))
        return 3;
    else if (["lg"].includes(category))
        return 2;
    return 1;
};
