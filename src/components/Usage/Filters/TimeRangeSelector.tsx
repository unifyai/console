import React from 'react';
import { format, parse } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Calendar } from '@/components/UI/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';

interface TimeRangeSelectorProps {
  startDate: string | undefined;
  endDate: string | undefined;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  className?: string;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  startDate,
  endDate,
  onDateRangeChange,
  className,
}) => {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined,
    to: endDate ? parse(endDate, 'yyyy-MM-dd', new Date()) : undefined,
  });

  const handleDateChange = (range: DateRange | undefined) => {
    console.log(range);
    setDate(range);
    if (range?.from && range?.to) {
      const start = format(range.from, 'yyyy-MM-dd');
      const end = format(range.to, 'yyyy-MM-dd');
      onDateRangeChange(start, end);
    }
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              'w-full justify-start text-left',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} -{' '}
                  {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto h-auto p-0" align="end">
        <Calendar
            mode="range"
            selected={date}
            onSelect={handleDateChange}
            className="rounded-md border"
            classNames={{
              day_today: "text-primary font-bold",
            }}
            initialFocus
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};