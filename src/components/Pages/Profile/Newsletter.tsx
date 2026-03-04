import { Checkbox } from '../../UI/checkbox';
import { Label } from '../../UI/label';

export interface Newsletter {
  id: string;
  name: string;
  description: string;
}

const NewsletterPreferences = ({
  newsletters,
  subscriptions,
  handleSubscriptionChange,
}: {
  newsletters: Newsletter[];
  subscriptions: string[];
  handleSubscriptionChange: (value: string[]) => void;
}) => {
  const handleCheckboxChange = (id: string, checked: boolean) => {
    const newSubscriptions = checked
      ? [...subscriptions, id]
      : subscriptions.filter((sub) => sub !== id);
    handleSubscriptionChange(newSubscriptions);
  };

  if (newsletters.length === 0) return null;

  return (
    <div className="text-body w-full mt-4 grid grid-cols-1 gap-6">
      {newsletters.map((newsletter) => (
        <div
          key={newsletter.id}
          className="flex w-full items-start justify-between space-x-4 rounded-xl border border-gray-200 bg-transparent p-6 transition-colors hover:bg-neutral-100 dark:border-gray-700 dark:hover:bg-neutral-800"
        >
          <div className="min-w-0 flex-1">
            <Label htmlFor={newsletter.id} className="text-title cursor-pointer">
              {newsletter.name}
            </Label>
            <p className="text-caption leading-relaxed text-muted-foreground">
              {newsletter.description}
            </p>
          </div>
          <Checkbox
            id={newsletter.id}
            checked={subscriptions.includes(newsletter.id)}
            onCheckedChange={(checked) => handleCheckboxChange(newsletter.id, !!checked)}
            className="mt-0.5 h-4 w-4"
          />
        </div>
      ))}
    </div>
  );
};

export default NewsletterPreferences;
