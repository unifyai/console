'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { User } from '@/types/user';
import UserInfo from '@/components/Pages/Profile/Info';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Combobox } from '@/components/UI/Combobox';
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';
import ProfilePhoto from './ProfilePhoto';
import { useAutoSave } from '@/hooks/Account/useAutoSave';
import { SaveStatus } from './SaveStatus';
import { ProfileNewsletterSection } from './ProfileNewsletterSection';

const MemoizedProfilePhoto = memo(ProfilePhoto);

const TimezoneSelect = memo(function TimezoneSelect({
  value,
  onValueChange,
  disabled,
}: {
  value: string;
  onValueChange: (v: string) => void;
  disabled: boolean;
}) {
  const items = useMemo(
    () =>
      generateTimezoneOptions().map(({ value: v, label }) => ({
        value: v,
        label,
      })),
    []
  );

  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={onValueChange}
      placeholder="Select a timezone…"
      searchPlaceholder="Search timezones…"
      emptyMessage="No timezones match your search."
      disabled={disabled}
      className="w-full"
      popoverClassName="w-[--radix-popover-trigger-width]"
    />
  );
});

type FormState = {
  name: string;
  lastName: string;
  jobTitle: string;
  bio: string;
  timezone: string;
};

function buildFormState(user: User): FormState {
  return {
    name: user.name || '',
    lastName: user.lastName || '',
    jobTitle: user.jobTitle || '',
    bio: user.bio || '',
    timezone: user.timezone || '',
  };
}

const ProfileForm = ({ user, externalIdentity }: { user: User; externalIdentity: boolean }) => {
  const [formState, setFormState] = useState<FormState>(() => buildFormState(user));

  // Last value successfully persisted per field. A blur (or timezone change)
  // only triggers a write when the field actually differs from this, so we
  // never fire redundant saves for fields the user merely focused.
  const savedRef = useRef<FormState>(buildFormState(user));

  const saveFields = useCallback(async (partial: Partial<FormState>): Promise<boolean> => {
    const response = await fetch('/api/user/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    }).catch(() => null);
    return !!response?.ok;
  }, []);

  const { status, save } = useAutoSave(
    saveFields,
    'Could not save your profile. Please try again.'
  );

  // Sync local state when the user prop changes (e.g. after a server refresh).
  useEffect(() => {
    const next = buildFormState(user);
    setFormState(next);
    savedRef.current = next;
  }, [user]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormState((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const key = e.target.name as keyof FormState;
      const value = e.target.value;
      if (value === savedRef.current[key]) return;
      savedRef.current = { ...savedRef.current, [key]: value };
      void save({ [key]: value });
    },
    [save]
  );

  const handleTimezoneChange = useCallback(
    (value: string) => {
      setFormState((prev) => ({ ...prev, timezone: value }));
      if (value === savedRef.current.timezone) return;
      savedRef.current = { ...savedRef.current, timezone: value };
      void save({ timezone: value });
    },
    [save]
  );

  return (
    <div className="w-full sm:mt-0">
      <div className="mb-4 flex justify-end">
        <SaveStatus status={status} />
      </div>
      <div className="mb-6 flex items-center gap-5">
        <MemoizedProfilePhoto user={user} />
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <Label>First Name</Label>
            <Input
              type="text"
              name="name"
              value={formState.name}
              className="w-full"
              onChange={handleInputChange}
              onBlur={handleBlur}
              readOnly={externalIdentity}
            />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input
              type="text"
              name="lastName"
              value={formState.lastName}
              className="w-full"
              onChange={handleInputChange}
              onBlur={handleBlur}
              readOnly={externalIdentity}
            />
          </div>
          <div>
            <Label>Timezone</Label>
            <TimezoneSelect
              value={formState.timezone}
              onValueChange={handleTimezoneChange}
              disabled={externalIdentity}
            />
          </div>
          <div>
            <Label>Job Title</Label>
            <Input
              type="text"
              name="jobTitle"
              value={formState.jobTitle}
              className="w-full"
              onChange={handleInputChange}
              onBlur={handleBlur}
              readOnly={externalIdentity}
            />
          </div>
        </div>
      </div>
      <UserInfo
        bio={formState.bio}
        handleInputChange={handleInputChange}
        handleBlur={handleBlur}
        externalIdentity={externalIdentity}
      />
      <ProfileNewsletterSection />
    </div>
  );
};

export default ProfileForm;
