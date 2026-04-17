'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types/user';
import UserInfo from '@/components/Pages/Profile/Info';
import SecondaryButton from '../../Common/Buttons/Secondary';
import PrimaryButton from '../../Common/Buttons/Primary';
import { toast } from 'sonner';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Combobox } from '@/components/UI/Combobox';
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';
import ProfilePhoto from './ProfilePhoto';

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

const ProfileForm = ({ user, onPrem }: { user: User; onPrem: string | undefined }) => {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(() => buildFormState(user));
  const [initialFormState, setInitialFormState] = useState<FormState>(() => buildFormState(user));

  // Pending photo (preview only until save)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Derive changeMade from state comparison instead of tracking manually
  const changeMade = useMemo(() => {
    if (pendingPhoto) return true;
    return (Object.keys(formState) as (keyof FormState)[]).some(
      (key) => formState[key] !== initialFormState[key]
    );
  }, [formState, initialFormState, pendingPhoto]);

  const handlePhotoSelect = useCallback((file: File) => {
    setPendingPhoto(file);
    setPendingPhotoPreview(URL.createObjectURL(file));
  }, []);

  // Sync form state when user prop changes (e.g. after server-side refresh)
  useEffect(() => {
    const next = buildFormState(user);
    setInitialFormState(next);
    setFormState(next);
  }, [user]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormState((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleTimezoneChange = useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, timezone: value }));
  }, []);

  const handleCancel = useCallback(() => {
    setFormState(initialFormState);
    setPendingPhoto(null);
    setPendingPhotoPreview(null);
  }, [initialFormState]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const formEl = e.currentTarget as HTMLFormElement;
    setIsSaving(true);
    const minDelay = new Promise((r) => setTimeout(r, 800));

    if (pendingPhoto) {
      const photoFormData = new FormData();
      photoFormData.append('file', pendingPhoto);
      const photoRes = await fetch('/api/user/photo/upload', {
        method: 'POST',
        body: photoFormData,
      });
      if (!photoRes.ok) {
        toast.error('Error uploading photo.');
        setIsSaving(false);
        return;
      }
      setPendingPhoto(null);
    }

    const formData = new FormData(formEl);
    formData.append('timezone', formState.timezone);

    const profileResponse = await fetch('/api/profile/updateUser', {
      method: 'POST',
      body: formData,
    });

    await minDelay;

    if (profileResponse.ok) {
      toast.success('Profile updated successfully!');
      setInitialFormState({ ...formState });
      router.refresh();
    } else {
      const data = await profileResponse.json().catch(() => null);
      toast.error(data?.error || 'Error updating profile.');
    }
    setIsSaving(false);
  };

  return (
    <div className="mt-10 w-full sm:mt-0">
      <form onSubmit={handleSave}>
        <div className="mb-6 flex items-center gap-5">
          <MemoizedProfilePhoto
            user={user}
            onFileSelect={handlePhotoSelect}
            previewUrl={pendingPhotoPreview}
          />
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <Label>First Name</Label>
              <Input
                type="text"
                name="name"
                value={formState.name}
                className="w-full"
                onChange={handleInputChange}
                readOnly={Boolean(onPrem)}
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
                readOnly={Boolean(onPrem)}
              />
            </div>
            <div>
              <Label>Timezone</Label>
              <TimezoneSelect
                value={formState.timezone}
                onValueChange={handleTimezoneChange}
                disabled={Boolean(onPrem)}
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
                readOnly={Boolean(onPrem)}
              />
            </div>
          </div>
        </div>
        <UserInfo bio={formState.bio} handleInputChange={handleInputChange} onPrem={onPrem} />
        {changeMade && (
          <div className="mt-5 flex w-fit gap-2">
            <SecondaryButton onClick={handleCancel} disabled={!changeMade} label="Cancel" />
            <PrimaryButton
              type="submit"
              disabled={!changeMade || isSaving}
              isLoading={isSaving}
              label={changeMade ? 'Save' : 'Saved'}
            />
          </div>
        )}
      </form>
    </div>
  );
};

export default ProfileForm;
