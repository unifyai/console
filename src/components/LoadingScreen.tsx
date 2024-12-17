import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50">
            <Loader2 className="animate-spin h-20 w-20 text-accent mb-10" />
            <p className="text-foreground text-lg font-semibold">Loading...</p>
        </div>  
    );
};

export default LoadingScreen;