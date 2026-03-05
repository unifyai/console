'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import PrimaryButton from '@/components/Common/Buttons/Primary';
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';
import OrgPhoto from './OrgPhoto';

interface OrganizationSettingsTabProps {
  orgId: number;
  currentName: string;
  currentImage?: string | null;
  currentTimezone?: string | null;
  onUpdate: (name: string, timezone?: string | null) => void;
}

const OrganizationSettingsTab = ({
  orgId,
  currentName,
  currentImage,
  currentTimezone,
  onUpdate,
}: OrganizationSettingsTabProps) => {
  const [orgName, setOrgName] = useState(currentName);
  const [timezone, setTimezone] = useState(currentTimezone || '');

  const timezoneOptions = useMemo(() => generateTimezoneOptions(), []);

  const hasChanges = orgName !== currentName || timezone !== (currentTimezone || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orgName.trim() && hasChanges) {
      onUpdate(orgName, timezone || null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="organization-settings-tab">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-5">
          <OrgPhoto orgId={orgId} orgName={currentName} currentImage={currentImage} />
          <div className="flex min-w-0 flex-1 flex-col gap-x-4 gap-y-3">
            <div>
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="org-timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="org-timezone">
                  <SelectValue placeholder="Select a timezone..." />
                </SelectTrigger>
                <SelectContent>
                  {timezoneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-start">
          <PrimaryButton
            label="Save Changes"
            type="submit"
            disabled={!orgName.trim() || !hasChanges}
          />
        </div>
      </form>
    </div>
  );
};

export default OrganizationSettingsTab;
