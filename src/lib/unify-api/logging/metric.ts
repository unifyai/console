import { getOrchestraUserClient } from "@/lib/orchestra/orchestra-client";

export interface MetricItem {
    time_bin: string;
    request_count: number;
    generation_time_p50: number;
    generation_time_p95: number;
    tokens_per_sec_p50: number;
    tokens_per_sec_p95: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
}

export async function getQueryMetrics(
    apiKey: string,
    start_time?: string,
    end_time?: string,
    models?: string,
    providers?: string,
    interval: string = "300",
    secondary_user_id?: string
): Promise<MetricItem[]> {
    const OrchestraUserClient = await getOrchestraUserClient(apiKey);
    const params = new URLSearchParams();

    if (start_time) params.append("start_time", start_time);
    if (end_time) params.append("end_time", end_time);
    if (models) params.append("models", models);
    if (providers) params.append("providers", providers);
    params.append("interval", interval);
    if (secondary_user_id) params.append("secondary_user_id", secondary_user_id);

    const response = await OrchestraUserClient.get<MetricItem[]>("/metrics", { params });
    return response.data;
}