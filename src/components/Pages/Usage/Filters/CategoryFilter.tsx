'use client';

import * as React from 'react';
import { Tag } from 'lucide-react';
import { Select, SelectContent, SelectTrigger } from '@/components/UI/select';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check } from 'lucide-react';
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  SPENDING_CATEGORIES,
  TransactionCategory,
} from '@/types/usage/transactions';

interface CategoryFilterProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function CategoryItem({
  value,
  label,
  description,
}: {
  value: string;
  label: string;
  description?: string;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="text-body relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <div className="flex flex-col">
        <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
        {description && <span className="text-caption">{description}</span>}
      </div>
    </SelectPrimitive.Item>
  );
}

export function CategoryFilter({ value, onChange, disabled = false }: CategoryFilterProps) {
  const displayText =
    value === 'all' ? 'All Spending' : (CATEGORY_LABELS[value as TransactionCategory] ?? value);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 w-[160px]" data-testid="category-filter">
        <Tag className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">{displayText}</span>
      </SelectTrigger>
      <SelectContent>
        <CategoryItem value="all" label="All Spending" description="All usage categories" />
        {SPENDING_CATEGORIES.map((key) => (
          <CategoryItem
            key={key}
            value={key}
            label={CATEGORY_LABELS[key]}
            description={CATEGORY_DESCRIPTIONS[key]}
          />
        ))}
      </SelectContent>
    </Select>
  );
}

export default CategoryFilter;
