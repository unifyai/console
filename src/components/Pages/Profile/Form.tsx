"use client";

import { useState, useEffect, useMemo } from "react";
import { User } from "@/types/user";
import UserInfo from "@/components/Pages/Profile/Info";
import NewsletterPreferences from "./Newsletter";
import SecondaryButton from "../../Common/Buttons/Secondary";
import PrimaryButton from "../../Common/Buttons/Primary";
import DeleteDialog from "../../Common/Dialogs/Delete";
import { AlertCircle, CheckCircle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/UI/alert";
import { useRouter } from "next/navigation";
import { deleteUser } from "@/lib/user/user";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

const ProfileForm = ({user, onPrem}: {
    user: User,
    onPrem: string | undefined
}) => {
  
  const router = useRouter();

  // Form state
  const [formState, setFormState] = useState({
    name: user.name || "",
    lastName: user.lastName || "",
    jobTitle: user.jobTitle || "",
    bio: user.bio || "",
    timezone: user.timezone || "",
  });
  const [initialFormState, setInitialFormState] = useState({ ...formState });
  const [changeMade, setChangeMade] = useState(false);

  // State for newsletter subscriptions
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [initialSubscriptions, setInitialSubscriptions] = useState<string[]>([]);
  
  // Alert state
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const response = await fetch('/api/loops/subscribe?getSubscriptions=true');
        if (response.ok) {
          const subs = await response.json();
          setSubscriptions(subs);
          setInitialSubscriptions(subs);
        }
      } catch (error) {
        console.error('Error fetching subscriptions:', error);
      }
    };
    fetchSubscriptions();
  }, []);

  // Automatically set timezone for new users
  useEffect(() => {
    const autoUpdateTimezone = async (tz: string) => {
        const formData = new FormData();
        // Append all current user data to avoid blanking it out on update
        formData.append('name', user.name || '');
        formData.append('lastName', user.lastName || '');
        formData.append('jobTitle', user.jobTitle || '');
        formData.append('bio', user.bio || '');
        formData.append('email', user.email || '');
        formData.append('timezone', tz);

        try {
            const response = await fetch(`/api/profile/updateUser?userID=${user.id}`, {
                method: "POST",
                body: formData
            });

            if (response.ok) {
                setFormState(prev => ({...prev, timezone: tz}));
                setInitialFormState(prev => ({...prev, timezone: tz}));
                toast.success("Your timezone has been automatically set.");
            } else {
                 toast.error("Could not automatically set your timezone.");
            }
        } catch (error) {
            console.error("Failed to auto-update timezone:", error);
            toast.error("Could not automatically set your timezone.");
        }
    };

    if (!user.timezone) {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (browserTimezone) {
            autoUpdateTimezone(browserTimezone);
        }
    }
  }, [user.id, user.timezone, user.name, user.lastName, user.jobTitle, user.bio, user.email]);

  const preferencesChanged = useMemo(() => {
    if (subscriptions.length !== initialSubscriptions.length) return true;
    const initialSubsSet = new Set(initialSubscriptions);
    return !subscriptions.every(sub => initialSubsSet.has(sub));
  }, [subscriptions, initialSubscriptions]);

  useEffect(() => {
    if (alert.type) {
      const timer = setTimeout(() => {
        setAlert({ type: null, message: '' });
      }, 5000); // Alert will disappear after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [alert]);
  
  // Handle subscription changes
  const handleSubscriptionChange = (value: string[]) => {
    setSubscriptions(value);
  };

  useEffect(() => {
    setInitialFormState({ ...formState });
  }, [user, formState]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
    setChangeMade(true);
  };

  const handleTimezoneChange = (value: string) => {
    setFormState((prev) => ({ ...prev, timezone: value }));
    setChangeMade(true);
  };

  // Handle cancel
  const handleCancel = () => {
    // Reset form state to initial values
    setFormState(initialFormState);
    setChangeMade(false);
    setSubscriptions(initialSubscriptions);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    formData.append('timezone', formState.timezone);

    // Update profile info
    const profilePromise = fetch(`/api/profile/updateUser?userID=${user.id}`, {
      method: "POST",
      body: formData
    });

    // Update newsletter preferences
    const newsletterPromise = fetch('/api/loops/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailingLists: subscriptions })
    });

    const [profileResponse, newsletterResponse] = await Promise.all([
      profilePromise,
      newsletterPromise
    ]);

    if (profileResponse.ok && newsletterResponse.ok) {
      setAlert({ type: 'success', message: 'Profile updated successfully!' });
      setInitialFormState({ ...formState });
      setInitialSubscriptions([...subscriptions]);
      setChangeMade(false);
    } else {
      let errorMessage = 'An error occurred. Please try again.';
      if (!profileResponse.ok) {
        errorMessage = 'Error updating profile.';
      } else if (!newsletterResponse.ok) {
        errorMessage = 'Error updating newsletter preferences.';
      }
      setAlert({ type: 'error', message: errorMessage });
    }
  };

  return (
    <div className="mt-10 sm:mt-0 w-fit">
      <form onSubmit={handleSave}>
        <UserInfo
          formState={formState}
          handleInputChange={handleInputChange}
          handleTimezoneChange={handleTimezoneChange}
          user={user}
          onPrem={onPrem}
        />
        <NewsletterPreferences
          subscriptions={subscriptions}
          handleSubscriptionChange={handleSubscriptionChange}
        />
        <div className="flex justify-between items-center gap-5 mt-5">
        {(changeMade || preferencesChanged) ? 
            <div className="w-fit flex gap-2">
              <SecondaryButton
                onClick={handleCancel}
                disabled={!changeMade && !preferencesChanged}
                label="Cancel"
              />
              <PrimaryButton
                type="submit"
                disabled={!changeMade && !preferencesChanged}
                label="Save"
              />
            </div> : <div></div>
          }
          <div className="w-fit flex gap-2">
            <SecondaryButton label="Sign Out" onClick={() => {signOut(); router.push('/login')}} />
            <DeleteDialog args={[user.id]} deletingFunction={deleteUser} onDelete={() => {router.push('/login')}} type="account" text="Delete Account" icon={null} variant="destructive" expectedResponseType={"string"} />
          </div>
        </div>
      </form>
      {alert.type && (
        <Alert variant={alert.type === 'error' ? "destructive" : "default"} className="mt-5">
          {alert.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <AlertTitle className="text-title">{alert.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
          <AlertDescription className="text-body">{alert.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ProfileForm;