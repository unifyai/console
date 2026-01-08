export const defaultModelArgs = {
    "temperature": {
        "type": "int",
        "displayName": "Temperature",
        "tooltip": "The amount of randomness in the response, valued between 0 inclusive and 2 exclusive. Higher values are more random, and lower values are more deterministic.",
        "default": 0.2,
        "display": true,
        "range": {
            "min": 0,
            "max": 2,
            "step": 0.1
        }
    },
    "maxTokens": {
        "type": "int",
        "displayName": "Max Tokens",
        "tooltip": "The maximum number of completion tokens returned by the API. The total number of tokens requested in maxTokens plus the number of prompt tokens sent in messages must not exceed the context window token limit of model requested. If left unspecified, then the model will generate tokens until either it reaches its stop token or the end of its context window.",
        "default": 2048,
        "display": true,
        "range": {
            "min": 0,
            "max": 2048,
            "step": 1
        }
    },
    "stream": {
        "type": "bool",
        "default": true,
        "display": false
    },
    "messages": {
        "display": "chat_history",
        "type": "chat_history",
        "structure": {
            "content": {
                "type": "string",
                "usage": "content"
            },
            "role": {
                "type": "string",
                "usage": "role",
                "options": [
                    "user",
                    "assistant",
                    "system"
                ],
                "assistantRole": "assistant",
                "userRole": "user"
            }
        }
    }
};

export const noStreamingEndpoints = [
    "o3@openai"
];

