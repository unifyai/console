import { User } from "@/types/user";
import SinglePaneBody from "../../Common/Body/SinglePaneBody";
import ProfileForm from "./Form";
import UnifyKey from "../Keys/UserAPIKeyPanel/APIKeyPanel";

const Main = async ({user, onPrem}: {
    user: User,
    onPrem: string | undefined
}) => {

  return (
    <SinglePaneBody
        isPending={false}
        body={
        <div className="font-normal w-full py-4 px-5 flex flex-col gap-5">
            <div className="xl:w-[900px] w-full h-full">
                              <h1 className="text-h2">API Key</h1>
              <div className="flex flex-col gap-2 mt-4">
                <p className="text-title">Grab or update your API key</p>
                <UnifyKey 
                    initialApiKey={user.apiKey} 
                    userId={user.id}
                    onPrem={onPrem} 
                />
              </div>
            </div>
            <div className="xl:w-[900px] w-full h-full">
                <h1 className="text-h2">Account</h1>
                <ProfileForm onPrem={onPrem} user={user}/>
            </div>
          </div>
        }
    />
  );
};

export default Main;