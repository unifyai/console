import { CallsDataProps, TokensDataProps, LatencyDataProps, ThroughputDataProps } from "@/types/usage";
import { getQueryMetrics, MetricItem } from "@/lib/unify-api/logging/metric";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const apiKey = user.apiKey;

    const url = new URL(req.url);
    const startTime = url.searchParams.get("start_time") || undefined;
    const endTime = url.searchParams.get("end_time") || undefined;
    const models = url.searchParams.get("models") || undefined;
    const providers = url.searchParams.get("providers") || undefined;
    const interval = url.searchParams.get("interval") || "300";
    const secondaryUserId = url.searchParams.get("secondary_user_id") || undefined;

    const metrics = await getQueryMetrics(apiKey, startTime, endTime, models, providers, interval, secondaryUserId);

    const formattedMetrics = metrics.map((item: MetricItem) => ({
        tokenData: {
            ts: item.time_bin,
            totalCompletionTokens: item.total_completion_tokens,
            totalPromptTokens: item.total_prompt_tokens
        } as TokensDataProps,
        callsData: {
            ts: item.time_bin,
            requestCount: item.request_count
        } as CallsDataProps,
        latencyData: {
            ts: item.time_bin,
            generationTimeP50: item.generation_time_p50,
            generationTimeP95: item.generation_time_p95
        } as LatencyDataProps,
        throughputData: {
            ts: item.time_bin,
            tokensPerSecP50: item.tokens_per_sec_p50,
            tokensPerSecP95: item.tokens_per_sec_p95
        } as ThroughputDataProps
    }));

    const calls = formattedMetrics.map(item => item.callsData);
    const tokens = formattedMetrics.map(item => item.tokenData);
    const latency = formattedMetrics.map(item => item.latencyData);
    const throughput = formattedMetrics.map(item => item.throughputData);

    return NextResponse.json({ calls, tokens, latency, throughput });
}