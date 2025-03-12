"use client";

import { useState, useEffect } from "react";
import { User } from "@/types/user";
import UserInfo from "@/components/Profile/Info";
import NewsletterPreferences from "./Newsletter";
import SecondaryButton from "../Common/Buttons/Secondary";
import PrimaryButton from "../Common/Buttons/Primary";
import DeleteDialog from "../Common/Dialogs/Delete";
import { AlertCircle, CheckCircle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/UI/alert";
import { useRouter } from "next/navigation";
import { deleteUser } from "@/lib/user/user";
import { signOut } from "next-auth/react";

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
  });
  const [initialFormState, setInitialFormState] = useState({ ...formState });
  const [changeMade, setChangeMade] = useState(false);

  // State for newsletter subscriptions
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [initialSubscriptions, setInitialSubscriptions] = useState<string[]>([]);
  const [preferencesChanged, setPreferencesChanged] = useState(false);
  
  // Alert state
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    // Fetch user's current subscriptions
    const fetchSubscriptions = async () => {
      const response = await fetch(`/api/user/emailPreferences/currentSubscriptions?email=${user.email}`);
      const data = await response.json();
      const subs = Object.entries(data.subscriptions)
        .filter(([key, value]) => value)
        .map(([key]) => key);
      setSubscriptions(subs);
      setInitialSubscriptions(subs);
    };
    fetchSubscriptions();
  }, [user]);

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
    setChangeMade(true);

    // Determine if there are any changes compared to the initial subscriptions
    const hasChanges =
      value.length !== initialSubscriptions.length ||
      value.some((subscription) => !initialSubscriptions.includes(subscription));

    setPreferencesChanged(hasChanges);
  };

  useEffect(() => {
    setInitialFormState({ ...formState });
  }, [user]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
    setChangeMade(true);
  };

  // Handle cancel
  const handleCancel = () => {
    // Reset form state to initial values
    setFormState(initialFormState);
    setChangeMade(false);
    setSubscriptions(initialSubscriptions);
    setPreferencesChanged(false);
  };

  // Handle save
  // Handle save
const handleSaveClick = async (e: React.FormEvent) => {
  e.preventDefault();

  // Prepare form data
  const formData = new FormData();
  formData.append("name", formState.name);
  formData.append("lastName", formState.lastName);
  formData.append("jobTitle", formState.jobTitle);
  formData.append("email", user.email);

  // Post form data to API
  const userResponse = fetch(`/api/profile/updateUser?userID=${user.id}`, {
    method: "POST",
    body: formData,
  });

  formData.append("subscriptions", JSON.stringify(subscriptions));

  const mailchimpResponse = fetch("/api/user/emailPreferences/updateMailchimp", {
    method: "POST",
    body: formData
  });

  const [userUpdateResponse, mailchimpUpdateResponse] = await Promise.all([
    userResponse,
    mailchimpResponse
  ]);

  let profileUpdated = false;
  let preferencesUpdated = false;

  // Success message
  if (userUpdateResponse.ok && mailchimpUpdateResponse.ok) {
    setAlert({ type: 'success', message: 'Profile and email preferences updated successfully!' });
    profileUpdated = true;
    preferencesUpdated = true;
  }
  // Partial success or error handling
  else {
    if (userUpdateResponse.ok) {
      setAlert({ type: 'success', message: 'Profile information updated successfully, but there was an error updating email preferences.' });
      profileUpdated = true;
    } else if (mailchimpUpdateResponse.ok) {
      setAlert({ type: 'success', message: 'Email preferences updated successfully, but there was an error updating profile information.' });
      preferencesUpdated = true;
    } else {
      setAlert({ type: 'error', message: 'Error updating profile and email preferences. Please try again.' });
    }
  }

  // Update initial states only for successful updates
  if (profileUpdated) {
    setInitialFormState({ ...formState });
    setChangeMade(false);
  }
  if (preferencesUpdated) {
    setInitialSubscriptions([...subscriptions]);
    setPreferencesChanged(false);
  }
};

  return (
    <div className="mt-10 sm:mt-0 w-fit">
      <form onSubmit={handleSaveClick}>
        <UserInfo
          formState={formState}
          handleInputChange={handleInputChange}
          user={user}
          onPrem={onPrem}
        />
        <NewsletterPreferences
          subscriptions={subscriptions}
          handleSubscriptionChange={handleSubscriptionChange}
        />
        <div className="flex justify-between items-center gap-5 mt-5">
        {changeMade ? 
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
          <AlertTitle>{alert.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ProfileForm;