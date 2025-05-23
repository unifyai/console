"use client";

/**
 * Unique identifier for command categories
 */
export type CommandCategory = "project" | "interface" | "tab" | "tile" | "misc";

/**
 * Lucide icon names
 */
export type CommandIcon = 
  | "Folder" 
  | "Plus" 
  | "X" 
  | "Trash" 
  | "Upload" 
  | "Focus" 
  | "FolderTree" 
  | "Save"
  | "ListRestart"
  | "Undo"
  | "Redo";

/**
 * Command metadata structure
 */
export interface Command {
  /** Unique identifier for this command */
  id: string;
  /** Display name for UI */
  label: string;
  /** Category for grouping */
  category: CommandCategory;
  /** Icon name from Lucide */
  icon: CommandIcon;
  /** Whether command is currently disabled */
  disabled: boolean;
  /** Optional keybinding */
  keybinding?: string;
  /** Optional shorthand */
  shorthand?: string;
  /** Function to execute when this command is selected */
  action?: (arg?: any, func?: () => void) => any;
}

/**
 * Create a new Command
 */
export const createCommand = (
  id: string,
  label: string,
  category: CommandCategory,
  icon: CommandIcon,
  disabled: boolean = false,
  keybinding?: string,
  shorthand?: string
): Command => ({
  id,
  label,
  category,
  icon,
  disabled,
  keybinding,
  shorthand,
});

/**
 * Creates a minimal initial state for commands
 */
export const initCommandsState = (): Command[] => [];

/**
 * Reducer-style function to update command disabled status
 */
export const updateCommandDisabled = (
  commands: Command[],
  id: string,
  disabled: boolean
): Command[] => {
  return commands.map(cmd => 
    cmd.id === id 
      ? { ...cmd, disabled } 
      : cmd
  );
};

/**
 * Utility function to find command by ID
 */
export const findCommandById = (
  commands: Command[],
  id: string
): Command | undefined => {
  return commands.find(cmd => cmd.id === id);
};

/**
 * Group commands by category
 */
export const groupCommandsByCategory = (
  commands: Command[]
): Record<CommandCategory, Command[]> => {
  return commands.reduce(
    (acc, command) => {
      if (!acc[command.category]) {
        acc[command.category] = [];
      }
      acc[command.category].push(command);
      return acc;
    },
    {} as Record<CommandCategory, Command[]>
  );
}; 