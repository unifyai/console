/**
 * Shown on billing/usage pages when the billing feature is off for this
 * deployment (no payment processor configured — e.g. self-host BYOK, or any
 * install without Stripe/Orchestra billing). Named for the *capability* rather
 * than a deployment type: billing-off is not the same as "on-prem" (an on-prem
 * enterprise can still use managed Unify billing).
 */
import { KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/UI/card';

const BillingUnavailable = () => (
  <div className="flex h-[90vh] w-full items-center justify-center p-8">
    <Card className="max-w-md text-center">
      <CardContent className="flex flex-col items-center gap-4 pb-8 pt-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <KeyRound className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-h3">Billing isn&apos;t enabled on this deployment</h2>
          <p className="text-body-muted">
            This install runs on your own provider keys, so there are no credits or usage to manage
            here.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default BillingUnavailable;
