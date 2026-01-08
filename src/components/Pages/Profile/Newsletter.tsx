import { Checkbox } from '../../UI/checkbox';
import { Label } from '../../UI/label';
import { useEffect, useState } from 'react';
import { MailingList } from '@/lib/loops';
import { Loader2 } from 'lucide-react';

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

const NewsletterPreferences = ({
  subscriptions,
  handleSubscriptionChange,
}: {
  subscriptions: string[];
  handleSubscriptionChange: (value: string[]) => void;
}) => {
  const handleCheckboxChange = (id: string, checked: boolean) => {
    const newSubscriptions = checked
      ? [...subscriptions, id]
      : subscriptions.filter((sub) => sub !== id);
    handleSubscriptionChange(newSubscriptions);
  };

  return (
    <div className="mt-4">
      <p className="text-title">Newsletter Preferences</p>
      <div className="text-body mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {newsletters.map((newsletter) => (
          <div
            key={newsletter.id}
            className="flex items-start space-x-4 rounded-xl border border-gray-200 bg-transparent p-6 transition-colors hover:bg-neutral-100 dark:border-gray-700 dark:hover:bg-neutral-800"
          >
            <Checkbox
              id={newsletter.id}
              checked={subscriptions.includes(newsletter.id)}
              onCheckedChange={(checked) => handleCheckboxChange(newsletter.id, !!checked)}
              className="mt-1 h-5 w-5"
            />
            <div className="min-w-0 flex-1">
              <Label htmlFor={newsletter.id} className="text-title cursor-pointer">
                {newsletter.name}
              </Label>
              <p className="text-body mt-2 leading-relaxed text-muted-foreground">
                {newsletter.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsletterPreferences;
