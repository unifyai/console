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
    const startTime = url.searchParams.get("startTime") || undefined;
    const endTime = url.searchParams.get("endTime") || undefined;
    const models = url.searchParams.get("models") || undefined;
    const providers = url.searchParams.get("providers") || undefined;
    const interval = url.searchParams.get("interval") || "300";
    const secondaryUserId = url.searchParams.get("secondaryUserId") || undefined;

    const metrics = await getQueryMetrics(apiKey, startTime, endTime, models, providers, interval, secondaryUserId);

    const formattedMetrics = metrics.map((item: MetricItem) => ({
        tokenData: {
            ts: item.timeBin,
            totalCompletionTokens: item.totalCompletionTokens,
            totalPromptTokens: item.totalPromptTokens
        } as TokensDataProps,
        callsData: {
            ts: item.timeBin,
            requestCount: item.requestCount
        } as CallsDataProps,
        latencyData: {
            ts: item.timeBin,
            generationTimeP50: item.generationTimeP50,
            generationTimeP95: item.generationTimeP95
        } as LatencyDataProps,
        throughputData: {
            ts: item.timeBin,
            tokensPerSecP50: item.tokensPerSecP50,
            tokensPerSecP95: item.tokensPerSecP95
        } as ThroughputDataProps
    }));

    const calls = formattedMetrics.map(item => item.callsData);
    const tokens = formattedMetrics.map(item => item.tokenData);
    const latency = formattedMetrics.map(item => item.latencyData);
    const throughput = formattedMetrics.map(item => item.throughputData);

    return NextResponse.json({ calls, tokens, latency, throughput });
}