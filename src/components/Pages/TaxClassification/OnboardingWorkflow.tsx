"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/UI/card';
import { Button } from '@/components/UI/button';
import { Progress } from '@/components/UI/progress';
import { Alert, AlertDescription } from '@/components/UI/alert';
import { CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import ProfileSetupForm from './ProfileSetupForm';
import TaxClassificationForm from './TaxClassificationForm';
import NewsletterPreferencesForm from './NewsletterPreferencesForm';
import LoadingScreen from '@/components/Layout/LoadingScreen';
import { TaxClassificationFormData, UserBusinessStatusResponse } from '@/types/user';
import { ScrollArea } from '@/components/UI/scroll-area';

interface ProfileData {
  name: string;
  last_name: string;
  job_title: string;
  bio: string;
  timezone: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  required: boolean;
}

// Define handle interfaces for form refs
interface FormHandle {
  submit: () => void;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'profile',
    title: 'Profile Setup',
    description: 'Tell us about yourself',
    required: true
  },
  {
    id: 'tax',
    title: 'Tax Classification',
    description: 'Set up your tax compliance',
    required: true
  },
  {
    id: 'newsletters',
    title: 'Stay Updated',
    description: 'Choose your newsletter preferences',
    required: false
  }
];

export default function OnboardingWorkflow() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    last_name: '',
    job_title: '',
    bio: '',
    timezone: ''
  });
  const [taxData, setTaxData] = useState<TaxClassificationFormData | null>(null);
  const [newsletterData, setNewsletterData] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingExistingData, setIsLoadingExistingData] = useState(true);
  const [existingUser, setExistingUser] = useState<any>(null);
  const [existingBusinessStatus, setExistingBusinessStatus] = useState<UserBusinessStatusResponse | null>(null);

  // Form validation states
  const [isProfileValid, setIsProfileValid] = useState(false);
  const [isTaxValid, setIsTaxValid] = useState(false);
  const [isNewsletterValid, setIsNewsletterValid] = useState(true); // Newsletter step is optional

  // Refs for forms
  const profileFormRef = useRef<FormHandle>(null);
  const taxFormRef = useRef<FormHandle>(null);

  const currentStepData = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  // Fetch existing user data on mount
  useEffect(() => {
    const fetchExistingData = async () => {
      setIsLoadingExistingData(true);
      let userData = null;
      let businessData = null;

      // Fetch user profile data with individual error handling
      try {
        const userResponse = await fetch('/api/user/profile');
        if (userResponse.ok) {
          userData = await userResponse.json();
          setExistingUser(userData);
          console.log('✅ Successfully fetched user profile data');
        } else {
          console.warn('⚠️ User profile endpoint returned non-OK status:', userResponse.status);
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch user profile data:', error);
        // Continue without profile data
      }

      // Fetch business status with individual error handling
      try {
        const businessResponse = await fetch('/api/user/business-status');
        if (businessResponse.ok) {
          businessData = await businessResponse.json();
          setExistingBusinessStatus(businessData);
          console.log('✅ Successfully fetched business status data');
        } else {
          console.warn('⚠️ Business status endpoint returned non-OK status:', businessResponse.status);
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch business status data:', error);
        // Continue without business data
      }

      // Fetch existing newsletter subscriptions
      try {
        const subsResponse = await fetch('/api/loops/subscribe?getSubscriptions=true');
        if (subsResponse.ok) {
          const subs = await subsResponse.json();
          if (subs.length === 0) {
            // Default to all selected if no existing subscriptions
            const allNewsletterIds = ["cmbyni4qq1tio0ivlfdfo3qj2", "cmbyno89p018e0jxsd5698x12"];
            setNewsletterData(allNewsletterIds);
          } else {
            setNewsletterData(subs);
          }
          console.log('✅ Successfully fetched newsletter subscriptions');
        } else {
          console.warn('⚠️ Newsletter subscriptions endpoint returned non-OK status:', subsResponse.status);
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch newsletter subscriptions:', error);
      }

      // Pre-populate profile data if available
      if (userData) {
        setProfileData({
          name: userData.name || '',
          last_name: userData.last_name || '',
          job_title: userData.job_title || '',
          bio: userData.bio || '',
          timezone: userData.timezone || ''
        });
        setIsProfileValid(userData.name && userData.last_name);
        console.log('✅ Pre-populated profile data');
      }

      // Pre-populate tax classification data if available
      if (businessData && businessData.account_type) {
        setTaxData({
          account_type: businessData.account_type,
          business_name: businessData.business_name || '',
          tax_id: businessData.tax_id || '',
          business_type: businessData.business_type || '',
          business_address: businessData.business_address || {
            address_line1: '',
            address_line2: '',
            city: '',
            state: '',
            country: '',
            postal_code: ''
          },
          tax_exempt: businessData.tax_exempt || false,
          tax_country: businessData.tax_jurisdiction || ''
        });
        setIsTaxValid(true);
        console.log('✅ Pre-populated tax classification data');
      }

      // Determine starting step based on available data
      const hasCompleteProfile = userData && userData.name && userData.last_name;

      if (hasCompleteProfile) {
        setCurrentStep(1); // Skip to tax classification step
        console.log('🚀 Starting at tax classification step (profile complete)');
      } else {
        console.log('🚀 Starting at profile setup step');
      }

      setIsLoadingExistingData(false);
    };

    fetchExistingData();
  }, []);

  const handleProfileSubmit = async (data: ProfileData) => {
    setProfileData(data);
    setError(null);
    setIsSubmitting(true);

    try {
      // Update user profile
      const response = await fetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          last_name: data.last_name,
          job_title: data.job_title,
          bio: data.bio,
          timezone: data.timezone
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Profile update failed with status ${response.status}`);
      }

      console.log('✅ Profile updated successfully');

      // Move to next step
      setCurrentStep(1);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      console.error('❌ Profile update error:', errorMessage);
      setError(`Profile update failed: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTaxSubmit = async (data: TaxClassificationFormData) => {
    setTaxData(data);
    setError(null);
    setIsSubmitting(true);

    try {
      if (data.account_type === 'individual') {
        // simple update for personal accounts
        const res = await fetch('/api/user/account-type', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_type: 'individual' })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Account type update failed with status ${res.status}`);
        }

        console.log('✅ Account type updated to individual');
      } else {
        const businessResponse = await fetch('/api/user/business-info', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_name: data.business_name,
            business_type: data.business_type,
            tax_id: data.tax_id,
            tax_country: data.tax_country,
            business_address: data.business_address,
            tax_exempt: data.tax_exempt
          })
        });

        if (!businessResponse.ok) {
          const errorData = await businessResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Business info update failed with status ${businessResponse.status}`);
        }

        console.log('✅ Business information saved successfully');
      }

      // Move to next step
      setCurrentStep(2);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save tax classification';
      console.error('❌ Tax classification error:', errorMessage);
      setError(`Tax classification failed: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewsletterSubmit = async (subscriptions: string[]) => {
    setNewsletterData(subscriptions);
    await completeOnboarding(subscriptions);
  };

  const handleSkipNewsletters = async () => {
    await completeOnboarding([]);
  };

  const completeOnboarding = async (subscriptions: string[]) => {
    setIsSubmitting(true);
    setError(null);

    // Save newsletter preferences if any selected (non-blocking)
    if (subscriptions.length > 0) {
      try {
        const response = await fetch("/api/loops/subscribe", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ mailingLists: subscriptions })
        });

        if (response.ok) {
          console.log('✅ Newsletter preferences updated successfully');
        } else {
          console.warn('⚠️ Newsletter preferences update failed, but continuing onboarding...');
        }
      } catch (error) {
        console.warn('⚠️ Newsletter preferences update error, but continuing onboarding:', error);
      }
    }

    // Mark user as onboarded
    try {
      const response = await fetch('/api/user/onboarding-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarded: true })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update onboarding status with status ${response.status}`);
      }

      console.log('✅ User marked as onboarded');
      // Invalidate the cache to ensure the guard fetches the new status
      localStorage.removeItem('onboarding-status');
    } catch (error) {
      console.error('❌ Failed to mark user as onboarded:', error);
      // Even if this fails, we redirect, as the guard will catch them again.
    }

    // Redirect to main app
    router.push('/interfaces');
    setIsSubmitting(false);
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const goNext = () => {
    if (isSubmitting) return;

    switch (currentStep) {
      case 0:
        profileFormRef.current?.submit();
        break;
      case 1:
        taxFormRef.current?.submit();
        break;
      case 2:
        handleNewsletterSubmit(newsletterData);
        break;
    }
  };

  const getCurrentStepValid = () => {
    switch (currentStep) {
      case 0:
        return isProfileValid;
      case 1:
        return isTaxValid;
      case 2:
        return isNewsletterValid;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStepData.id) {
      case 'profile':
        return (
          <ProfileSetupForm 
            ref={profileFormRef}
            onSubmit={handleProfileSubmit}
            onValidationChange={setIsProfileValid}
            initialData={profileData}
            error={error}
            isLoading={isSubmitting}
          />
        );
      case 'tax':
        return (
          <TaxClassificationForm 
            ref={taxFormRef}
            onSubmit={handleTaxSubmit}
            onValidationChange={setIsTaxValid}
            initialData={taxData ?? undefined}
            error={error ?? undefined}
            isLoading={isSubmitting}
          />
        );
      case 'newsletters':
        return (
          <NewsletterPreferencesForm 
            onSubmit={handleNewsletterSubmit}
            onSkip={handleSkipNewsletters}
            onValidationChange={setIsNewsletterValid}
            initialData={newsletterData}
            isSubmitting={isSubmitting}
            error={error}
          />
        );
      default:
        return null;
    }
  };

  // Show loading screen while fetching existing data
  if (isLoadingExistingData) {
    return <LoadingScreen />;
  }

  return (
    <div className="h-full bg-background flex flex-col min-w-0">
      {/* Header */}
      <div className="bg-card border-b flex-shrink-0">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-h2">Welcome to Unify</h1>
              <p className="text-subtitle mt-2">Let&apos;s get your account set up</p>
            </div>
            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {ONBOARDING_STEPS.length}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-4">
              {ONBOARDING_STEPS.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index < currentStep || (index === 0 && existingUser) || (index === 1 && existingBusinessStatus) ? 'bg-green-500 text-white' :
                    index === currentStep ? 'bg-primary text-primary-foreground' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {(index < currentStep || (index === 0 && existingUser) || (index === 1 && existingBusinessStatus)) ? <CheckCircle className="w-4 h-4" /> : index + 1}
                  </div>
                  <div className="text-xs text-center mt-2">
                    <div className="text-label">{step.title}</div>
                    <div className="text-muted">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-grow min-h-0 overflow-hidden">
        <div className="max-w-4xl w-full mx-auto px-6 py-6 h-full flex flex-col min-h-0">
          <ScrollArea className="flex-1">
            <Card className="w-full">
              <CardHeader className="pb-6">
                <CardTitle className="text-h3">{currentStepData.title}</CardTitle>
                <CardDescription className="text-body">{currentStepData.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Global Error */}
                {error && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertDescription className="text-body">{error}</AlertDescription>
                  </Alert>
                )}

                {/* Show helpful message about pre-populated data */}
                {(existingUser || existingBusinessStatus) && currentStep < 2 && (
                  <Alert className="mb-6 border-blue-200 bg-blue-50 text-blue-800">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-body">
                      We&apos;ve pre-populated this form with your existing information. Please review and update as needed.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Step Content */}
                {renderStepContent()}
              </CardContent>
            </Card>
          </ScrollArea>
        </div>
      </main>

      {/* Navigation */}
      <div className="flex-shrink-0 bg-card border-t">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Button 
              variant="outline" 
              onClick={goBack}
              disabled={currentStep === 0 || isSubmitting}
              className="h-12 px-8 text-base"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <div className="flex items-center space-x-4">
              {currentStep === 2 && (
                <Button 
                  variant="outline" 
                  onClick={handleSkipNewsletters}
                  disabled={isSubmitting}
                  className="h-12 px-8 text-base"
                >
                  Skip for now
                </Button>
              )}

              <Button 
                onClick={goNext}
                disabled={!getCurrentStepValid() || isSubmitting}
                className="h-12 px-8 text-base min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {currentStep === 2 ? 'Completing...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    {currentStep === 2 ? 'Complete Setup' : 'Continue'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}