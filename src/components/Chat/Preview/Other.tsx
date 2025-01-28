"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import SettingButton from "@/components/Common/Buttons/Setting";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

const OtherLanguages = ({languages, setSelectedLanguage, setSelectedVariant}: {
    languages: { key: string; label: string; variant: string }[],
    // eslint-disable-next-line no-unused-vars
    setSelectedLanguage: (language: string) => void,
    // eslint-disable-next-line no-unused-vars
    setSelectedVariant: (variant: string) => void

}) => {
     
    const icon = <MoreHorizontal/>
    const button = <SettingButton icon={icon} tooltip={"Other languages"}/>
    const onClick = (language: { key: string; label: string; variant: string }) => {
        setSelectedLanguage(language.key);
        setSelectedVariant(language.variant);
    }
    return (
        <BaseDropdown button={button}>
            {languages.map((language, index) => 
                <DropdownMenuItem key={index} onClick={() => onClick(language)}>
                    {`${language.key}-${language.variant}`}
                </DropdownMenuItem>
            )}
        </BaseDropdown>
    )
}

export default OtherLanguages;
