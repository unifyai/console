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

interface ModelSelectorProps {
  models: string[];
  selectedModels: string[];
  onModelChange: (models: string[]) => void;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModels,
  onModelChange,
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  // Filter models based on the input value
  const filteredModels = React.useMemo(() => {
    return models.filter((model) => model.toLowerCase().includes(inputValue.toLowerCase()));
  }, [models, inputValue]);

  // Toggle model selection
  const handleModelToggle = (model: string) => {
    const updatedModels = selectedModels.includes(model)
      ? selectedModels.filter((m) => m !== model)
      : [...selectedModels, model];
    onModelChange(updatedModels);
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
          {selectedModels.length === 0
            ? 'Select models...'
            : `${selectedModels.length} model${selectedModels.length > 1 ? 's' : ''} selected`}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput
            placeholder="Search models..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandGroup>
              {filteredModels.map((model) => (
                <CommandItem key={model} onSelect={() => handleModelToggle(model)}>
                  <div className="flex items-center">
                    {selectedModels.includes(model) ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <div className="mr-2 h-4 w-4 rounded border border-gray-400" />
                    )}
                    <span>{model}</span>
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
