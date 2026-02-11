'use client';

/**
 * Demo Instructions Dialog
 *
 * Explains the demo flow to demoers - how to conduct a product demo
 * using a demo assistant.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { BookOpen, Phone, User, MessageSquare, CheckCircle2 } from 'lucide-react';

interface InstructionsDialogProps {
  children?: React.ReactNode;
}

export default function DemoInstructionsDialog({ children }: InstructionsDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Instructions
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Demo Flow Instructions
          </DialogTitle>
          <DialogDescription>
            How to conduct a product demonstration using demo assistants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overview */}
          <section>
            <h3 className="text-h3 mb-2">Overview</h3>
            <p className="text-body-muted">
              Demo assistants allow you to showcase the product to prospects before they sign up.
              The assistant runs in demo mode with a limited spending cap.
            </p>
          </section>

          {/* Demo Steps */}
          <section>
            <h3 className="text-h3 mb-3">Demo Steps</h3>
            <div className="space-y-4">
              <Step
                number={1}
                icon={<Phone className="h-4 w-4" />}
                title="Create the Demo Assistant"
                description="Create a demo assistant from a source assistant. This will be the assistant that will be used to conduct the demo."
              />
              <Step
                number={2}
                icon={<Phone className="h-4 w-4" />}
                title="Call the Assistant"
                description="Call the demo assistant from your registered phone number (demoer phone). This introduces you as the Unify colleague."
              />
              <Step
                number={3}
                icon={<User className="h-4 w-4" />}
                title="Introduce the Prospect"
                description="Introduce the prospect to the assistant and tell it to call them using the prospect's phone number. Something like: Richard's number is +447700900123. Give him a call and introduce yourself."
              />
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-h3 mb-2">Tips</h3>
            <ul className="text-body-muted list-inside list-disc space-y-1">
              <li>Your account is billed for the usage so adjust the spending cap as needed.</li>
              <li>Remember to delete unused demo assistants to keep the list clean</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StepProps {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function Step({ number, icon, title, description }: StepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="text-title flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {number}
        </div>
        <div className="mt-1 h-full w-px bg-border" />
      </div>
      <div className="pb-4">
        <div className="text-semibold flex items-center gap-2">
          {icon}
          {title}
        </div>
        <p className="text-body-muted mt-1">{description}</p>
      </div>
    </div>
  );
}
