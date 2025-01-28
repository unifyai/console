import React, { createContext, useContext } from "react";

type ExpandContextType = {
  expandAll: boolean;
  toggleCounter: number;
};

export const ExpandAllContext = createContext<ExpandContextType>({
  expandAll: false,
  toggleCounter: 0,
});

export const useExpandAllContext = () => useContext(ExpandAllContext);

export const ExpandAllProvider = ({
  expandAll,
  toggleCounter,
  children,
}: {
  expandAll: boolean;
  toggleCounter: number;
  children: React.ReactNode;
}) => (
  <ExpandAllContext.Provider value={{ expandAll, toggleCounter }}>
    {children}
  </ExpandAllContext.Provider>
);
