'use client';

import { User } from '@/types/user';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/UI/tabs';
import { useSearchParams } from 'next/navigation';
import ProfileForm from './Form';
import SecurityTab from './SecurityTab';

const ProfileTabs = ({
  user,
  onPrem,
}: {
  user: User;
  onPrem: string | undefined;
}) => {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'security' ? 'security' : 'profile';

  return (
    <Tabs defaultValue={initialTab} className="mt-4">
      <TabsList className="w-full">
        <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
        <TabsTrigger value="security" className="flex-1">Security</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-4">
        <ProfileForm onPrem={onPrem} user={user} />
      </TabsContent>

      <TabsContent value="security" className="mt-4">
        <SecurityTab user={user} />
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabs;

