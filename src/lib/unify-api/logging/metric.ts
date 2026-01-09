import { getOrchestraUserClient } from "@/lib/orchestra/orchestra-client";

export interface MetricItem {
    timeBin: string;
    requestCount: number;
    generationTimeP50: number;
    generationTimeP95: number;
    tokensPerSecP50: number;
    tokensPerSecP95: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
}

export async function getQueryMetrics(
    apiKey: string,
    startTime?: string,
    endTime?: string,
    models?: string,
    providers?: string,
    interval: string = "300",
    secondaryUserId?: string
): Promise<MetricItem[]> {
    const OrchestraUserClient = await getOrchestraUserClient(apiKey);
    const params = new URLSearchParams();

    if (startTime) params.append("startTime", startTime);
    if (endTime) params.append("endTime", endTime);
    if (models) params.append("models", models);
    if (providers) params.append("providers", providers);
    params.append("interval", interval);
    if (secondaryUserId) params.append("secondaryUserId", secondaryUserId);

    const response = await OrchestraUserClient.get<MetricItem[]>("/metrics", { params });
    return response.data;
}