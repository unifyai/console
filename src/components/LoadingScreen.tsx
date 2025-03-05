import React from 'react';
import LoadingElement from './Common/Loaders/LoadingElement';

const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-transparent" 
             style={{ 
                backgroundColor: 'transparent',
                backgroundImage: 'none'
             }}>
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-6 bg-transparent" 
                 style={{ 
                    backgroundColor: 'transparent',
                    backgroundImage: 'none'
                 }}>
                <LoadingElement height={150} width={150} className="text-primary" />
                <p className="text-lg text-foreground">Loading...</p>
            </div>
        </div>  
    );
};

export default LoadingScreen;