import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createStoreSlice, StoreSlice } from "./slices/slice";

// -----------------------------------------------------------------------------
// 1) Define our combined store state type
// -----------------------------------------------------------------------------
export type StoreState = StoreSlice;

// -----------------------------------------------------------------------------
// 2) Extend the store state with legacy fields for backward compatibility
// -----------------------------------------------------------------------------
export interface IStoreState extends StoreState {
  // Global action to reset the entire store state
  resetState: (newState: Partial<IStoreState>) => void;
}

// -----------------------------------------------------------------------------
// 3) Helper function to cast slice creators to the combined store type
//    This helps TypeScript understand our composition pattern
// -----------------------------------------------------------------------------
// function castSliceCreator<SliceState>(fn: any) {
//   return fn as any;
// }

// -----------------------------------------------------------------------------
// 4) The function that creates a new Zustand store instance
//    This is what the provider will call to get "one store per request."
// -----------------------------------------------------------------------------
export function createStore(initialState?: Partial<IStoreState>) {
  // Build a new store using `create`
  const zustandStore = create<IStoreState>()(
    devtools(
      immer((set, get, api) => {
        // Use the helper function to cast the slice creator
        const storeSlice = createStoreSlice(set, get, api);

        return {
          // Include the slice
          ...storeSlice,

          // Global reset action
          resetState: (newState: Partial<IStoreState>) => set(newState),
        };
      }),
      {
        name: "MyStore",
      }
    )
  );

  // If initial state was provided, set it
  if (initialState) {
    zustandStore.getState().resetState(initialState);
  }

  return zustandStore;
}
