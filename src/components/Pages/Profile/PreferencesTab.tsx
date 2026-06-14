'use client';

import { useState, useEffect, useMemo } from 'react';
import NewsletterPreferences, { type Newsletter } from './Newsletter';
import PrimaryButton from '../../Common/Buttons/Primary';
import SecondaryButton from '../../Common/Buttons/Secondary';
import { Loader } from '@/components/Common/Loader';
import { toast } from 'sonner';

const PreferencesTab = () => {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [initialSubscriptions, setInitialSubscriptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const response = await fetch('/api/loops/subscribe?getSubscriptions=true');
        if (response.ok) {
          const data = await response.json();
          setSubscriptions(data.subscriptions);
          setInitialSubscriptions(data.subscriptions);
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

  const hasChanges = useMemo(() => {
    if (subscriptions.length !== initialSubscriptions.length) return true;
    const initialSubsSet = new Set(initialSubscriptions);
    return !subscriptions.every((sub) => initialSubsSet.has(sub));
  }, [subscriptions, initialSubscriptions]);

  const handleCancel = () => {
    setSubscriptions([...initialSubscriptions]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/loops/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailingLists: subscriptions }),
      });

      if (response.ok) {
        setInitialSubscriptions([...subscriptions]);
        toast.success('Preferences updated successfully!');
      } else {
        toast.error('Error updating newsletter preferences.');
      }
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-10 flex items-center justify-center sm:mt-0">
        <Loader size={24} />
      </div>
    );
  }

  return (
    <div className="mt-10 w-full sm:mt-0">
      <NewsletterPreferences
        newsletters={newsletters}
        subscriptions={subscriptions}
        handleSubscriptionChange={setSubscriptions}
      />
      {hasChanges && (
        <div className="mt-5 flex w-fit gap-2">
          <SecondaryButton onClick={handleCancel} disabled={!hasChanges} label="Cancel" />
          <PrimaryButton
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            label={isSaving ? 'Saving...' : 'Save'}
          />
        </div>
      )}
    </div>
  );
};

export default PreferencesTab;
