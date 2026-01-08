'use client';

import { ArrowUpDown, SortDesc, SortAsc, GripHorizontal } from 'lucide-react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/UI/accordion';
import { Button } from '@/components/UI/button';
import Tooltip from '@/components/Common/Misc/Tooltip';

const PlotSort = ({
  interactive = true,
  plotType,
  groupByProperty,
  sortBars,
  setSortBars,
}: {
  interactive?: boolean;
  plotType: string;
  groupByProperty: string | undefined;
  sortBars: string;
  setSortBars: (sortBars: string) => void;
}) => {
  // Only render sort selector for ungrouped bar charts
  if (plotType != 'Bar Chart' || groupByProperty) return null;

  // Define the sort options with their properties
  const sortOptions = [
    {
      key: 'unsorted',
      label: 'Unsorted',
      icon: <GripHorizontal />,
    },
    {
      key: 'asc',
      label: 'Ascending',
      icon: <SortAsc />,
    },
    {
      key: 'desc',
      label: 'Descending',
      icon: <SortDesc />,
    },
  ];

  // Find the current state object for display purposes
  const currentState = sortOptions.find((state) => state.key === sortBars) || sortOptions[0];

  // Function to generate the trigger text
  const triggerText = () => {
    return `Sort: ${currentState.label}`;
  };

  // Handler for selecting a sort option
  const onSelect = (key: string) => {
    if (!interactive || !setSortBars) return;
    setSortBars(key);
  };

  return (
    <AccordionItem value="plot-sort">
      <AccordionTrigger disabled={!interactive}>
        <Tooltip
          content="Sort bars based on the x axis values. Does not apply when grouping is set."
          side="left"
        >
          <div className="flex flex-row items-center gap-2">
            {currentState.key === 'unsorted' ? <ArrowUpDown size={20} /> : currentState.icon}
            {triggerText()}
          </div>
        </Tooltip>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-1 pr-2">
          {sortOptions.map((option) => (
            <Button
              key={option.key}
              variant={sortBars === option.key ? 'primary' : 'listItem'}
              size="lg"
              className="text-md flex h-auto w-full items-center justify-start gap-2 py-1"
              onClick={() => onSelect(option.key)}
              disabled={!interactive}
            >
              {option.icon}
              {option.label}
            </Button>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default PlotSort;
