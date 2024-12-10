import { MessageOptions } from "@/types/chat/preview";
import Postman from "postman-collection";
import { PostmanRequest } from "@/types/chat/preview";
import CodeGen from "postman-code-generators";

export const convertRouterNameToEndpoint = (name: string) => {
    const params = ["c", "t", "i"];
    return `router@${["q:1"].concat(name.split("_").slice(1).map((value, index) => `${params[index]}:${value}`)).join("|")}`;
};

// eslint-disable-next-line no-unused-vars
export const generateRequest = <T,>(options: MessageOptions) => {
    const model = options.modelArguments.model;
    const provider = options.modelArguments.provider;
    const body = model.includes("router") 
        ?   JSON.stringify({
                model: convertRouterNameToEndpoint(model),
                ...options.modelArguments.arguments,
            }) 
        :   JSON.stringify({
                model: model,
                provider: provider,
                ...options.modelArguments.arguments
            });
    return {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${options.apiKey}`,
        },
        body: body,
    };
};

export const generateSnippet = (selectedLanguage: string, selectedVariant: string, request: PostmanRequest) => {
    
    let codeExampleWithKey: string = "";
    let codeExampleWithoutKey: string = "";

    // Manually generate python package code
    if (selectedVariant === "package") {
        const jsonBody = JSON.parse(request.body);
        const message = jsonBody.messages[0].content;
        const endpoint = jsonBody.model + ("provider" in jsonBody ? "@".concat(jsonBody.provider) : "");
        codeExampleWithKey = `import unify\n\nclient = unify.Unify("${endpoint}", api_key="YOUR_API_KEY")\n\nresponse = client.generate(\n  "${message}"\n  )\n\nprint(response)`;
        return {code: codeExampleWithKey, secureCode: codeExampleWithKey}
    }

    // Auto generate code snippet for other languages
    const postmanRequest = new Postman.Request({
        method: request.method,
        url: "https://api.unify.ai/v0/chat/completions",
        header: Object.entries(request.headers).map(([key, value]) => ({
            key,
            value,
        })),
        body: {
            mode: "raw",
            raw: request.body,
        },
    });

    CodeGen.convert(selectedLanguage, selectedVariant, postmanRequest, {}, (err: Error, code: string) => {
        codeExampleWithKey = err ? "An error occurred" : code;
    });
    
    postmanRequest.upsertHeader({key: "Authorization", value: "Bearer YOUR_API_KEY"});
    CodeGen.convert(selectedLanguage, selectedVariant, postmanRequest, {}, (err: Error, code: string) => {
        codeExampleWithoutKey = err ? "An error occurred" : code;
    });

    return {code: codeExampleWithKey, secureCode: codeExampleWithoutKey}
}