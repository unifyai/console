import { createContext, useContext } from 'react';
type TileColorContextType = string | null;
export const TileColorContext = createContext<TileColorContextType>(null);
export const useTileColor = () => useContext(TileColorContext);