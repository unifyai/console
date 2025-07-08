import { Input } from "../../UI/input";
import { Label } from "../../UI/label";
import { User } from "@/types/user";

const UserInfo = ({ formState, user, handleInputChange, onPrem }: {
  formState: { name: any; lastName: any; jobTitle: any },
  user: User,
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPrem: string | undefined
}) => {
  return (
    <div className="mt-4 profile-form tutorial-user-information">
      <p className="font-bold">Change your personal information</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="mt-2">
          <Label>First Name</Label>
          <Input 
            type="text" 
            name="name" 
            value={formState.name} 
            className="w-full" 
            onChange={handleInputChange} 
            readOnly={Boolean(onPrem)}
          />
        </div>
        <div className="mt-2">
          <Label>Last Name</Label>
          <Input 
            type="text" 
            name="lastName" 
            value={formState.lastName} 
            className="w-full" 
            onChange={handleInputChange} 
            readOnly={Boolean(onPrem)}
          />
        </div>
        <div className="mt-2">
          <Label>Email</Label>
          <Input 
            type="text" 
            name="email" 
            value={user?.email || ""} 
            className="w-full" 
            readOnly={true}
          />
        </div>
        <div className="mt-2">
          <Label>Job Title</Label>
          <Input 
            type="text" 
            name="jobTitle" 
            value={formState.jobTitle} 
            className="w-full" 
            onChange={handleInputChange} 
            readOnly={Boolean(onPrem)}
          />
        </div>
      </div>
    </div>
  );
};

export default UserInfo;