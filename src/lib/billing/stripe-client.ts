/**
 * Browser-side Stripe.js loader.
 *
 * `loadStripe` is memoized so the script is fetched once per session. Only
 * the *publishable* key is used here (safe to expose); the secret key stays
 * on orchestra. Card data is captured by Stripe Elements iframes and never
 * touches our DOM or servers, which keeps us at PCI SAQ-A.
 */
import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}
