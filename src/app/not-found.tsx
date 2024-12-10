import React from "react";
import Image from "next/image";
import ErrorImage from "@/public/images/404.png";
import Scaffold from "@/components/LandingNav/Scaffold";

export default function Error() {
  return (
    <Scaffold>
      <div className="flex justify-center mt-32">
        <div className="flex flex-col gap-2 max-w-xl items-center">
          <Image src={ErrorImage} className="max-w-xl" alt="Unify Logo" />
          <h1 className="text-xl font-semibold">{"Couldn't find what you want"}</h1>
          <p>{"It's not your fault"}</p>
          <p className="font-light">
            Make sure the URL is correct, we think something is wrong.
          </p>
        </div>
      </div>
    </Scaffold>
  );
}
