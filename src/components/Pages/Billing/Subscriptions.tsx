'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '../../UI/card';
import { Button } from '../../UI/button';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Personal',
    price: 'Free',
    features: ['Your personal assistant', 'Pay as you go'],
    buttonText: 'Current Plan',
    buttonVariant: 'default',
  },
  {
    name: 'Professional',
    price: '$40 per seat per month',
    features: [
      'Everything in Personal +',
      'Up to 10 assistants',
      'Developer platform to edit:',
      '- Tasks & schedules',
      '- Memories & knowledge',
      '- Plans & functions',
    ],
    buttonText: 'Upgrade Plan',
    buttonVariant: 'outline',
  },
  {
    name: 'Enterprise',
    price: 'Talk to us',
    features: [
      'Everything in Professional +',
      'Unlimited assistants',
      'On Prem deployment',
      'Support and Services',
    ],
    buttonText: 'Get In Touch',
    buttonVariant: 'outline',
  },
];

const FeatureItem = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start">
    <Check className="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-primary" />
    <span className="text-body text-muted-foreground">{children}</span>
  </li>
);

const Main = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-h3">Select Your Plan</CardTitle>
        <CardDescription className="text-body">
          Hire, customize and manage your team of AI assistants with plans that fit your needs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`flex flex-col ${plan.name === 'Personal' ? 'border-primary' : ''}`}
            >
              <CardHeader className="text-center">
                <CardTitle className="text-title">{plan.name}</CardTitle>
                <CardDescription className="text-title text-primary">{plan.price}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-4">
                  {plan.features.map((feature, featureIndex) => {
                    if (feature.startsWith('-')) {
                      return (
                        <li key={featureIndex} className="text-body ml-8 text-muted-foreground">
                          {feature}
                        </li>
                      );
                    }
                    return <FeatureItem key={featureIndex}>{feature}</FeatureItem>;
                  })}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.name === 'Personal' ? (
                  <Button className="w-full" variant={plan.buttonVariant as any} disabled>
                    {plan.buttonText}
                  </Button>
                ) : (
                  <Button className="w-full" variant={plan.buttonVariant as any}>
                    {plan.buttonText}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default Main;
