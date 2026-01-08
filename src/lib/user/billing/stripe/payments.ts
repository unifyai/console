import Stripe from 'stripe';
import { createRecharge } from '@/lib/user/billing/billing';

export async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const userID = session.metadata?.userID;

  if (session.payment_status === 'paid') {
    const amountPaid = session.amount_total;
    const paymentIntent = session.payment_intent;

    try {
      if (amountPaid === null) {
        console.error('Failed to add credits: Amount paid is null');
        return;
      }
      if (paymentIntent === null) {
        console.error('Failed to add credits: Payment Intent is null');
        return;
      }
      const creditsToAdd = amountPaid / 100;
      const transactionId =
        typeof paymentIntent === 'string' ? paymentIntent : 'transaction_id_here';
      if (userID) {
        let response = await createRecharge(userID, creditsToAdd, 'payment', transactionId);
      } else {
        console.error('Failed to add credits: User ID is null');
      }
    } catch (error) {
      console.error('Failed to add credits:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  }
}
