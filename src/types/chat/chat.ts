import { Endpoint } from "./endpoints";

export type Primitives = "int" | "string" | "bool";
export type List = "list";
export type Object = "object";

export interface ChatContent {
    type: "string";
    usage: "content";
}

export interface ChatRole {
    type: "string";
    usage: "role";
    options: string[];
    assistantRole: string;
    userRole: string;
}

export interface ChatArguments {
    [key: string]: ChatContent | ChatRole | Argument;
}

export type UserMessage = {
    content: string;
    role: "user";
};

export type AssistantMessage = {
    content: string;
    role: "assistant";
    thinking: boolean;
    endpoint: Endpoint;
    metrics?: Partial<{
        model: string;
        provider: string;
        latency: number;
        throughput: number;
        cost: number;
    }>;
    error?: boolean;
};

export type ChatHistory = (UserMessage | AssistantMessage[])[];

export type ArgumentType = Primitives | List | Object | "chat_history";

export type ArgumentVisible = {
    displayName: string;
    tooltip: string;
    display: true;
};

export type ArgumentHidden = {
    display: false;
};

type ArgumentBase = {
    type: ArgumentType;
} & (ArgumentVisible | ArgumentHidden);

type ArgumentInt = ArgumentBase & {
    type: "int";
    default: number;
    range?: {
        min: number;
        max: number;
        step: number;
    };
};

export type ArgumentString = ArgumentBase & {
    type: "string";
    default: string;
};

export type ArgumentBool = ArgumentBase & {
    type: "bool";
    default: boolean;
};

export type ArgumentList<T extends ArgumentType = ArgumentType> = ArgumentBase & {
    type: "list";
    elementType: T;
    default: ModelInputPrimitiveType<T>[];
};

export type ArgumentObject<T extends Arguments = Arguments> = ArgumentBase & {
    type: "object";
    fields: T;
    default: ModelInputs<T>;
};

export type ArgumentChatHistory = {
    type: "chat_history";
    structure: ChatArguments;
    display: "chat_history";
};

export type Argument = ArgumentInt | ArgumentString | ArgumentBool | ArgumentList | ArgumentObject | ArgumentChatHistory;

export interface Arguments {
    [key: string]: Argument;
}

type ChatInputs<T extends ChatArguments> = {
    [key in keyof T]: ModelInputPrimitiveType<T[key]["type"]>;
};

export type ModelInputPrimitiveType<T extends ArgumentType> = T extends "int" ? number
                    : T extends "string" ? string
                    : T extends "bool" ? boolean
                    : never;

export type ModelInputType<T extends Argument> = T extends ArgumentList ? ModelInputPrimitiveType<T["elementType"]>[]
                    : T extends ArgumentObject ? ModelInputs<T["fields"]>
                    : T extends ArgumentChatHistory ? ChatInputs<T["structure"]>
                    : T extends ArgumentInt ? number
                    : T extends ArgumentString ? string
                    : T extends ArgumentBool ? boolean
                    : never;

export type ModelInputs<T extends Arguments> = {
    [key in keyof T]: ModelInputType<T[key]>;
};

export interface Parameters <T extends Arguments = Arguments> {
    routing: {
        strategy: "tokens-per-second" | "latency" | "output-cost" | "input-cost" | "quality";
        minThroughput: number;
        maxLatency: number;
        maxInputCost: number;
        maxOutputCost: number;
    };
    modelArguments: T;
    modelInputs?: ModelInputs<T>;
}

export interface ChatRequest {
    key?: string;
    message: string;
    endpoints: Endpoint[];
    parameters: Parameters;
    prevResponses: AssistantMessage[];
    apiKey: string;
}

export interface ChatWrapper {
    key?: string;
    message: string;
    endpoints: Endpoint[];
    parameters: Parameters;
    prevResponses: AssistantMessage[];
}

export interface ChatFrame {
    key: string;
    endpoint: Endpoint;
    delta: string;
    metrics?: AssistantMessage["metrics"];
    error?: boolean;
    done?: boolean;
}

export interface ResponseChunk {
    model: string;
    provider: string;
    usage: Partial<{
        "promptTokens": number;
        "completionTokens": number;
        "totalTokens": number;
        "cost": number
    }>;
    choices?: {
        delta?: {
            content: string | null;
        };
        message?: {
            content: string | null;
        }
    }[];
}

export type MessageOptionsWithoutCallback<T> = Omit<MessageOptions<T>, "callback">;

export type NonChatHistoryArg = Exclude<Argument, { type: "chat_history" }>;

export interface MessageOptions<T> {
    endpoint: Endpoint;
    arguments: T;
    // eslint-disable-next-line no-unused-vars
    callback: (chat: AssistantMessage) => void;
    connection: {
        orchestraUrl: string;
        apiKey: string;
    }
}
