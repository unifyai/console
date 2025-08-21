"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "../../UI/card";
import { Button } from "../../UI/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Personal",
    price: "Free",
    features: ["Your personal assistant", "Pay as you go"],
    buttonText: "Current Plan",
    buttonVariant: "default",
  },
  {
    name: "Professional",
    price: "$40 per seat per month",
    features: [
      "Everything in Personal +",
      "Up to 10 assistants",
      "Developer platform to edit:",
      "- Tasks & schedules",
      "- Memories & knowledge",
      "- Plans & functions",
    ],
    buttonText: "Upgrade Plan",
    buttonVariant: "outline",
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    features: [
      "Everything in Professional +",
      "Unlimited assistants",
      "On Prem deployment",
      "Support and Services",
    ],
    buttonText: "Get In Touch",
    buttonVariant: "outline",
  },
];

const FeatureItem = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start">
    <Check className="w-5 h-5 mr-2 text-primary flex-shrink-0 mt-1" />
    <span className="text-sm text-muted-foreground">{children}</span>
  </li>
);

const Main = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">Select Your Plan</CardTitle>
        <CardDescription>
          Hire, customize and manage your team of AI assistants with plans that fit your needs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {plans.map((plan, index) => (
            <Card key={index} className={`flex flex-col ${plan.name === 'Personal' ? 'border-primary' : ''}`}>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-lg font-semibold text-primary">{plan.price}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-4">
                  {plan.features.map((feature, featureIndex) => {
                    if (feature.startsWith("-")) {
                      return (
                        <li key={featureIndex} className="ml-8 text-sm text-muted-foreground">
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