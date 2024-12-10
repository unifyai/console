import { getOrchestraUserClient } from "@/lib/orchestra/orchestra-client";


/**
 * Returns a list of model names that are supported by the given provider.
 *
 * If no provider is given, returns all model names that are supported by any provider.
 * @param provider The name of the provider.
 * @returns A list of model names.
 */
export async function listModels(apiKey: string, provider: string): Promise<string[]> {
    const OrchestraUserClient = await getOrchestraUserClient(apiKey);
    const params = new URLSearchParams();
    if (provider) params.append("provider", provider);
    const response = await OrchestraUserClient.get<string[]>("/models", {
        params: params,
    });
    return response.data;
};

/**
 * Returns a list of provider names that support the given model.
 *
 * The result is a list of strings, where each string is a provider name.
 * The list is empty if the model is not supported by any provider.
 * The list may be empty if the model is not supported by any provider.
 * If the model is not specified, the list contains all providers.
 *
 * @param model - The model to query providers for.
 * @returns A list of provider names that support the given model.
 */
export async function listProviders(apiKey: string, model: string): Promise<string[]> {
    const OrchestraUserClient = await getOrchestraUserClient(apiKey);
    const params = new URLSearchParams();
    if (model) params.append("model", model);
    const response = await OrchestraUserClient.get<string[]>("/providers", {
        params: params,
    });
    return response.data;
};

/**
 * Returns a list of endpoint names that are supported by the given provider and model.
 *
 * @param provider - The name of the provider.
 * @param model - The name of the model.
 * @returns A list of endpoint names.
 */
export async function listEndpoints(
    apiKey: string,
    provider: string | undefined,
    model: string | undefined
): Promise<string[]> {
    const OrchestraUserClient = await getOrchestraUserClient(apiKey);
    const params = new URLSearchParams();
    if (provider) params.append("provider", provider);
    if (model) params.append("model", model);
    const response = await OrchestraUserClient.get<string[]>("/endpoints", {
        params: params,
    });
    return response.data;
}
