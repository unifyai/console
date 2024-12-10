import { User } from "@/types/user";
import SinglePaneBody from "../Common/Body/SinglePaneBody";
import ProfileForm from "./Form";

const Main = async ({user, onPrem}: {
    user: User,
    onPrem: string | undefined
}) => {

  return (
    <SinglePaneBody
        isPending={false}
        body={
        <div className="text-lg font-normal w-full py-4 px-5">
            <div className="xl:w-[900px] w-full h-full">
                <h1 className="text-4xl font-bold">Profile</h1>
                <ProfileForm onPrem={onPrem} user={user}/>
            </div>
          </div>
        }
    />
  );
};

export default Main;
