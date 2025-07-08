import { LabeledCheckbox } from "../../Common/Checkbox/Labeled"
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
        {id: "5557d764ba", label: "Product Launches", description: `Get updated on our quarterly launches.`},
        {id: "19d7b96a24", label: "Paper Reading Group", description: `Get updated on our weekly reading groups.`},
        {id: "c13433a863", label: "Weekly Webinars", description: `Get updated on our weekly webinars.`},
        {id: "aeb897777c", label: "New Features", description: `Get updated on our weekly feature releases.`}
    ];
    const subscription = (index:number, newsletter: {id: string, label: string, description: string}) => 
        <LabeledCheckbox 
            key={index}
            id={newsletter.label} 
            checked={subscriptions.includes(newsletter.id)} 
            onCheckedChange={(checked) => updateCheckedItems(subscriptions, newsletter.id, checked)}
            label={newsletter.label}
            description={newsletter.description}
            descriptionOnHover={true}
        />;
    
    return (
        <div className="tutorial-newsletter-preferences mt-4">
            <p className="font-bold mt-4">Edit your newsletter subscriptions</p>
            <div className="flex flex-col gap-4 mt-4">
            {newsletters.map((newsletter, index) => (
                <div key={index} className="transition-all duration-300">
                    {subscription(index, newsletter)}
                </div>
            ))}
            </div>
        </div>
    )
}

export default NewsletterPreferences;
