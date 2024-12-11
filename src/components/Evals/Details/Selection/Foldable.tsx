"use client";

import { Dispatch, SetStateAction } from "react";

import { ChevronRight } from "@mui/icons-material";
const Foldable = ({unfolded, setUnfolded, item}: {unfolded: boolean, setUnfolded: Dispatch<SetStateAction<boolean>>, item:string}) => {
    return (
      <div className="flex flex-row gap-2 items-start">                
        <button onClick={(e) => {
            e.stopPropagation();
            setUnfolded(!unfolded);
          }}>
          <div className={`${unfolded ? "rotate-90" : ""} mb-1.5`}>
            <ChevronRight/>
          </div>
        </button>
        <p className="text-foreground font-semibold">{item}</p>
      </div>
    );
  };

export default Foldable;
