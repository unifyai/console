"use server";

// app/api/stripe/webhook.tsx
import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { buffer } from "micro";
import { createRecharge } from "@/lib/user/billing/billing";
import { stripe } from "@/lib/user/billing/stripe/stripe-instance";
import { createError } from "micro";

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {


    if (req.method === "POST") {
        let event;

        try {
            if (!stripe) {
                throw new Error('Stripe is not initialized. Check your environment variables.');
            }
            const rawBody = await buffer(req);
            const sig = req.headers["stripe-signature"] || "";
            event = stripe.webhooks.constructEvent(rawBody.toString(), sig, process.env.STRIPE_WEBHOOK_SECRET_LIVE || "");
        } catch (err: any) {
            console.error("Error:", err.message);
            const errorMessage = `Webhook Error: ${err.message}`;
            return createError(400, errorMessage, err);
        }

        // Respond immediately to acknowledge receipt of the event
        res.status(200).json({ received: true });

        if (event.type === "checkout.session.completed") {
            return handleCheckoutSessionCompleted(event);            

        } 
        else {
            return res.json({ received: true });
        }
    } else {
        res.setHeader("Allow", "POST");
        return res.status(405).end("Method Not Allowed");
    }
}


async function handleCheckoutSessionCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    const userID = session.metadata?.user_id;

    if (session.payment_status === "paid") {
        const amountPaid = session.amount_total; // Amount paid in cents
        const paymentIntent = session.payment_intent;

        try {
            if (amountPaid === null) {
                console.error("Failed to add credits: Amount paid is null");
                return;
            }
            if (paymentIntent === null) {
                console.error("Failed to add credits: Payment Intent is null");
                return;
            }
            const creditsToAdd = amountPaid / 100;
            const transactionId = typeof paymentIntent === "string" ? paymentIntent : "transaction_id_here";
            if (userID) {
                let response = await createRecharge(userID, creditsToAdd, transactionId);
            } else {
                console.error("Failed to add credits: User ID is null");
            }
        } catch (error) {
            console.error("Failed to add credits:", error);
        }
    }
}
