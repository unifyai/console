import { Endpoint } from '@/types/chat/endpoints';
import { ChatWrapper } from '@/types/chat/chat';
import Messaging from './Messaging/Main';
import { chat } from '@/utils/chat/chat/server';

const Main = ({ apiKey, endpoints }: { apiKey: string; endpoints: Endpoint[] }) => {
  // Adding a chat wrapper to avoid passing an API key to a client component
  const chatWrapper = async ({
    key,
    message,
    endpoints,
    parameters,
    prevResponses,
  }: ChatWrapper) => {
    'use server';
    return chat({ key, message, endpoints, parameters, prevResponses, apiKey });
  };

  return <Messaging endpoints={endpoints} chatWrapper={chatWrapper} />;
};

export default Main;
