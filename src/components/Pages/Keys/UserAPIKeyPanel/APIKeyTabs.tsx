'use client';

import React, { ReactNode } from 'react';

/**
 * APIKeyTabs component renders children elements that match the current state.
 *
 * Props:
 * - children: The React nodes to be rendered as tab content.
 * - currentState: The key of the child component that should be displayed.
 *
 * Only the child element with a key that matches the currentState will be displayed.
 */
const APIKeyTabs = ({ children, currentState }: { children: ReactNode; currentState: string }) => {
  return (
    <div className="APIKeyTabs">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.key === currentState) {
          return child;
        }
        return null;
      })}
    </div>
  );
};

export default APIKeyTabs;
