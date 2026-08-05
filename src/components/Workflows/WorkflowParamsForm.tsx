'use client';

import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Textarea } from '@/components/UI/textarea';
import { Switch } from '@/components/UI/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import type { WorkflowParam } from '@/types/workflows';

export type WorkflowParamValues = Record<string, string | number | boolean>;

/**
 * Install-time settings. Rendered identically before and after install — the same
 * form, with the same help text, so "reconfigure" is not a different mental model
 * from "set up".
 *
 * Required params BLOCK install (the button disables and names the missing field).
 * Required *connections* do not — see WorkflowStateBanners.
 */
export function WorkflowParamsForm({
  params,
  values,
  onChange,
  disabled,
}: {
  params: WorkflowParam[];
  values: WorkflowParamValues;
  onChange: (name: string, value: string | number | boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {params.map((param) => {
        const id = `workflow-param-${param.name}`;
        const value = values[param.name];
        return (
          <div key={param.name} className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="flex items-center gap-1.5">
              {param.label}
              {param.required ? (
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              ) : (
                <span className="text-caption font-normal">optional</span>
              )}
            </Label>

            {param.type === 'select' && (
              <Select
                value={String(value ?? '')}
                disabled={disabled}
                onValueChange={(next) => onChange(param.name, next)}
              >
                <SelectTrigger id={id}>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {(param.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {param.type === 'text' && (
              <Input
                id={id}
                value={String(value ?? '')}
                placeholder={param.placeholder}
                disabled={disabled}
                onChange={(event) => onChange(param.name, event.target.value)}
              />
            )}

            {param.type === 'textarea' && (
              <Textarea
                id={id}
                rows={3}
                value={String(value ?? '')}
                placeholder={param.placeholder}
                disabled={disabled}
                onChange={(event) => onChange(param.name, event.target.value)}
              />
            )}

            {param.type === 'number' && (
              <div className="flex items-center gap-2">
                <Input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  className="max-w-[120px]"
                  value={String(value ?? '')}
                  disabled={disabled}
                  onChange={(event) => onChange(param.name, event.target.value)}
                />
                {param.suffix && <span className="text-caption">{param.suffix}</span>}
              </div>
            )}

            {param.type === 'boolean' && (
              <Switch
                id={id}
                checked={Boolean(value)}
                disabled={disabled}
                onCheckedChange={(next) => onChange(param.name, next)}
              />
            )}

            <p className="text-caption">{param.help}</p>
          </div>
        );
      })}
    </div>
  );
}

export function missingRequiredParams(
  params: WorkflowParam[],
  values: WorkflowParamValues
): WorkflowParam[] {
  return params.filter((param) => param.required && !String(values[param.name] ?? '').trim());
}
