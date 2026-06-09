'use client';

import { User } from '@/types/user';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/UI/tabs';
import { useSearchParams } from 'next/navigation';
import ProfileForm from './Form';
import SecurityTab from './SecurityTab';
import PreferencesTab from './PreferencesTab';
import ContactInfoTab from './ContactInfoTab';
import AdvancedTab from './AdvancedTab';

const VALID_TABS = ['profile', 'contact-info', 'preferences', 'security', 'advanced'] as const;
type TabValue = (typeof VALID_TABS)[number];

const ProfileTabs = ({ user, externalIdentity }: { user: User; externalIdentity: boolean }) => {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabValue | null;
  const initialTab: TabValue = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'profile';

  return (
    <Tabs defaultValue={initialTab} className="mt-4">
      <TabsList className="w-full">
        <TabsTrigger value="profile" className="flex-1">
          Profile
        </TabsTrigger>
        <TabsTrigger value="contact-info" className="flex-1">
          Contact Info
        </TabsTrigger>
        <TabsTrigger value="preferences" className="flex-1">
          Preferences
        </TabsTrigger>
        <TabsTrigger value="advanced" className="flex-1">
          Advanced
        </TabsTrigger>
        <TabsTrigger value="security" className="flex-1">
          Security
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-4">
        <ProfileForm externalIdentity={externalIdentity} user={user} />
      </TabsContent>

      <TabsContent value="contact-info" className="mt-4">
        <ContactInfoTab user={user} />
      </TabsContent>

      <TabsContent value="preferences" className="mt-4">
        <PreferencesTab />
      </TabsContent>

      <TabsContent value="advanced" className="mt-4">
        <AdvancedTab apiKey={user.apiKey} />
      </TabsContent>

      <TabsContent value="security" className="mt-4">
        <SecurityTab user={user} />
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabs;
