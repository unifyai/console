import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2024-10-28.acacia', // Use the latest API version
}) : undefined;