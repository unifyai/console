'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import type { IntegrationApiKeySchema } from '@/types/integrations';

export function ProviderApiKeyForm({
  schema,
  isSubmitting,
  onSubmit,
}: {
  schema: IntegrationApiKeySchema;
  isSubmitting?: boolean;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});

  const canSubmit = schema.fields.every((field) => !field.required || values[field.id]?.trim());

  return (
    <form
      className="space-y-3"
      data-testid="provider-api-key-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit || isSubmitting) return;
        onSubmit(values);
      }}
    >
      {schema.fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <Label htmlFor={`integration-api-key-${field.id}`}>
            {field.label}
            {!field.required && <span className="text-muted-foreground"> (optional)</span>}
          </Label>
          <Input
            id={`integration-api-key-${field.id}`}
            type={field.sensitive === false ? 'text' : 'password'}
            value={values[field.id] ?? ''}
            placeholder={field.maskedValueLabel || field.placeholder || 'Enter value'}
            onChange={(event) =>
              setValues((current) => ({ ...current, [field.id]: event.target.value }))
            }
            data-testid={`provider-api-key-field-${field.id}`}
          />
          {field.description && <p className="text-caption">{field.description}</p>}
        </div>
      ))}
      <Button
        type="submit"
        size="sm"
        disabled={!canSubmit || isSubmitting}
        data-testid="provider-api-key-submit"
      >
        {schema.submitLabel || 'Save credentials'}
      </Button>
    </form>
  );
}
