import { ButtonHTMLAttributes, DetailedHTMLProps } from "react";


const HallowButton = (params: DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>) => {
    return (<button
        {...params}
        className="bg-gradient-to-r from-[#66D47E] to-[#00A824] rounded-[10px] w-full p-0.5"
    >
        <div className="bg-background rounded-[8px]">
            <div
                className="bg-gradient-to-r from-[#66D47E] to-[#00A824] bg-clip-text text-transparent uppercase py-3 px-6 font-bold whitespace-nowrap"
            >
                {params.children}
            </div>
        </div>
    </button>);
};

export default HallowButton;
