'use client';

import { ReactNode, useState } from 'react';
import React from 'react';
import { Plus } from 'lucide-react';
import { ResponseProps } from '@/types/common';
import BaseDialog from './Base';
import SubmitButton from '../Buttons/Submit';
import RetryButton from '../Buttons/Retry';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Form } from '@/components/UI/form';
import SettingButton from '../Buttons/Setting';
import { useKey } from 'react-use';
import { isImeComposing } from '@/utils/keyboard';

export default function CreateDialog({
  type,
  creationFunction,
  CreateSchema,
  form,
  Fields,
  extraFormActions,
  customOpen,
  setCustomOpen,
  disabled,
  text,
  variant = 'outline',
}: {
  type: string;
  creationFunction: (...args: any[]) => Promise<ResponseProps>;
  CreateSchema: z.ZodObject<any>;
  form: UseFormReturn<any>;
  Fields: ReactNode;
  extraFormActions?: (data: z.infer<typeof CreateSchema>) => void;
  customOpen?: boolean;
  setCustomOpen?: (open: boolean) => any;
  disabled?: boolean;
  text?: string;
  variant?: 'outline' | 'ghost';
}) {
  // Define messages
  const messages = {
    success: `Successfully created ${type}! Reloading the page...`,
    error: `We encountered some issue when creating your ${type}. Please try again`,
    tooltip: `Create ${type}`,
  };

  // Handle submission
  const [error, setError] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const onSubmit = (data: z.infer<typeof CreateSchema>) => {
    setLoading(true);
    creationFunction(...Object.values(data)).then((response) => {
      if ('info' in response) {
        setSuccess(true);
        if (extraFormActions) extraFormActions(data);
        window.location.reload();
      } else {
        setError(true);
        setLoading(false);
      }
    });
  };

  // Dialog state and content
  const [internalOpen, setInternalOpen] = useState(false);
  const open = customOpen == undefined ? internalOpen : customOpen;
  const setOpen = setCustomOpen == undefined ? setInternalOpen : setCustomOpen;
  const onOpen = () => {
    setOpen(!open);
  };

  const tooltip = `Create ${type}`;
  const button = (
    <SettingButton
      icon={<Plus />}
      onClick={onOpen}
      tooltip={tooltip}
      disabled={disabled}
      text={text}
      variant={variant}
    />
  );

  const title = tooltip;
  const body = (
    <div className="text-body">
      {success ? messages['success'] : error ? messages['error'] : Fields}
    </div>
  );
  const footer = success ? null : error ? (
    <RetryButton onClick={() => setError(false)} />
  ) : (
    <SubmitButton
      text="Create"
      disabled={loading}
      onClick={(form as any).handleSubmit(onSubmit)}
      loading={loading}
    />
  );

  // Hotkey to trigger form submission when pressing enter. This listens on the
  // document, so it also sees the Enter an IME uses to commit a conversion in
  // one of the dialog's own fields — filter those out.
  useKey(
    (event) => event.key === 'Enter' && !isImeComposing(event),
    () => {
      (form as any).handleSubmit(onSubmit)();
    }
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <BaseDialog
          button={button}
          title={title}
          body={body}
          footer={footer}
          open={open}
          setOpen={setOpen}
          disabled={disabled}
        />
      </form>
    </Form>
  );
}
