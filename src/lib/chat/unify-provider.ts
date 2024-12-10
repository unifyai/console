import {loadApiKey, withoutTrailingSlash, FetchFunction} from '@ai-sdk/provider-utils';
import { UnifyChatLanguageModel } from './unify-chat-language-model';
import { UnifyChatModelId, UnifyChatSettings } from './unify-chat-settings';

// model factory function with additional methods and properties
export interface UnifyProvider {
    (modelId: UnifyChatModelId, settings?: UnifyChatSettings): UnifyChatLanguageModel;

    // explicit method for targeting a specific API in case there are several
    chat(modelId: UnifyChatModelId, settings?: UnifyChatSettings): UnifyChatLanguageModel;
}

// optional settings for the provider
export interface UnifyProviderSettings {
    /* Use a different URL prefix for API calls, e.g. to use proxy servers. The default prefix is https://api.unify.ai/v0 */
    baseURL?: string;

    /* API key.*/
    apiKey?: string;

    /* Unify headers to include in the requests.*/
    headers?: Record<string, string>;

    /* Custom fetch implementation. You can use it as a middleware to intercept requests, or to provide a custom fetch implementation for e.g. testing.*/
    fetch?: FetchFunction;

}

// provider factory function
export function createUnifyProvider(
    options: UnifyProviderSettings = {}
): UnifyProvider {
    
    const baseURL = withoutTrailingSlash(options.baseURL) ?? 'https://api.unify.ai/v0';

    const getHeaders = () => ({
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'UNIFY_API_KEY',
          description: 'Unify',
        })}`,
        ...options.headers,
    });
    
    const createChatModel = (modelId: UnifyChatModelId, settings: UnifyChatSettings = {}) => new UnifyChatLanguageModel(
        modelId, 
        settings, 
        {
            provider: 'unify.chat',
            baseURL,
            headers: getHeaders,
            fetch: options.fetch,
        }
    );

const provider = function (
    modelId: UnifyChatModelId,
    settings?: UnifyChatSettings,
) {
    if (new.target) {
    throw new Error(
        'The model factory function cannot be called with the new keyword.',
    );
    }

    return createChatModel(modelId, settings);
};

provider.chat = createChatModel;

return provider as UnifyProvider;
}

/* Default Unify provider instance. */
export const unify = createUnifyProvider();
