'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import SecondaryButton from '@/components/Common/Buttons/Secondary';
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';
import { toast } from 'sonner';
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
  const router = useRouter();
  const [orgName, setOrgName] = useState(currentName);
  const [timezone, setTimezone] = useState(currentTimezone || '');

  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const timezoneOptions = useMemo(() => generateTimezoneOptions(), []);

  const hasChanges =
    orgName !== currentName || timezone !== (currentTimezone || '') || pendingPhoto !== null;

  const handlePhotoSelect = (file: File) => {
    setPendingPhoto(file);
    setPendingPhotoPreview(URL.createObjectURL(file));
  };

  const handleCancel = () => {
    setOrgName(currentName);
    setTimezone(currentTimezone || '');
    setPendingPhoto(null);
    setPendingPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !hasChanges) return;

    setIsSaving(true);
    const minDelay = new Promise((r) => setTimeout(r, 800));
    try {
      if (pendingPhoto) {
        const formData = new FormData();
        formData.append('file', pendingPhoto);
        const res = await fetch(`/api/organization/photo/upload?orgId=${orgId}`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.detail || 'Failed to upload photo.');
          return;
        }
        setPendingPhoto(null);
        router.refresh();
      }

      if (orgName !== currentName || timezone !== (currentTimezone || '')) {
        onUpdate(orgName, timezone || null);
      }

      await minDelay;
      toast.success('Settings saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="organization-settings-tab">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-5">
          <OrgPhoto
            orgName={currentName}
            currentImage={currentImage}
            onFileSelect={handlePhotoSelect}
            previewUrl={pendingPhotoPreview}
          />
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

        {hasChanges && (
          <div className="flex w-fit gap-2">
            <SecondaryButton onClick={handleCancel} disabled={isSaving} label="Cancel" />
            <PrimaryButton
              label="Save"
              type="submit"
              disabled={!orgName.trim() || isSaving}
              isLoading={isSaving}
            />
          </div>
        )}
      </form>
    </div>
  );
};

export default OrganizationSettingsTab;
