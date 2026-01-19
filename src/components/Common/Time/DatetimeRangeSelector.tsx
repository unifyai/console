'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Calendar } from '@/components/UI/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { ScrollArea, ScrollBar } from '@/components/UI/scroll-area';

const hours = Array.from({ length: 24 }, (_, i) => i).reverse();
const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
const seconds = Array.from({ length: 60 }, (_, i) => i);
const dateformat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSS";

const TimeScroller = ({
  values,
  range,
  side,
  type,
  handleTimeChange,
}: {
  values: number[];
  range: DateRange | undefined;
  side: 'from' | 'to';
  type: 'hour' | 'minute' | 'second';
  handleTimeChange: (
    side: 'from' | 'to',
    type: 'hour' | 'minute' | 'second',
    value: string
  ) => void;
}) => {
  const date = side === 'from' ? range?.from : range?.to;
  let baseline, label;
  if (type === 'hour') {
    baseline = date?.getHours();
    label = (item: number) => item.toString().padStart(2, '0');
  } else if (type === 'minute') {
    baseline = date?.getMinutes();
    label = (item: number) => item;
  } else {
    baseline = date?.getSeconds();
    label = (item: number) => item.toString().padStart(2, '0');
  }

  return (
    <ScrollArea className="w-64 sm:w-auto">
      <div className="flex p-2 sm:flex-col">
        {values.map((value) => (
          <Button
            key={value}
            size="icon"
            variant={date && baseline === value ? 'default' : 'ghost'}
            className="aspect-square shrink-0 sm:w-full"
            onClick={() => handleTimeChange(side, type, value.toString())}
          >
            {label(value)}
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" className="sm:hidden" />
    </ScrollArea>
  );
};

export function DateTimeRangeSelector({
  startDate,
  endDate,
  onDateRangeChange,
  className,
}: {
  startDate: string | undefined;
  endDate: string | undefined;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  className?: string;
}) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: startDate ? parse(startDate, dateformat, new Date()) : undefined,
    to: endDate ? parse(endDate, dateformat, new Date()) : undefined,
  });

  const [isOpen, setIsOpen] = React.useState(false);

  const handleDateChange = (range: DateRange | undefined) => {
    setDate(range);

    if (range?.from && range?.to) {
      const start = format(range.from, dateformat);
      const end = format(range.to, dateformat);
      onDateRangeChange(start, end);
    }
  };

  const handleTimeChange = (
    side: 'from' | 'to',
    type: 'hour' | 'minute' | 'second',
    value: string
  ) => {
    const targetDate = side === 'from' ? date?.from : date?.to;
    if (targetDate) {
      const newDate = new Date(targetDate);
      if (type === 'hour') {
        newDate.setHours(parseInt(value));
      } else if (type === 'minute') {
        newDate.setMinutes(parseInt(value));
      } else if (type === 'second') {
        newDate.setSeconds(parseInt(value));
      }
      const newRange =
        side === 'from' ? { from: newDate, to: date?.to } : { from: date?.from, to: newDate };
      setDate(newRange);

      if (newRange?.from && newRange?.to) {
        const start = format(newRange.from, dateformat);
        const end = format(newRange.to, dateformat);
        onDateRangeChange(start, end);
      }
    }
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, dateformat)} - {format(date.to, dateformat)}
                </>
              ) : (
                format(date.from, dateformat)
              )
            ) : (
              <span>{dateformat}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <div className="sm:flex">
            {/* Start time area */}
            <div className="flex flex-col divide-y sm:h-[300px] sm:flex-row sm:divide-x sm:divide-y-0">
              <TimeScroller
                values={hours}
                range={date}
                side="from"
                type="hour"
                handleTimeChange={handleTimeChange}
              />
              <TimeScroller
                values={minutes}
                range={date}
                side="from"
                type="minute"
                handleTimeChange={handleTimeChange}
              />
              <TimeScroller
                values={seconds}
                range={date}
                side="from"
                type="second"
                handleTimeChange={handleTimeChange}
              />
            </div>

            {/* Date area */}
            <Calendar
              mode="range"
              selected={date}
              onSelect={handleDateChange}
              className="rounded-md border"
              classNames={{ day_today: 'text-primary font-medium' }}
              initialFocus
            />

            {/* End time area */}
            <div className="flex flex-col divide-y sm:h-[300px] sm:flex-row sm:divide-x sm:divide-y-0">
              <TimeScroller
                values={hours}
                range={date}
                side="to"
                type="hour"
                handleTimeChange={handleTimeChange}
              />
              <TimeScroller
                values={minutes}
                range={date}
                side="to"
                type="minute"
                handleTimeChange={handleTimeChange}
              />
              <TimeScroller
                values={seconds}
                range={date}
                side="to"
                type="second"
                handleTimeChange={handleTimeChange}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
