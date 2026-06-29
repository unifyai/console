'use client';

import { useState, useEffect, useCallback } from 'react';
import NewsletterPreferences, { type Newsletter } from './Newsletter';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';
import { useAutoSave } from '@/hooks/Account/useAutoSave';
import { SaveStatus } from './SaveStatus';

export function ProfileNewsletterSection() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const response = await fetch('/api/loops/subscribe?getSubscriptions=true');
        if (response.ok) {
          const data = await response.json();
          setSubscriptions(data.subscriptions);
          setNewsletters(data.newsletters);
        }
      } catch (error) {
        console.error('Error fetching subscriptions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubscriptions();
  }, []);

  const persistSubscriptions = useCallback(async (mailingLists: string[]): Promise<boolean> => {
    const response = await fetch('/api/loops/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailingLists }),
    }).catch(() => null);
    return !!response?.ok;
  }, []);

  const { status, save } = useAutoSave(
    persistSubscriptions,
    'Could not save your preferences. Please try again.'
  );

  const handleSubscriptionChange = useCallback(
    (next: string[]) => {
      setSubscriptions(next);
      void save(next);
    },
    [save]
  );

  if (isLoading) {
    return <SectionBodySkeleton className="max-w-2xl" />;
  }

  if (newsletters.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 border-t border-border pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-title">Email updates</h3>
          <p className="text-caption text-muted-foreground">
            Choose which product and release emails you receive.
          </p>
        </div>
        <SaveStatus status={status} />
      </div>
      <NewsletterPreferences
        newsletters={newsletters}
        subscriptions={subscriptions}
        handleSubscriptionChange={handleSubscriptionChange}
      />
    </div>
  );
}
