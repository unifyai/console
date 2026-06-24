'use client';

import { InfoSquareButton } from '@/components/UI/info-square-button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { RadioGroup, RadioGroupItem } from '@/components/UI/radio-group';
import type { DataSharingMode } from '@/types/organization';

interface OrganizationDataSharingChoiceProps {
  value: DataSharingMode;
  onChange: (value: DataSharingMode) => void;
  disabled?: boolean;
  testIdPrefix?: string;
}

const sharingCopy = [
  "By default, all skills acquired and knowledge retained are personal to each user's own private unity, with no ability for each unity to share knowledge, skills, or know-how. Each user's unity learns in isolation, based on that user alone. If you'd like the unitys to also have the option to read/write from a shared pool across the org where appropriate, select shared below.",
  'If you want more granular control, then it is best to set up dedicated teams. Users and unitys can then be assigned to teams to enable controlled sharing within specific teams, rather than blanket org-wide sharing. Selecting shared below effectively creates a new Org team and adds every person and unity to this team automatically.',
  'Even in shared mode, each unity will still carefully decide what is useful to share and what is best to keep personal. Transcripts, emails, and files are never shared. Only knowledge, skills, and general know-how are optionally shared to create a faster hive-mind approach to learning across the team.',
];

const options: Array<{
  value: DataSharingMode;
  title: string;
  description: string;
}> = [
  {
    value: 'private',
    title: 'Private',
    description: "Each user's unity learns from that user alone.",
  },
  {
    value: 'shared',
    title: 'Shared',
    description: 'Create an Org team for optional shared knowledge and skills.',
  },
];

const OrganizationDataSharingChoice = ({
  value,
  onChange,
  disabled = false,
  testIdPrefix = 'org-sharing',
}: OrganizationDataSharingChoiceProps) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-caption font-medium text-foreground">
          Would you like to share data across all org members?
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <InfoSquareButton data-testid={`${testIdPrefix}-info`} />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)]">
            <div className="flex flex-col gap-3">
              {sharingCopy.map((paragraph) => (
                <p key={paragraph} className="text-caption leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as DataSharingMode)}
        className="grid gap-2 sm:grid-cols-2"
        aria-label="Organization data sharing mode"
      >
        {options.map((option) => {
          const checked = value === option.value;
          const id = `${testIdPrefix}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                checked ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'border-border'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/50 hover:bg-muted/50'}`}
              data-testid={id}
            >
              <RadioGroupItem id={id} value={option.value} disabled={disabled} className="mt-0.5" />
              <span className="flex flex-col gap-1">
                <span className="text-body font-medium text-foreground">{option.title}</span>
                <span className="text-caption text-muted-foreground">{option.description}</span>
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
};

export default OrganizationDataSharingChoice;
