"use client";

import { createStore } from "zustand/vanilla";
import type { ItemType, TableDataProps, TileProps } from "@/types/evals/grid";
import { Dispatch, SetStateAction } from "react";

/**
 * Optional: define a type for the tile dropdown position from CardGrid
 */
export interface TileDropdownPosition {
  x: number;
  y: number;
}

/**
 * This is the shape of all the "interface-level" states
 * that used to live in Card.tsx and CardGrid.tsx.
 * 
 * Expand/modify as needed. 
 */
export interface InterfaceStoreState {
  // From Card.tsx:
  cardInitial: boolean;

  // From CardGrid.tsx:
  tableData: TableDataProps;
  context: string | undefined;
  columnContext: string | undefined;
  items: TileProps[];
  newCounter: number;
  tempInterfaceCreated: boolean;
  
  saveDialog: boolean;
  focusDialog: boolean;
  tileDropdown: TileDropdownPosition | undefined;
  maxTiles: [string | undefined, string | undefined];
  editTile: string | undefined;
  saveSuccess: boolean | undefined;
  resetting: boolean;
  
  edit: boolean;
  interactive: boolean;
  copied: string | undefined;
  deleting: boolean;
  
  interfaces: string[];
  projects: string[];
  
  tilePending: { [key: string]: boolean };
  dataPending: boolean;
  pending: boolean;
  refreshing: boolean;

  // For reading/writing the "interface" and "project" from query or store
  interface_: string | null;
  project: string | undefined;

  /*
   The actions (setters) for each piece of state.
   Typically, we do a function that calls `set(...)`.
  */
  setCardInitial: (value: boolean) => void;

  setTableData: (value: (prev: TableDataProps) => TableDataProps) => void;
  setContext: (value: SetStateAction<string | undefined>) => void;
  setColumnContext: (value: SetStateAction<string | undefined>) => void;
  setItems: (value: SetStateAction<TileProps[]>) => void;
  updateItem: (item: TileProps, attrName: ItemType) => (newValue: any | undefined) => void;
  setNewCounter: (value: SetStateAction<number>) => void;
  setTempInterfaceCreated: (val: boolean) => void;

  setSaveDialog: (value: SetStateAction<boolean>) => void;
  setFocusDialog: (value: SetStateAction<boolean>) => void;
  setTileDropdown: (pos: TileDropdownPosition | undefined) => void;
  setMaxTiles: Dispatch<SetStateAction<[string | undefined, string | undefined]>>;
  setEditTile: Dispatch<SetStateAction<string | undefined>>;
  setSaveSuccess: (val: boolean | undefined) => void;
  setResetting: (value: SetStateAction<boolean>) => void;

  setEdit: (value: SetStateAction<boolean>) => void;
  setInteractive: (value: SetStateAction<boolean>) => void;
  setCopied: (value: SetStateAction<string | undefined>) => void
  setDeleting: (val: boolean) => void;

  setInterfaces: (value: SetStateAction<string[]>) => void;
  setProjects: (value: SetStateAction<string[]>) => void;

  setTilePending: (value: SetStateAction<{ [key: string]: boolean }>) => void;
  setDataPending: (value: SetStateAction<boolean>) => void;
  setPending: (value: SetStateAction<boolean>) => void;
  setRefreshing: (value: SetStateAction<boolean>) => void;

  setInterface_: (val: string | null) => void;
  setProject: (val: string | undefined) => void;
}

/**
 * A factory function creating a brand-new vanilla Zustand store with default values.
 * If doing SSR, you can create a new instance per request. If purely client, you
 * can create it once in a provider.
 */
