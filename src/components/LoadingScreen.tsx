import React from 'react';

const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50">
            <div className="animate-spin rounded-full h-20 w-20 border-t-1 border-b-2 border-primary mb-10"></div>
            <p className="text-foreground text-lg font-semibold">Loading...</p>
        </div>  
    );
};

export default LoadingScreen;