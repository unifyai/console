import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

async function getAuthClient() {
    const credentialsValue = process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
    if (!credentialsValue) {
        throw new Error("COMMS_SERVICE_ACCOUNT_CREDENTIALS environment variable not set.");
    }
    
    let credentials;
    try {
        credentials = JSON.parse(credentialsValue);
    } catch (e) {
        try {
            const credentialsFile = fs.readFileSync(credentialsValue, 'utf8');
            credentials = JSON.parse(credentialsFile);
        } catch (fileError) {
            throw new Error("Invalid Pub/Sub credentials.");
        }
    }

    const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/pubsub'],
        projectId: credentials.project_id
    });

    return { client: await auth.getClient(), projectId: credentials.project_id };
}

export async function GET(
    request: NextRequest,
    { params }: { params: { assistantId: string } }
) {
    const { assistantId } = params;
    
    if (!assistantId) {
        return new NextResponse("Assistant ID is required.", { status: 400 });
    }

    // 1. Setup Auth and Config
    let authClient: any;
    let projectId: string;
    let subscriptionUrl: string;

    try {
        const authData = await getAuthClient();
        authClient = authData.client;
        projectId = authData.projectId;

        const orchestraUrl = process.env.ORCHESTRA_URL || "";
        const isStaging = orchestraUrl.includes("staging");
        const subscriptionName = `unity-${assistantId}${isStaging ? '-staging' : ''}-outbound-sub`;
        
        subscriptionUrl = `https://pubsub.googleapis.com/v1/projects/${projectId}/subscriptions/${subscriptionName}`;
    } catch (error: any) {
        console.error(`[SSE] Setup error:`, error);
        return new NextResponse(JSON.stringify({ detail: "Server configuration error." }), { status: 500 });
    }

    const stream = new ReadableStream({
        async start(controller) {
            console.log(`[SSE] Connected to ${subscriptionUrl} via REST`);
            
            // Keep-alive loop to prevent load balancer timeouts
            const keepAliveInterval = setInterval(() => {
                if (request.signal.aborted) {
                    clearInterval(keepAliveInterval);
                    return;
                }
                try { controller.enqueue(': keep-alive\n\n'); } catch (e) {}
            }, 15000);

            // --- MAIN LOOP ---
            while (!request.signal.aborted) {
                try {
                    // 2. HTTP PULL Request
                    // We use the authClient.request helper which handles the Bearer token automatically
                    const res = await authClient.request({
                        url: `${subscriptionUrl}:pull`,
                        method: 'POST',
                        data: {
                            maxMessages: 1,      // Fetch only 1 to prevent hoarding
                            returnImmediately: false // Enable Long Polling (wait for data)
                        },
                        validateStatus: () => true // Handle 400s manually
                    });

                    if (res.status !== 200) {
                        // If 404, subscription might not exist yet. 
                        // If 500/429, back off briefly.
                        if (res.status === 404) {
                            console.error(`[SSE] Subscription not found: ${subscriptionUrl}`);
                            controller.error("Subscription not found");
                            break;
                        }
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }

                    const receivedMessages = res.data.receivedMessages || [];

                    for (const item of receivedMessages) {
                        const { ackId, message } = item;
                        if (!message) continue;

                        // 3. Check Abort BEFORE Processing
                        if (request.signal.aborted) {
                            console.log("[SSE] Client aborted. NACKing message via modifyAckDeadline.");
                            // Explicit NACK (REST)
                            await authClient.request({
                                url: `${subscriptionUrl}:modifyAckDeadline`,
                                method: 'POST',
                                data: { ackIds: [ackId], ackDeadlineSeconds: 0 }
                            }).catch(() => {}); // Ignore errors on exit
                            break;
                        }

                        // 4. Process Message
                        try {
                            const rawData = Buffer.from(message.data, 'base64').toString('utf-8');
                            let payload: any = {};
                            try { payload = JSON.parse(rawData); } catch (e) { payload = { raw_content: rawData }; }

                            // Inject ID/Time
                            const serverId = message.messageId;
                            const publishTime = message.publishTime;

                            payload.id = serverId;
                            payload.publishTime = publishTime;
                            if (payload.event && typeof payload.event === 'object') {
                                payload.event.id = serverId;
                                payload.event.publishTime = publishTime;
                            }

                            controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);

                            // 5. ACK (REST)
                            await authClient.request({
                                url: `${subscriptionUrl}:acknowledge`,
                                method: 'POST',
                                data: { ackIds: [ackId] }
                            });

                        } catch (err) {
                            console.error("[SSE] Error processing, NACKing:", err);
                            // NACK on error
                            await authClient.request({
                                url: `${subscriptionUrl}:modifyAckDeadline`,
                                method: 'POST',
                                data: { ackIds: [ackId], ackDeadlineSeconds: 0 }
                            }).catch(() => {});
                        }
                    }

                } catch (error: any) {
                    if (!request.signal.aborted) {
                        console.error("[SSE] REST Pull Error:", error.message);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }

            clearInterval(keepAliveInterval);
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Content-Encoding': 'none'
        },
    });
}