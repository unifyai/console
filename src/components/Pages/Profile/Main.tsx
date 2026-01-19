import { User } from '@/types/user';
import SinglePaneBody from '../../Common/Body/SinglePaneBody';
import ProfileForm from './Form';
import UnifyKey from '../Keys/UserAPIKeyPanel/APIKeyPanel';

const Main = async ({ user, onPrem }: { user: User; onPrem: string | undefined }) => {
  return (
    <SinglePaneBody
      isPending={false}
      body={
        <div className="flex w-full flex-col gap-5 px-5 py-4 font-normal">
          <div className="h-full w-full xl:w-[900px]">
            <h1 className="text-h2">API Key</h1>
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-title">Grab or update your API key</p>
              <UnifyKey initialApiKey={user.apiKey} userId={user.id} onPrem={onPrem} />
            </div>
          </div>
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
