import { LabeledCheckbox } from "../Common/Checkbox/Labeled"
import { CheckedState } from "@radix-ui/react-checkbox"

const NewsletterPreferences = ({subscriptions, handleSubscriptionChange}: {
    subscriptions: string[],
    handleSubscriptionChange: (value: string[]) => void
}) => {
    const updateCheckedItems = (subscriptions: string[], id: string, checked: CheckedState) => {
        let newSubscriptions: string[];
        if (checked) 
            newSubscriptions = [...subscriptions, id]
        else 
            newSubscriptions = subscriptions.filter(sub => sub != id)
        handleSubscriptionChange(newSubscriptions)
    }
    const newsletters = [
        {id: "5557d764ba", label: "Launch Updates", description: `Stay updated with our biggest releases. Don't miss the latest in LLM evaluation with Unify.`},
        {id: "19d7b96a24", label: "Paper Reading Group", description: `Get a bi-weekly plan for the next paper reading sessions, featuring cutting-edge LLM research.`},
        {id: "c13433a863", label: "Weekly Webinar Series", description: `Get notified with our upcoming webinars and online events with the community.`},
        {id: "aeb897777c", label: "Weekly Changelog", description: `Get notified with our upcoming webinars and online events with the community.`}
    ];
    const subscription = (index:number, newsletter: {id: string, label: string, description: string}) => 
        <LabeledCheckbox 
            key={index}
            id={newsletter.label} 
            checked={subscriptions.includes(newsletter.id)} 
            onCheckedChange={(checked) => updateCheckedItems(subscriptions, newsletter.id, checked)}
            label={newsletter.label}
            description={newsletter.description}
        />;
    
    return (
        <div className="tutorial-newsletter-preferences mt-4">
          <p className="font-bold mt-4">Edit your newsletter subscriptions</p>
          <div className="flex flex-col gap-4 mt-4">
            {newsletters.map((newsletter, index) =>  subscription(index, newsletter))}
          </div>
        </div>
    )
}

export default NewsletterPreferences;
