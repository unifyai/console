import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";

import Image from "next/image";
import { getCurrentUser, updateUser, getSession } from "@/lib/user/user";
import { UserUpdateRequest } from "@/types/user";
import { ChevronsUpDown  } from "lucide-react";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import SignOutButton from "./SignOut";

const ProfileButton = async () => {
  const session = await getSession();
  const user = await getCurrentUser();

  const updateData: UserUpdateRequest = {
    email: user?.email || "",
    user_id: user?.id || "",
    image: user?.image || "",
    name: user?.name || "",
    last_name: user?.lastName || "",
    job_title: user?.jobTitle || "",
  }
  if (user?.image != session?.user?.image) await updateUser(updateData);

  const icon = user && user.image 
    ? <Image src={user.image} alt="Profile Image" width={35} height={35}/>
    : <AccountCircleOutlinedIcon fontSize="medium" className="text-primary"/>
  const title = user?.name && user?.lastName && `${user?.name} ${user?.lastName}` || session?.user?.name || session?.user?.email || "Guest";
  const trigger = <div className="flex gap-2 items-center justify-between">
                    <div className="flex gap-2 items-center">
                      {icon}
                      <span>{title}</span>
                    </div>
                    <ChevronsUpDown className="scale-80"/>
                  </div>

  const href = "/profile"
  const profile = <a href={href} className="flex gap-2 items-center">
                    <AccountCircleOutlinedIcon/>
                    <span>Profile</span>
                  </a>
  return (
    <BaseDropdown button={trigger}>
        <DropdownMenuItem className="pr-8">
          {profile}
        </DropdownMenuItem>
        <DropdownMenuItem className="pr-8">
          <SignOutButton/>
        </DropdownMenuItem>
    </BaseDropdown>
  )

};

export default ProfileButton;