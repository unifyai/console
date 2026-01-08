import React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from '@/components/UI/command';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover';
import { Button } from '@/components/UI/button';

interface ProviderSelectorProps {
  providers: string[];
  selectedProviders: string[];
  onProviderChange: (providers: string[]) => void;
  className?: string;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  providers,
  selectedProviders,
  onProviderChange,
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  // Filter providers based on the input value
  const filteredProviders = React.useMemo(() => {
    return providers.filter((provider) =>
      provider.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [providers, inputValue]);

  // Toggle provider selection
  const handleProviderToggle = (provider: string) => {
    const updatedProviders = selectedProviders.includes(provider)
      ? selectedProviders.filter((p) => p !== provider)
      : [...selectedProviders, provider];
    onProviderChange(updatedProviders);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-[200px] justify-between', className)}
        >
          {selectedProviders.length === 0
            ? 'Select providers...'
            : `${selectedProviders.length} provider${selectedProviders.length > 1 ? 's' : ''} selected`}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput
            placeholder="Search providers..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandGroup>
              {filteredProviders.map((provider) => (
                <CommandItem key={provider} onSelect={() => handleProviderToggle(provider)}>
                  <div className="flex items-center">
                    {selectedProviders.includes(provider) ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <div className="mr-2 h-4 w-4 rounded border border-gray-400" />
                    )}
                    <span>{provider}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
