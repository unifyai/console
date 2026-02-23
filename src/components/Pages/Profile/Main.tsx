import { User } from '@/types/user';
import SinglePaneBody from '../../Common/Body/SinglePaneBody';
import ProfileForm from './Form';

const Main = async ({ user, onPrem }: { user: User; onPrem: string | undefined }) => {
  return (
    <SinglePaneBody
      isPending={false}
      body={
        <div className="flex w-full flex-col gap-5 px-5 py-4 font-normal">
          <div className="h-full w-full xl:w-[900px]">
            <h1 className="text-h2">Account</h1>
            <ProfileForm onPrem={onPrem} user={user} />
          </div>
        </div>
      }
    />
  );
};

export default Main;
