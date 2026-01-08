import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center">
        <Loader2 className="mb-4 size-24 animate-spin text-primary" />
      </div>
    </div>
  );
};

export default LoadingScreen;
