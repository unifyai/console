import { ResponseProps, CustomResponseProps } from "../common";

export interface PersonaFormData {
    firstName: string;
    lastName: string;
    age: number | string; // Use string for input, parse later if needed
    region: string;
    about: string;
    imageFile?: File | null; // To hold the selected file
    imagePreview?: string | null; // To hold the preview URL
  }

export interface HirePreset {
  first_name: string;
  last_name: string;
  age: number;
  region: string;
  about: string;
  image_url: string; // URL for the preset image
}

export interface CreateAssistantResponse {
  agent_id: string;
  first_name: string;
  surname: string;
  age: number;
  weekly_limit: number;
  max_parallel: number;
  created_at: string;
  updated_at: string
} 

export interface CreateAssistantImageResponse { signedUrl: string, filePath: string, bucketName: string } 

export interface HireActions {
  create: (first_name: string, surname: string, age: number, region: string, profile_photo: string, about: string) => Promise<CreateAssistantResponse | CustomResponseProps>;
  update: (assistantId: string, about: string | null, phone: string | null, email: string | null) => Promise<ResponseProps>;
  createImage: (contentType: string, fileSize: number) => Promise<CreateAssistantImageResponse | CustomResponseProps>;
}
