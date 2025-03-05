"use client";

import React, { Suspense } from "react";
import LoadingElement from "./LoadingElement";

export const UnifyLoader = ({ 
  message, 
  children
}: { 
  message: string, 
  children: React.ReactNode 
}) => {
  return (
    <Suspense
      fallback={
        <div 
          className="flex flex-col items-center justify-center gap-6 bg-transparent" 
          style={{ 
            backgroundColor: 'transparent',
            backgroundImage: 'none',
            position: 'relative'
          }}
        >
          <div style={{ 
            backgroundColor: 'transparent',
            backgroundImage: 'none',
          }}>
            <LoadingElement height={150} width={150} className="text-primary" />
          </div>
          <p className="text-lg text-foreground">{message}</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
};
