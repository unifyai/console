'use client';

import { useState } from 'react';
import { Endpoint } from '@/types/chat/endpoints';
import { BasePopover } from '@/components/Common/Popovers/Base';
import ActionButton from '@/components/Common/Buttons/Action';
import { Checkbox } from '@/components/UI/checkbox';

import { Filter } from 'lucide-react';
import { CheckedState } from '@radix-ui/react-checkbox';
import { Options } from 'nuqs';

const ProviderFilter = ({
  endpoints,
  excludedProviders,
  setProviderFilterParam,
}: {
  endpoints: Endpoint[];
  excludedProviders: string[];
  setProviderFilterParam: (
    value: string | ((old: string | null) => string | null) | null,
    options?: Options
  ) => Promise<URLSearchParams>;
}) => {
  const providers = Array.from(new Set(endpoints.map((endpoint) => endpoint.provider)))
    .filter((provider) => provider != 'unify') // (Temporary: Remove Routers)
    .sort();
  const onSelection = (value: CheckedState, provider: string) => {
    if (!value) setProviderFilterParam([...excludedProviders, provider].join(','));
    else {
      const newExcludedProviders = excludedProviders.filter((excluded) => excluded != provider);
      setProviderFilterParam(
        newExcludedProviders.length > 0 ? newExcludedProviders.join(',') : null
      );
    }
  };

  const allChecked = excludedProviders.length != providers.length;
  return (
    <BasePopover button={<ActionButton icon={<Filter />} tooltip="Filter providers" />}>
      <div className="flex items-center gap-2 space-x-2">
        <Checkbox
          id={'All providers'}
          checked={allChecked}
          onCheckedChange={() =>
            !allChecked ? setProviderFilterParam(null) : setProviderFilterParam(providers.join(','))
          }
          aria-label={`Select all providers`}
        />
        <p className="font-bold">{allChecked ? 'Hide all' : 'Show all'}</p>
      </div>
      {providers.map((provider, index) => {
        const checked = !excludedProviders.includes(provider);
        return (
          <div className="flex items-center space-x-2" key={index}>
            <Checkbox
              id={provider}
              checked={checked}
              onCheckedChange={(value) => onSelection(value, provider)}
              aria-label={`Select ${provider}`}
            />
            <p>{provider}</p>
          </div>
        );
      })}
    </BasePopover>
  );
};

export default ProviderFilter;
