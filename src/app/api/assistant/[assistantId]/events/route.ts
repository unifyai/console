import { NextRequest, NextResponse } from 'next/server';
import { v1 } from '@google-cloud/pubsub';
import fs from 'fs';

export const dynamic = 'force-dynamic';

function getClientConfig() {
    const credentialsValue = process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
    if (!credentialsValue) {
        throw new Error("COMMS_SERVICE_ACCOUNT_CREDENTIALS environment variable not set.");
    }
    let credentials;
    try {
        credentials = JSON.parse(credentialsValue);
    } catch (e) {
        console.log("Could not parse COMMS_SERVICE_ACCOUNT_CREDENTIALS as JSON, treating as a file path.");
        try {
            const credentialsFile = fs.readFileSync(credentialsValue, 'utf8');
            credentials = JSON.parse(credentialsFile);
        } catch (fileError) {
            console.error("Failed to load or parse Pub/Sub credentials from path:", credentialsValue, fileError);
            throw new Error("Server is misconfigured. COMMS_SERVICE_ACCOUNT_CREDENTIALS is invalid.");
        }
    }
    if (!credentials || !credentials.project_id) {
         throw new Error("Invalid Pub/Sub credentials format.");
    }
    return {
        projectId: credentials.project_id,
        credentials,
    };
}

export async function GET(
    request: NextRequest,
    { params }: { params: { assistantId: string } }
) {
    const { assistantId } = params;
    
    if (!assistantId) {
        return new NextResponse("Assistant ID is required.", { status: 400 });
    }

    let subClient: v1.SubscriberClient | null = null;
    let subscriptionPath = "";

    try {
        const config = getClientConfig();
        subClient = new v1.SubscriberClient(config);
        
        const orchestraUrl = process.env.ORCHESTRA_URL || "";
        const isStaging = orchestraUrl.includes("staging");
        const subscriptionName = `unity-${assistantId}${isStaging ? '-staging' : ''}-outbound-sub`;
        
        subscriptionPath = subClient.subscriptionPath(config.projectId, subscriptionName);        
        try {
            await subClient.getSubscription({ subscription: subscriptionPath });
        } catch (e: any) {
            console.error(`[SSE] Subscription ${subscriptionName} not found or error:`, e.message);
            // We continue; if it doesn't exist, the pull will fail downstream which is handled.
        }

    } catch (error: any) {
        console.error(`[SSE] Setup error for assistant ${assistantId}:`, error);
        return new NextResponse(
            JSON.stringify({ detail: error.message || "Failed to establish real-time connection." }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const stream = new ReadableStream({
        async start(controller) {
            console.log(`[SSE] Starting Synchronous Pull loop for: ${subscriptionPath}`);
            const keepAliveInterval = setInterval(() => {
                if (request.signal.aborted) {
                    clearInterval(keepAliveInterval);
                    return;
                }
                try { controller.enqueue(': keep-alive\n\n'); } catch (e) {}
            }, 15000);
            while (!request.signal.aborted) {
                try {

                    const [response] = await subClient!.pull({
                        subscription: subscriptionPath,
                        maxMessages: 1, 
                        returnImmediately: false, 
                    });

                    const messages = response.receivedMessages || [];

                    for (const receivedMessage of messages) {
                        const msg = receivedMessage.message;
                        const ackId = receivedMessage.ackId;

                        if (!msg || !ackId) continue;

                        // 1. Check if client disconnected while we were waiting
                        if (request.signal.aborted) {
                            console.log("[SSE] Client disconnected. NACKing message immediately.");
                            // Explicit NACK: Release message instantly so the next connection gets it.
                            await subClient!.modifyAckDeadline({
                                subscription: subscriptionPath,
                                ackIds: [ackId],
                                ackDeadlineSeconds: 0 
                            });
                            break; // Exit loop
                        }

                        // 2. Process and Send
                        try {
                            const rawData = msg.data ? msg.data.toString() : "{}";
                            let payload: any = {};
                            try { payload = JSON.parse(rawData); } catch (e) { payload = { raw_content: rawData }; }

                            // Handle Timestamp conversion from Protobuf (seconds/nanos) to ISO string
                            let publishTimeStr = new Date().toISOString();
                            if (msg.publishTime && msg.publishTime.seconds) {
                                const millis = Number(msg.publishTime.seconds) * 1000;
                                publishTimeStr = new Date(millis).toISOString();
                            }

                            const serverId = msg.messageId || "unknown-id";

                            // Inject ID/Time
                            payload.id = serverId;
                            payload.publishTime = publishTimeStr;
                            if (payload.event && typeof payload.event === 'object') {
                                payload.event.id = serverId;
                                payload.event.publishTime = publishTimeStr;
                            }

                            controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);

                            // 3. Acknowledge (ACK)
                            await subClient!.acknowledge({
                                subscription: subscriptionPath,
                                ackIds: [ackId]
                            });
                        } catch (processingError) {
                            console.error("[SSE] Error processing message, NACKing:", processingError);
                            // If we fail to parse/send, NACK it so it retries.
                            await subClient!.modifyAckDeadline({
                                subscription: subscriptionPath,
                                ackIds: [ackId],
                                ackDeadlineSeconds: 0
                            });
                        }
                    }
                } catch (error: any) {
                    // Code 4 is DEADLINE_EXCEEDED (normal for long polling if no messages arrive)
                    // We just loop again.
                    if (error.code !== 4 && !request.signal.aborted) {
                        console.error("[SSE] Pull loop error:", error.message);
                        // Prevent tight loops on auth/config errors
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }

            // Cleanup
            clearInterval(keepAliveInterval);
            try { await subClient!.close(); } catch(e) {}
        },
        async cancel() {
            if (subClient) {
                try { await subClient.close(); } catch(e) {}
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}