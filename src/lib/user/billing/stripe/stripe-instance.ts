import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      // Updated to the newest Stripe API version as of 2025-06-30
      apiVersion: '2025-06-30.basil' as any,
    })
  : undefined;