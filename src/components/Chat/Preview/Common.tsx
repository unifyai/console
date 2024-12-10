"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import SettingButton from "@/components/Common/Buttons/Setting";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";

import Image from "next/image";
import CodeGen from "postman-code-generators";

import python from "@/public/images/languages/python.png";
import nodejs from "@/public/images/languages/nodejs.png";
import javascript from "@/public/images/languages/javascript.png";
import curl from "@/public/images/languages/curl.png";
import php from "@/public/images/languages/php.png";

const imageMap: { [key: string]: any } = {
    "python": python,
    "nodejs": nodejs,
    "javascript": javascript,
    "curl": curl,
    "php": php
};

const CommonLanguage = ({language, setSelectedLanguage, setSelectedVariant}: {
    language: CodeGen.Language,
    // eslint-disable-next-line no-unused-vars
    setSelectedLanguage: (language: string) => void,
    // eslint-disable-next-line no-unused-vars
    setSelectedVariant: (variant: string) => void

}) => {
     
    const icon = <Image src={imageMap[language.key]} alt={language.label} width={20} height={20}/>
    
    // Languages with no variants
    if (language.variants.length === 1)
        return <SettingButton
            icon={icon}
            tooltip={language.label}
            onClick={() => {
                setSelectedLanguage(language.key);
                setSelectedVariant(language.variants[0].key);
            }}
        />

    // Languages with variants
    const button = <SettingButton icon={icon} tooltip={language.label}/>
    const label = `Select ${language.label} variant`;
    const onClick = (variant: { key: string }) => {
        setSelectedLanguage(language.key);
        setSelectedVariant(variant.key);
    }
    return (
        <BaseDropdown button={button} label={label}>
            {language.variants.map((variant, index) => 
                <DropdownMenuItem key={index} onClick={() => onClick(variant)}>
                    {variant.key}
                </DropdownMenuItem>
            )}
        </BaseDropdown>
    )
}

export default CommonLanguage;
