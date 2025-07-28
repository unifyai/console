"use client";

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
    id: "cmbyni4qq1tio0ivlfdfo3qj2",
    name: "Unify Updates",
    description: "Get updated on our quarterly launches and new features."
  },
  {
    id: "cmbyno89p018e0jxsd5698x12",
    name: "Unify Launches",
    description: "Be the first to know about new product launches."
  }
];

export default function NewsletterPreferencesForm({ 
  onSubmit, 
  onSkip,
  onValidationChange,
  initialData = [],
  error,
  isSubmitting = false 
}: NewsletterPreferencesFormProps) {
  const [subscriptions, setSubscriptions] = useState<string[]>(initialData);

  const handleSubscriptionChange = (newsletterId: string, checked: boolean) => {
    setSubscriptions(prev => 
      checked 
        ? [...prev, newsletterId]
        : prev.filter(id => id !== newsletterId)
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
      <div className="flex items-center space-x-3 mb-6">
        <Mail className="h-6 w-6 text-primary" />
        <p className="text-base text-muted-foreground">
          Stay updated with the latest from Unify.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {newsletters.map((newsletter) => (
            <div key={newsletter.id} className="flex items-start space-x-4 p-6 border rounded-xl hover:bg-accent/10 transition-colors">
              <Checkbox
                id={newsletter.id}
                checked={subscriptions.includes(newsletter.id)}
                onCheckedChange={(checked) => handleSubscriptionChange(newsletter.id, !!checked)}
                className="mt-1 h-5 w-5"
              />
              <div className="flex-1 min-w-0">
                <Label htmlFor={newsletter.id} className="font-semibold cursor-pointer text-lg">
                  {newsletter.name}
                </Label>
                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                  {newsletter.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {subscriptions.length > 0 && (
          <div className="flex items-center space-x-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-base font-medium text-green-500">
              {subscriptions.filter(sub => newsletters.some(n => n.id === sub)).length} newsletter{subscriptions.filter(sub => newsletters.some(n => n.id === sub)).length !== 1 ? 's' : ''} selected
            </span>
          </div>
        )}
      </div>
    </div>
  );
} 