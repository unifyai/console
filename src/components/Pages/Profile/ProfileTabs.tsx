'use client';

import { User } from '@/types/user';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/UI/tabs';
import { useSearchParams } from 'next/navigation';
import ProfileForm from './Form';
import SecurityTab from './SecurityTab';
import PreferencesTab from './PreferencesTab';

const VALID_TABS = ['profile', 'security', 'preferences'] as const;
type TabValue = (typeof VALID_TABS)[number];

const ProfileTabs = ({
  user,
  onPrem,
}: {
  user: User;
  onPrem: string | undefined;
}) => {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabValue | null;
  const initialTab: TabValue = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'profile';

  return (
    <Tabs defaultValue={initialTab} className="mt-4">
      <TabsList className="w-full">
        <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
        <TabsTrigger value="preferences" className="flex-1">Preferences</TabsTrigger>
        <TabsTrigger value="security" className="flex-1">Security</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-4">
        <ProfileForm onPrem={onPrem} user={user} />
      </TabsContent>

      <TabsContent value="preferences" className="mt-4">
        <PreferencesTab />
      </TabsContent>

      <TabsContent value="security" className="mt-4">
        <SecurityTab user={user} />
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabs;

