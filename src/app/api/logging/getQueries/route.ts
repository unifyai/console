import { Query} from "@/types/usage";
import { getQueries } from "@/lib/unify-api/logging/query";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const apiKey = user.apiKey;

    const url = new URL(request.url);

    let tags: string | string[] | undefined = url.searchParams.get("tags") || undefined;
    let endpoints: string | string[] | undefined = url.searchParams.get("endpoints") || undefined;
    const startTime = url.searchParams.get("start_time") || undefined;
    const endTime = url.searchParams.get("end_time") || undefined;
    const pageNumber = parseInt(url.searchParams.get("page_number") || "1", 10);
    let failures = url.searchParams.get("failures");

    // Convert tags and endpoints to arrays if they're comma-separated strings
    if (typeof tags === 'string' && tags.includes(',')) tags = tags.split(',');
    if (typeof endpoints === 'string' && endpoints.includes(',')) endpoints = endpoints.split(',');

    // Convert failures to boolean or 'only'
    let failuresParam: boolean | 'only' = false;
    if (failures === 'true') failuresParam = true;
    else if (failures === 'only') failuresParam = 'only';

    const response = await getQueries(
        apiKey,
        tags,
        endpoints,
        startTime,
        endTime,
        pageNumber,
        failuresParam
    );

    const queries: Query[] = response.queries.map((item: any) => {
        const queryBody = JSON.parse(item.query_body);
        const responseBody = JSON.parse(item.response_body);
        const responseMessage = responseBody.choices[0].message?.content || responseBody.choices[0]?.delta?.content || "";
        return {
            endpoint: item.endpoint,
            messages: [...queryBody.messages, { "role": "assistant", "content": responseMessage }],
            tags: queryBody.tags,
            usage: responseBody.usage,
            at: item.at,
            credits: item.credits,
        };
    });

    return NextResponse.json({ queries: queries, totalPages: response.total_pages });
}