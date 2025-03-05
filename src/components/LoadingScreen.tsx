import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
            <div className="flex flex-col items-center">
                <Loader2 className="animate-spin text-primary size-24 mb-4" />
            </div>
        </div>  
    );
};

export default LoadingScreen;