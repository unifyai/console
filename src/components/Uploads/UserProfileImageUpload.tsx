"use client";

import React, { useState, ChangeEvent } from "react";

interface UserProfileImageUploadProps {
  user: { image?: string };
  // Optionally omit 'setDisplayCancel'
  // setDisplayCancel?: React.Dispatch<React.SetStateAction<boolean>>;
}

const UserProfileImageUpload: React.FC<UserProfileImageUploadProps> = ({ user }) => {
  const [imageFile, setImageFile] = useState<string>("");

  const updateImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      let fileName = e.target.files[0].name;
      if (fileName.length > 11) {
        fileName = fileName.slice(0, 4) + "..." + fileName.slice(-5);
      }
      // Optionally implement local cancellation or change logic here
      // Example: setShowCancel(true) if managing a local cancel button.
      setImageFile(fileName);
    }
  };

  const defaultProfileImage = require("../../../public/ivy_logo_only.png");
  const profileImage = user?.image
    ? `https://storage.googleapis.com/console-app-profile-images/${user.image}`
    : defaultProfileImage;

  return (
    <div className="flex flex-col justify-start items-center md:mr-3 sm:w-1/4 w-1/3">
      <div className="sm:h-32 sm:w-32">
        <img className="w-full h-full rounded-xl" src={profileImage} alt="Profile" />
      </div>
      <label
        htmlFor="image"
        className="hover:text-accent font-bold text-primary border border-primary rounded-lg transition-all text-small sm:px-4 px-2 py-1 w-fit h-fit mt-2"
      >
        {imageFile || "UPDATE"}
      </label>
      <input
        type="file"
        accept="image/*"
        name="image"
        id="image"
        onChange={updateImageFile}
        className="hidden"
      />
    </div>
  );
};

export default UserProfileImageUpload;