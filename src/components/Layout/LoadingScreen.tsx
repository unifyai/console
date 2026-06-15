import React from 'react';
import { Loader } from '@/components/Common/Loader';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center">
        <Loader size={64} className="mb-4" />
      </div>
    </div>
  );
};

export default LoadingScreen;
