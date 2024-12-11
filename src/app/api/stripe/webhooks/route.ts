import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import Stripe from 'stripe';
import { stripe } from '@/lib/user/billing/stripe/stripe-instance';
import { handleCheckoutSessionCompleted } from '@/lib/user/billing/stripe/payments';

/**
 * Converts a Readable stream to a Buffer.
 * @param {Readable} readable Readable stream
 * @returns {Promise<Buffer>} Buffer containing the contents of the stream
 */
async function buffer(readable: Readable): Promise<Buffer> {
    const chunks = [];
    console.log('Stripe webhook received, converting readable stream to buffer');
    for await (const chunk of readable) {
        console.log('Chunk of type', typeof chunk, 'was read');
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    console.log('Concatenating chunks');
    return Buffer.concat(chunks);
}

/**
 * Verifies the signature of a Stripe webhook request.
 * @param {NextRequest} req NextRequest object containing the webhook request
 * @param {string} sig Signature of the webhook request
 * @returns {Promise<Stripe.Event>} The validated Stripe event
 * @throws {Error} If Stripe is not initialized
 */
async function verifyStripeSignature(req: NextRequest, sig: string): Promise<Stripe.Event> {
    if (!stripe) {
        throw new Error('Stripe is not initialized. Check your environment variables.');
    }
    console.log('Verifying webhook signature');
    const body = await buffer(req.body as any as Readable);
    console.log('Stripe webhook body:', body.toString());
    return stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
}

/**
 * Handles a Stripe webhook request.
 *
 * @param {NextRequest} req NextRequest object containing the webhook request
 * @returns {Promise<NextResponse>} NextResponse object containing the response
 *
 * If Stripe is not initialized, returns a 500 error.
 * If the stripe-signature header is missing, returns a 400 error.
 * If the webhook signature verification fails, returns a 400 error with the error message.
 * If the event is of type checkout.session.completed, processes the event and returns a 200 response.
 * For all other event types, returns a 200 response without processing the event.
 */
export async function POST(req: NextRequest) {
    console.log('Stripe webhook received');

    if (!stripe) {
        return NextResponse.json({ error: 'Stripe is not initialized. Check your environment variables.' }, { status: 500 });
    }

    const sig = req.headers.get('stripe-signature');
    if (!sig) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = await verifyStripeSignature(req, sig);
        console.log('Verified webhook signature');
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            console.log(`Processing event type: ${event.type}, ID: ${event.id}`);
            try {
                await handleCheckoutSessionCompleted(event);
                console.log('Checkout session completed');
            } catch (error) {
                console.error('Error handling checkout session:', error);
                return NextResponse.json({ error: 'Failed to process checkout session' }, { status: 500 });
            }
            break;
        }
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    console.log('Returning response');
    return NextResponse.json({ received: true }, { status: 200 });
}
