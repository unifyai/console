'use client';

import { useState, useEffect, useCallback } from 'react';
import NewsletterPreferences, { type Newsletter } from './Newsletter';
import { Loader } from '@/components/Common/Loader';
import { useAutoSave } from '@/hooks/Account/useAutoSave';
import { SaveStatus } from './SaveStatus';

const PreferencesTab = () => {
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
    return (
      <div className="mt-10 flex items-center justify-center sm:mt-0">
        <Loader size={24} />
      </div>
    );
  }

  return (
    <div className="mt-10 w-full sm:mt-0">
      <div className="flex justify-end">
        <SaveStatus status={status} />
      </div>
      <NewsletterPreferences
        newsletters={newsletters}
        subscriptions={subscriptions}
        handleSubscriptionChange={handleSubscriptionChange}
      />
    </div>
  );
};

export default PreferencesTab;
