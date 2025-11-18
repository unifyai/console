import { NextRequest, NextResponse } from 'next/server';
import { PubSub } from '@google-cloud/pubsub';
import fs from 'fs';

export const dynamic = 'force-dynamic'; // Prevent caching of this route

async function getPubSubClient() {
    const credentialsValue = process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
    if (!credentialsValue) {
        throw new Error("COMMS_SERVICE_ACCOUNT_CREDENTIALS environment variable not set.");
    }

    // First, try to parse the env var as a raw JSON string.
    // If parsing fails, assume it's a file path.
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
        const subscription = pubsub.subscription(subscriptionName);

        const stream = new ReadableStream({
            async start(controller) {
                console.log(`[SSE] Starting stream for subscription: ${subscriptionName}`);
                
                const [exists] = await subscription.exists();
                if (!exists) {
                     console.error(`[SSE] Subscription ${subscriptionName} does not exist. Cannot establish connection.`);
                     const errorPayload = JSON.stringify({ detail: "Server configuration error: Real-time messaging subscription not found." });
                     controller.enqueue(`event: error\ndata: ${errorPayload}\n\n`);
                     controller.close();
                     return;
                }

                const messageHandler = (message: any) => {
                    message.ack();
                    const data = message.data.toString('utf8');
                    controller.enqueue(`data: ${data}\n\n`);
                };

                const errorHandler = (error: any) => {
                    console.error(`[SSE] Pub/Sub error on subscription ${subscriptionName}:`, error);
                    // Send a specific error event to the client to notify them of the issue
                    const errorPayload = JSON.stringify({ detail: "A server-side error occurred with the real-time connection. The connection may be unstable." });
                    controller.enqueue(`event: error\ndata: ${errorPayload}\n\n`);
                };

                subscription.on('message', messageHandler);
                subscription.on('error', errorHandler);


                const keepAliveInterval = setInterval(() => {
                    controller.enqueue(': keep-alive\n\n');
                }, 20000);

                request.signal.addEventListener('abort', () => {
                    console.log(`[SSE] Client disconnected from ${subscriptionName}. Cleaning up.`);
                    clearInterval(keepAliveInterval);
                    subscription.removeListener('message', messageHandler);
                    subscription.removeListener('error', errorHandler);
                    controller.close();
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
        console.error(`[SSE] Failed to set up SSE stream for assistant ${assistantId}:`, error);
        return new NextResponse(
            JSON.stringify({ detail: error.message || "Failed to establish real-time connection." }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}