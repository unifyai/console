import React, { Dispatch, ReactNode, SetStateAction } from "react";
import Foldable from "../Foldable";

const BaseNode = ({unfolded, setUnfolded, newEntry, property, children, className}: {
    unfolded: boolean, 
    setUnfolded: Dispatch<SetStateAction<boolean>>, 
    property: string,
    children: ReactNode,
    newEntry?: boolean,
    className?: string
}) => {
    return (
        <div 
            className={`flex flex-col text-left cursor-pointer ${newEntry ? "bg-green-300" : ""} ${className}`}
            onClick={(e) => {
                e.stopPropagation();
                setUnfolded(!unfolded);
            }}
        >
            <Foldable unfolded={unfolded} setUnfolded={setUnfolded} item={property}/>
            {children}         
        </div>
    )
}

export default BaseNode;