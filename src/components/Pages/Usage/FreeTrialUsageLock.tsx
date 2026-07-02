import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/UI/card';

const CONTACT_URL = 'https://cal.com/danlenton/15min';

const FreeTrialUsageLock = () => {
  return (
    <div className="flex h-[70vh] w-full items-center justify-center p-8">
      <Card className="max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pb-8 pt-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-h3">Usage is locked during your free trial</h2>
            <p className="text-body-muted">
              Usage tracking is available beyond the free trial.{' '}
              <a
                href={CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4 hover:text-primary-tint-80"
              >
                Get in touch
              </a>{' '}
              to unlock full access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FreeTrialUsageLock;
