import { Input } from "../../UI/input";
import { Label } from "../../UI/label";
import { User } from "@/types/user";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { generateTimezoneOptions } from "@/utils/assistants/timezone-utils";
import * as React from 'react';

const UserInfo = ({ formState, user, handleInputChange, handleTimezoneChange, onPrem }: {
  formState: { name: any; lastName: any; jobTitle: any; timezone: any; },
  user: User,
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  handleTimezoneChange: (value: string) => void,
  onPrem: string | undefined
}) => {

  const timezoneOptions = React.useMemo(() => generateTimezoneOptions(), []);

  return (
    <div className="mt-4 profile-form tutorial-user-information">
      <p className="text-title">Change your personal information</p>
      <div className="grid grid-cols-2 gap-4 text-body">
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
        <div className="mt-2 col-span-2">
          <Label>Timezone</Label>
          <Select 
            value={formState.timezone} 
            onValueChange={handleTimezoneChange} 
            disabled={Boolean(onPrem)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a timezone..." />
            </SelectTrigger>
            <SelectContent>
              {timezoneOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default UserInfo;
