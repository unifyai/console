import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    const apiKey = request.headers.get("apiKey");
    if (!apiKey) {
        return NextResponse.json({ detail: "API key is missing" }, { status: 401 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        console.error("Failed to parse JSON body in POST /api/assistant/voice/generate:", error);
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    try {
        const orchestraResponse = await fetch(
            `${ORCHESTRA_BASE_URL}/assistant/voice/generate`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "accept": "application/octet-stream, application/json", 
                },
                body: JSON.stringify(requestBody),
            }
        );

        if (!orchestraResponse.ok) {
            let errorDetailMessage = "Failed to generate speech via backend service.";
            try {
                const errorData = await orchestraResponse.json();
                if (errorData.detail) {
                    if (typeof errorData.detail === 'string') {
                        errorDetailMessage = errorData.detail;
                    } else if (Array.isArray(errorData.detail)) {
                        // Format FastAPI validation errors
                        errorDetailMessage = errorData.detail.map((err: any) => {
                            const field = err.loc && err.loc.length > 1 ? err.loc.slice(1).join('.') : (err.loc && err.loc[0]) || 'body';
                            return `${field}: ${err.msg}`;
                        }).join("; ");
                    } else if (typeof errorData.detail === 'object') {
                        errorDetailMessage = JSON.stringify(errorData.detail);
                    }
                }
                console.error(`[API PROXY /api/assistant/voice/generate] Backend Error (${orchestraResponse.status}):`, errorData);
            } catch (e) {
                const textError = await orchestraResponse.text();
                errorDetailMessage = textError || errorDetailMessage;
                console.error(`[API PROXY /api/assistant/voice/generate] Backend Error (${orchestraResponse.status}): Non-JSON response: ${textError}`);
            }
            return NextResponse.json({ detail: errorDetailMessage }, { status: orchestraResponse.status });
        }

        const audioBlob = await orchestraResponse.blob();
        const contentType = orchestraResponse.headers.get("content-type") || "application/octet-stream";

        return new NextResponse(audioBlob, {
            status: 200,
            headers: { "Content-Type": contentType },
        });

    } catch (error: any) {
        console.error("[API PROXY /api/assistant/voice/generate] Error proxying to backend:", error);
        return NextResponse.json({ detail: "Failed to connect to speech generation service", errorDetails: error.message }, { status: 503 });
    }
}