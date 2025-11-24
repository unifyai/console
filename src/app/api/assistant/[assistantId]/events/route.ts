import { NextRequest, NextResponse } from 'next/server';
import { PubSub } from '@google-cloud/pubsub';
import fs from 'fs';

export const dynamic = 'force-dynamic';

async function getPubSubClient() {
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
            throw new Error("Server is misconfigured for real-time communication. COMMS_SERVICE_ACCOUNT_CREDENTIALS is not valid JSON or a valid file path.");
        }
    }
    if (!credentials || !credentials.project_id) {
         throw new Error("Invalid Pub/Sub credentials format.");
    }
    return new PubSub({
        projectId: credentials.project_id,
        credentials,
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: { assistantId: string } }
) {
    const { assistantId } = params;
    
    if (!assistantId) {
        return new NextResponse("Assistant ID is required.", { status: 400 });
    }

    try {
        const pubsub = await getPubSubClient();
        const orchestraUrl = process.env.ORCHESTRA_URL || "";
        const isStaging = orchestraUrl.includes("staging");
        
        const subscriptionName = `unity-${assistantId}${isStaging ? '-staging' : ''}-outbound-sub`;
        
        const subscription = pubsub.subscription(subscriptionName, {
            flowControl: {
                maxMessages: 1,
                allowExcessMessages: false
            }
        });

        const stream = new ReadableStream({
            async start(controller) {
                console.log(`[SSE] Starting stream for subscription: ${subscriptionName}`);
                
                const [exists] = await subscription.exists();
                if (!exists) {
                     console.error(`[SSE] Subscription ${subscriptionName} does not exist.`);
                     const errorPayload = JSON.stringify({ detail: "Server configuration error: Real-time messaging subscription not found." });
                     controller.enqueue(`event: error\ndata: ${errorPayload}\n\n`);
                     controller.close();
                     return;
                }

                const messageHandler = (message: any) => {
                    if (request.signal.aborted) {
                        message.nack();
                        return;
                    }

                    try {
                        const rawData = message.data.toString('utf8');
                        let payload: any = {};
                        
                        try {
                            payload = JSON.parse(rawData);
                        } catch (e) {
                            console.error("Failed to parse message data JSON:", e);
                            payload = { raw_content: rawData };
                        }

                        const serverId = message.id;
                        const publishTime = message.publishTime?.toISOString() || new Date().toISOString();

                        payload.id = serverId;
                        payload.publishTime = publishTime;

                        if (payload.event && typeof payload.event === 'object') {
                            payload.event.id = serverId;
                            payload.event.publishTime = publishTime;
                        }

                        const enrichedData = JSON.stringify(payload);
                        
                        controller.enqueue(`data: ${enrichedData}\n\n`);
                        
                        message.ack();
                    } catch (error) {
                        console.error(`[SSE] Error processing message ${message.id}:`, error);
                        message.nack(); 
                    }
                };

                const errorHandler = (error: any) => {
                    console.error(`[SSE] Pub/Sub error on subscription ${subscriptionName}:`, error);
                    if (!request.signal.aborted) {
                        try {
                            const errorPayload = JSON.stringify({ detail: "A server-side error occurred with the real-time connection." });
                            controller.enqueue(`event: error\ndata: ${errorPayload}\n\n`);
                        } catch(e) {}
                    }
                };

                subscription.on('message', messageHandler);
                subscription.on('error', errorHandler);

                const keepAliveInterval = setInterval(() => {
                    if (request.signal.aborted) {
                        clearInterval(keepAliveInterval);
                        return;
                    }
                    try {
                        controller.enqueue(': keep-alive\n\n');
                    } catch (e) {
                         clearInterval(keepAliveInterval);
                    }
                }, 20000);

                request.signal.addEventListener('abort', async () => {
                    console.log(`[SSE] Client disconnected from ${subscriptionName}.`);
                    clearInterval(keepAliveInterval);                    
                    subscription.removeListener('message', messageHandler);
                    subscription.removeListener('error', errorHandler);
                    try { 
                        await subscription.close();
                        console.log(`[SSE] Subscription ${subscriptionName} closed successfully.`);
                    } catch(e) {
                        console.error("Error closing subscription:", e);
                    }
                    try { controller.close(); } catch (e) {}
                });
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error(`[SSE] Setup error for assistant ${assistantId}:`, error);
        return new NextResponse(
            JSON.stringify({ detail: error.message || "Failed to establish real-time connection." }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}