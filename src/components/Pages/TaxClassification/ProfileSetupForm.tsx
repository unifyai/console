"use client";

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { User } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/UI/select';
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';

interface ProfileData {
  name: string;
  last_name: string;
  job_title: string;
  bio: string;
  timezone: string;
}

interface ProfileSetupFormProps {
  onSubmit: (data: ProfileData) => void;
  onValidationChange: (isValid: boolean) => void;
  initialData?: ProfileData;
  error?: string | null;
  isLoading?: boolean;
}

interface ProfileSetupFormHandle {
  submit: () => void;
}

const ProfileSetupForm = forwardRef<ProfileSetupFormHandle, ProfileSetupFormProps>(
  ({ onSubmit, onValidationChange, initialData, isLoading, error }, ref) => {
    const [formData, setFormData] = useState({
      name: '',
      last_name: '',
      job_title: '',
      bio: '',
      timezone: '',
      ...initialData
    });

    const timezoneOptions = useMemo(() => generateTimezoneOptions(), []);

    useImperativeHandle(ref, () => ({
      submit: () => {
        if (isFormValid()) {
          onSubmit(formData);
        }
      }
    }));

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isFormValid = useCallback(() => {
    return formData.name.trim() !== '' && formData.last_name.trim() !== '';
  }, [formData]);

  // Effect to update form data when initialData changes and auto-detect timezone if missing
  useEffect(() => {
    if (initialData) {
      // If initialData has a timezone, use it.
      // If not, fall back to current formData timezone (which might be user edited or empty).
      // If both are empty, try to detect from browser.
      let newTimezone = initialData.timezone || formData.timezone;
      if (!newTimezone) {
        newTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      }

      setFormData(prev => ({
        ...prev, 
        ...initialData,
        timezone: newTimezone
      }));
    }
  }, [initialData]);

  // Effect to update validation state
  useEffect(() => {
    const valid = isFormValid();
    onValidationChange(valid);
  }, [formData, onValidationChange, isFormValid]);

  return (
      <div className="w-full space-y-8">
        <div className="flex items-center space-x-3 mb-6">
        <User className="h-6 w-6 text-primary" />
        <p className="text-base text-muted-foreground">
          {(initialData?.name || initialData?.last_name || initialData?.job_title || initialData?.bio) 
            ? "Please review and update your profile information as needed."
            : "Let's start by getting to know you."
          }
        </p>
      </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label htmlFor="name" className="text-base font-medium">First Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter your first name"
              required
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="last_name" className="text-base font-medium">Last Name *</Label>
            <Input
              id="last_name"
              value={formData.last_name}
              onChange={(e) => handleInputChange('last_name', e.target.value)}
              placeholder="Enter your last name"
              required
              className="h-12 text-base"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="job_title" className="text-base font-medium">Job Title (Optional)</Label>
          <Input
            id="job_title"
            value={formData.job_title}
            onChange={(e) => handleInputChange('job_title', e.target.value)}
            placeholder="e.g., Software Engineer, Data Scientist, Product Manager"
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="bio" className="text-base font-medium">About (Optional)</Label>
          <Input
            id="bio"
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            placeholder="e.g., Data Scientist passionate with AI and analytics"
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="timezone" className="text-base font-medium">Timezone</Label>
          <Select 
            value={formData.timezone} 
            onValueChange={(val) => handleInputChange('timezone', val)}
          >
            <SelectTrigger id="timezone" className="h-12 text-base">
              <SelectValue placeholder="Select a timezone..." />
            </SelectTrigger>
            <SelectContent>
              {timezoneOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
} 
);

ProfileSetupForm.displayName = 'ProfileSetupForm';

export default ProfileSetupForm;