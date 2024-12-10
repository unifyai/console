export interface Message {
    content: string;
    role: string;
  }
  
  export interface Usage {
    cost: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
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
    query_body: QueryBody;
    response_body: ResponseBody;
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