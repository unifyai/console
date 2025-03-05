import React from 'react';

const LoadingElement = ({
    height = 150, 
    width = 150,
    color,
    className = ""
}: {
    height?: number, 
    width?: number,
    color?: string,
    className?: string
}) => {
    return (
        <div className={`flex flex-col gap-6 py-10 bg-transparent ${className}`}
             style={{ 
                backgroundColor: 'transparent',
                backgroundImage: 'none',
                position: 'relative'
             }}>
            {/* Using inline SVG to avoid import/component issues */}
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 70 60" 
                width={width} 
                height={height}
                className="text-primary"
                style={{backgroundColor: 'transparent'}}
            >
                <rect width="100%" height="100%" fill="transparent" />
                <g mask="url(#loaderMask)">
                    <path 
                        d="M10.640488,18.577171Q9.553652,32.7,15.476826,39.8C21.4,46.9,37.280553,56.588702,50.540276,46.899999s9.388186-23.855848,8.534714-25.477924-6.18767-11.592988-16.571572-12.090846-14.082279,4.068769-15.931467,10.468769s1.849187,16.842314,9.672675,16.628947s8.534714-6.428949,8.392469-8.328949-3.937102-5.611087-5.937101-1.900001" 
                        transform="translate(.000007 0.000006)" 
                        fill="none" 
                        stroke={color || "currentColor"} 
                        strokeWidth="10" 
                        strokeLinecap="round"
                        style={{
                            strokeDasharray: "176.66",
                            animation: "loaderDash 2.5s linear infinite"
                        }}
                    />
                    <mask id="loaderMask">
                        <path 
                            d="M40.7,5C30.1,5,21.4,13.7,21.4,24.3c0,8.5,6.9,15.5,15.5,15.5c6.4,0,11.7-5.2,11.7-11.7c0-4.3-3.5-7.9-7.9-7.9-3.3,0-6,2.7-6,6c0,2.2,1.8,4,4,4c.4,0,.7,0,1-.1-.6.9-1.7,1.6-3,1.6-4.1,0-7.4-3.3-7.4-7.4c0-6.2,5-11.2,11.2-11.2c8.3,0,15,6.7,15,15c0,10.4-8.4,18.8-18.8,18.8-12.5,0-22.6-10.1-22.6-22.6c0-1.5.1-3.1.4-4.5h-8c-.2,1.5-.3,3-.3,4.5C6.2,41.2,20,55,36.9,55c14.8,0,26.9-12.1,26.9-26.9C63.8,15.4,53.4,5,40.7,5v0Z" 
                            fill={color || "currentColor"}
                        />
                    </mask>
                </g>
                <style>
                    {`
                    @keyframes loaderDash {
                        0% { stroke-dashoffset: 176.66; }
                        50% { stroke-dashoffset: 0; }
                        100% { stroke-dashoffset: -176.66; }
                    }
                    `}
                </style>
            </svg>
        </div>
    );
};

export default LoadingElement;
