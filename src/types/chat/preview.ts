export interface ModelArguments {
    model: string;
    provider: string;
    arguments: {
        messages: {
            role: "user" | "assistant";
            content: string;
        }[];
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
    };
}

export interface MessageOptions {
    modelArguments: ModelArguments;
    apiKey: string;
}

export interface PostmanRequest {
    method: string;
    headers: {
        "Content-Type": string;
        Authorization: string;
    };
    body: string;
}
