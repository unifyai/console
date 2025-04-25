// src/types/hire.ts (Create a new file)

export interface PersonaFormData {
    firstName: string;
    lastName: string;
    age: number | string; // Use string for input, parse later if needed
    region: string;
    about: string;
    avatarFile?: File | null; // To hold the selected file
    avatarPreview?: string | null; // To hold the preview URL
  }
  
  export interface HirePreset {
    id: string;
    firstName: string;
    lastName: string;
    age: number;
    region: string;
    about: string;
    avatarUrl: string; // URL for the preset avatar
  }