"use client";

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { User } from 'lucide-react';

interface ProfileData {
  name: string;
  lastName: string;
  jobTitle: string;
  bio: string;
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
      lastName: '',
      jobTitle: '',
      bio: '',
      ...initialData
    });

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
    return formData.name.trim() !== '' && formData.lastName.trim() !== '';
  }, [formData]);

    // Effect to update form data when initialData changes
  useEffect(() => {
    if (initialData) {
        setFormData(prev => ({...prev, ...initialData}));
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
          {(initialData?.name || initialData?.lastName || initialData?.jobTitle || initialData?.bio) 
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
            <Label htmlFor="lastName" className="text-base font-medium">Last Name *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              placeholder="Enter your last name"
              required
              className="h-12 text-base"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="jobTitle" className="text-base font-medium">Job Title (Optional)</Label>
          <Input
            id="jobTitle"
            value={formData.jobTitle}
            onChange={(e) => handleInputChange('jobTitle', e.target.value)}
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
      </div>
    </div>
  );
} 
);

ProfileSetupForm.displayName = 'ProfileSetupForm';

export default ProfileSetupForm; 