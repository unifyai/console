'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/UI/checkbox';
import { Label } from '@/components/UI/label';
import { Mail, CheckCircle } from 'lucide-react';
import { MailingList } from '@/lib/loops';

interface NewsletterPreferencesFormProps {
  onSubmit: (subscriptions: string[]) => void;
  onSkip: () => void;
  onValidationChange: (isValid: boolean) => void;
  initialData?: string[];
  error?: string | null;
  isSubmitting?: boolean;
}

const newsletters: Omit<MailingList, 'isPublic'>[] = [
  {
    id: 'cmbyni4qq1tio0ivlfdfo3qj2',
    name: 'Unify Updates',
    description: 'Get updated on our quarterly launches and new features.',
  },
  {
    id: 'cmbyno89p018e0jxsd5698x12',
    name: 'Unify Launches',
    description: 'Be the first to know about new product launches.',
  },
];

export default function NewsletterPreferencesForm({
  onSubmit,
  onSkip,
  onValidationChange,
  initialData = [],
  error,
  isSubmitting = false,
}: NewsletterPreferencesFormProps) {
  const [subscriptions, setSubscriptions] = useState<string[]>(initialData);

  const handleSubscriptionChange = (newsletterId: string, checked: boolean) => {
    setSubscriptions((prev) =>
      checked ? [...prev, newsletterId] : prev.filter((id) => id !== newsletterId)
    );
  };

  useEffect(() => {
    onValidationChange(true);
  }, [onValidationChange]);

  useEffect(() => {
    setSubscriptions(initialData);
  }, [initialData]);

  return (
    <div className="w-full space-y-8">
      <div className="mb-6 flex items-center space-x-3">
        <Mail className="h-6 w-6 text-primary" />
        <p className="text-body-lg-muted">Stay updated with the latest from Unify.</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {newsletters.map((newsletter) => (
            <div
              key={newsletter.id}
              className="hover:bg-accent/10 flex items-start space-x-4 rounded-xl border p-6 transition-colors"
            >
              <Checkbox
                id={newsletter.id}
                checked={subscriptions.includes(newsletter.id)}
                onCheckedChange={(checked) => handleSubscriptionChange(newsletter.id, !!checked)}
                className="mt-1 h-5 w-5"
              />
              <div className="min-w-0 flex-1">
                <Label htmlFor={newsletter.id} className="text-h2 text-semibold cursor-pointer">
                  {newsletter.name}
                </Label>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  {newsletter.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {subscriptions.length > 0 && (
          <div className="flex items-center space-x-3 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-body text-strong text-success">
              {subscriptions.filter((sub) => newsletters.some((n) => n.id === sub)).length}{' '}
              newsletter
              {subscriptions.filter((sub) => newsletters.some((n) => n.id === sub)).length !== 1
                ? 's'
                : ''}{' '}
              selected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