export function createInterfaceStore(
  initialState: Partial<InterfaceStoreState> = {}
) {
  return createStore<InterfaceStoreState>()((set) => ({
    /**
     * 1) Default state values. You can set them to whatever you want initially.
     */
    cardInitial: true,

    tableData: {},
    context: undefined,
    columnContext: undefined,
    items: [],
    newCounter: 0,
    tempInterfaceCreated: false,

    saveDialog: false,
    focusDialog: false,
    tileDropdown: undefined,
    maxTiles: [undefined, undefined],
    editTile: undefined,
    saveSuccess: undefined,
    resetting: false,

    edit: true,
    interactive: true,
    copied: undefined,
    deleting: false,

    interfaces: [],
    projects: [],

    tilePending: {},
    dataPending: false,
    pending: true,
    refreshing: false,

    interface_: null,
    project: undefined,

    /**
     * 2) Actions. Each calls 'set' to mutate the store's state.
     */
    setCardInitial: (value) => set({ cardInitial: value }),

    setTableData: (value) => {
      set((state) => {
        // If it's a function, call it with the old state
        if (typeof value === "function") {
          // cast to (prev: TableDataProps) => TableDataProps
          const fn = value as (prev: TableDataProps) => TableDataProps;
          return { tableData: fn(state.tableData) };
        } else {
          // or it's a direct object
          return { tableData: value };
        }
      });
    },
    setContext: (value: SetStateAction<string | undefined>) => {
      set((state) => {
        return {
          context: typeof value === "function"
            ? (value as (prev: string | undefined) => string | undefined)(state.context)
            : value
        };
      });
    },
    setColumnContext: (value: SetStateAction<string | undefined>) => {
      set((state) => {
        return {
          columnContext: typeof value === "function"
            ? (value as (prev: string | undefined) => string | undefined)(state.columnContext)
            : value
        };
      });
    },
    setItems: (value: SetStateAction<TileProps[]>) => {
      set((state) => {
        return {
          items: typeof value === "function"
            ? (value as (prev: TileProps[]) => TileProps[])(state.items)
            : value
        };
      });
    },
    updateItem: (item: TileProps, attrName: ItemType) => {
      // We return a function that takes the newValue, just like in your snippet.
      return (newValue: any | undefined) => {
        // Use set(...) to update the store immutably.
        set((state) => {
          // Option A: create a shallow clone of `item` applying the newValue.
          // That ensures we're not mutating the same item object.
          const updatedItem = { ...item, [attrName]: newValue };
    
          const newItems = state.items.map((it) => 
            it.i === item.i ? updatedItem : it
          );
    
          return { items: newItems };
        });
      };
    },
    setNewCounter: (value: SetStateAction<number>) => {
      set((state) => {
        return {
          newCounter: typeof value === "function"
            ? (value as (prev: number) => number)(state.newCounter)
            : value
        };
      });
    },
    setTempInterfaceCreated: (val) => set({ tempInterfaceCreated: val }),
    setSaveDialog: (value: SetStateAction<boolean>) => {
      set((state) => {
        return {
          saveDialog: typeof value === "function"
            ? (value as (prev: boolean) => boolean)(state.saveDialog)
            : value
        };
      });
    },
    setFocusDialog: (value: SetStateAction<boolean>) => {
      set((state) => {
        return {
          focusDialog: typeof value === "function"
            ? (value as (prev: boolean) => boolean)(state.focusDialog)
            : value
        };
      });
    },
    setTileDropdown: (pos) => set({ tileDropdown: pos }),
    setMaxTiles: (value: SetStateAction<[string | undefined, string | undefined]>) => {
      set((state) => {
        return {
          maxTiles: typeof value === "function"
            ? (value as (prev: [string | undefined, string | undefined]) => [string | undefined, string | undefined])(state.maxTiles)
            : value
        };
      });
    },
    setEditTile: (value: SetStateAction<string | undefined>) => {
      set((state) => {
        return {
          editTile: typeof value === "function"
            ? (value as (prev: string | undefined) => string | undefined)(state.editTile)
            : value
        };
      });
    },
    setSaveSuccess: (val) => set({ saveSuccess: val }),
    setResetting: (value: SetStateAction<boolean>) => {
      set((state) => {
        return {
          resetting: typeof value === "function"
            ? (value as (prev: boolean) => boolean)(state.resetting)
            : value
        };
      });
    },

    setEdit: (value: SetStateAction<boolean>) => {
      set((state) => {
        return {
          edit: typeof value === "function"
            ? (value as (prev: boolean) => boolean)(state.edit)
            : value
        };
      });
    },
    setInteractive: (value: SetStateAction<boolean>) => {
      set((state) => {
        return {
          interactive: typeof value === "function"
            ? (value as (prev: boolean) => boolean)(state.interactive)
            : value
        };
      });
    },
    setCopied: (value: SetStateAction<string | undefined>) => {
      set((state) => {
        return {
          copied: typeof value === "function"
            ? (value as (prev: string | undefined) => string | undefined)(state.copied)
            : value
        };
      });
    },
    setDeleting: (value: SetStateAction<boolean>) => {
      set((state) => {
        return {
          deleting: typeof value === "function"
            ? (value as (prev: boolean) => boolean)(state.deleting)
            : value
        };
      });
    },

    setInterfaces: (value: SetStateAction<string[]>) => {
      set((state) => {
        return {
          interfaces: typeof value === "function"
            ? (value as (prev: string[]) => string[])(state.interfaces)
            : value
        };
      });
    },
    setProjects: (value: SetStateAction<string[]>) => {
      set((state) => {
        return {
          projects: typeof value === "function"
            ? (value as (prev: string[]) => string[])(state.projects)
            : value
        };
      });
    },

    setTilePending: (value: SetStateAction<{ [key: string]: boolean }>) => {
      set((state) => {
        return {
          tilePending: typeof value === "function"
            ? (value as (prev: { [key: string]: boolean }) => { [key: string]: boolean })(state.tilePending)
            : value
        };
      });
    },
    setDataPending: (value: SetStateAction<boolean>) => {
      set((state) => {
        return {
          dataPending: typeof value === "function"
            ? (value as (prev: boolean) => boolean)(state.dataPending)
            : value
        };
      });
    },
    setPending: (value: SetStateAction<boolean>) => {
      set((state) => {
        // If value is a function, call it with state.pending
        // else it's a direct boolean
        return {
          pending: typeof value === "function"
            ? (value as (prev: boolean) => boolean)(state.pending)
            : value
        };
      });
    },
    setRefreshing: (value: SetStateAction<boolean>) => {
      set((state) => {
        return {
          refreshing: typeof value === "function"
            ? (value as (prev: boolean) => boolean)(state.refreshing)
            : value
        };
      });
    },
    setInterface_: (val) => set({ interface_: val }),
    setProject: (val) => set({ project: val }),

    /**
     * 3) Merge in anything from 'initialState' to override these defaults.
     */
    ...initialState,
  }));
}
