export interface Message {
    content: string;
    role: string;
  }
  
  export interface Usage {
    cost: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }
  
  export interface QueryBody {
    messages: Message[];
    tags: string[] | null;
    [key: string]: any; // For any additional properties
  }
  
  export interface ResponseBody {
    usage: Usage;
    [key: string]: any; // For any additional properties
  }

  export interface Query {
    endpoint: string;
    queryBody: QueryBody;
    responseBody: ResponseBody;
    at: string;
    credits: number;
  }
  
  export interface QueryResult {
    endpoint: string;
    messages: Message[];
    tags: string[] | null;
    usage: Usage;
    at: string;
    credits: number;
  }