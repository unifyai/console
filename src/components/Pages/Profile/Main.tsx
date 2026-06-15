import { User } from '@/types/user';
import SinglePaneBody from '../../Common/Body/SinglePaneBody';
import ProfileTabs from './ProfileTabs';

const Main = async ({ user, externalIdentity }: { user: User; externalIdentity: boolean }) => {
  return (
    <SinglePaneBody
      isPending={false}
      body={
        <div className="flex w-full flex-col gap-5 px-5 py-4 font-normal">
          <div className="h-full w-full xl:w-[900px]">
            <ProfileTabs externalIdentity={externalIdentity} user={user} />
          </div>
        </div>
      }
    />
  );
};

export default Main;
