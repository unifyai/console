"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/UI/button";
import {
  ChatBubble,
  ChatBubbleMessage,
} from "@/components/UI/Chat/chat-bubble";
import {
  SendHorizontal,
  Trash,
  GalleryHorizontalEnd,
  LayoutGrid,
  Settings2,
  Phone,
} from "lucide-react";
import { Endpoint } from "@/types/chat/endpoints";
import {
  Arguments,
  Parameters,
  AssistantMessage,
  ChatHistory,
  ChatFrame,
  ChatWrapper,
  UserMessage,
} from "@/types/chat/chat";
import { defaultModelArgs } from "@/constants/chat";
import {
  generateInput,
  getEndpointChat,
  iterateStreamResponse,
} from "@/utils/chat/chat/client";
import MarkdownRender from "../../Common/Code/MarkdownRender";
import MessageHeader from "./MessageHeader";
import { Sheet, SheetTrigger, SheetContent } from "@/components/UI/sheet";
import EndpointsTable from "../Endpoints/Main";
import { StreamResponseChunk } from "@/utils/chat/chat/stream";
import { DefaultRoutingParams } from "@/lib/chat/chat";
import { clearChat } from "@/utils/chat/chat/server";
import ChatPinning from "./ChatPinning";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/UI/tabs";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { ChatMessageList } from "@/components/UI/Chat/chat-message-list";
import { Separator } from "@/components/UI/separator";
import { Device } from '@twilio/voice-sdk';

const Messaging = ({
    endpoints,
    chatWrapper,
  }: {
    endpoints: Endpoint[];
    chatWrapper: (
      props: ChatWrapper
    ) => Promise<StreamResponseChunk<ChatFrame>>;
  }) => {
    // Select the first endpoint by default only when the component is mounted
    const [selectedEndpoints, setSelectedEndpoints] = useState<Endpoint[]>(() => {
      return endpoints.length > 0 ? [endpoints[0]] : [];
    });
  
    // Use a ref to track if this is the initial render
    const isInitialMount = useRef(true);
  
    useEffect(() => {
      // Only run this effect on the initial mount
      if (isInitialMount.current) {
        if (selectedEndpoints.length === 0 && endpoints.length > 0) {
          setSelectedEndpoints([endpoints[0]]);
        }
        isInitialMount.current = false;
      }
    }, [endpoints]);
    
  const [pinnedEndpoints, setPinnedEndpoints] = useState<Endpoint[]>([]);

  // Update pinnedEndpoints when selectedEndpoints change
  useEffect(() => {
    // Remove any pinned endpoints that are no longer selected
    setPinnedEndpoints((prevPinned) =>
      prevPinned.filter((ep) =>
        selectedEndpoints.some(
          (selected) =>
            selected.code === ep.code && selected.provider === ep.provider
        )
      )
    );
    // Automatically pin newly selected endpoints
    setPinnedEndpoints((prevPinned) => [
      ...prevPinned,
      ...selectedEndpoints.filter(
        (ep) =>
          !prevPinned.some(
            (pinned) =>
              pinned.code === ep.code && pinned.provider === ep.provider
          )
      ),
    ]);
  }, [selectedEndpoints]);

  // View mode state
  const [viewMode, setViewMode] = useState<"side-by-side" | "tabbed">(
    "side-by-side"
  );

  // Chat ref for auto-scroll
  const chatRef = useRef<HTMLDivElement>(null);

  // Chat states
  const [chatHistory, setChatHistory] = useState<ChatHistory>([]);
  const [message, setMessage] = useState<string>("");
  const [chatKey, setChatKey] = useState<string | undefined>(undefined);
  const complete =
    !chatHistory.length ||
    !(
      chatHistory.at(-1) instanceof Array &&
      (chatHistory.at(-1) as AssistantMessage[]).some((msg) => msg.thinking)
    );

  // Parameters
  const [parameters, setParameters] = useState<Parameters>({
    routing: DefaultRoutingParams,
    modelArguments: defaultModelArgs as Arguments,
    modelInputs: generateInput(defaultModelArgs as Arguments, null, [
      { content: "YOUR_MESSAGE", role: "user" },
    ]),
  });

  // Update parameters and auto-scroll
  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current?.scrollHeight,
      behavior: "smooth",
    });
    setParameters((params) => ({
      ...params,
      modelInputs: generateInput(
        params.modelArguments,
        params.modelInputs ?? null,
        [
          ...(selectedEndpoints.length > 0
            ? getEndpointChat(selectedEndpoints[0], chatHistory)
            : []),
          { content: "YOUR_MESSAGE", role: "user" },
        ]
      ),
    }));
  }, [chatHistory, selectedEndpoints]);

  // Submit message
  const sendMessage = async () => {
    if (selectedEndpoints.length === 0) {
      alert("Please select at least one endpoint to send messages.");
      return;
    }

    const endpointsToUse = selectedEndpoints;

    const newChatHistory: ChatHistory = [
      ...chatHistory,
      { content: message, role: "user" },
    ];
    setMessage("");

    let responses: AssistantMessage[] = endpointsToUse.map((endpoint) => ({
      content: "",
      thinking: true,
      role: "assistant",
      endpoint: endpoint,
    }));
    setChatHistory([...newChatHistory, responses]);
    let prevResponses =
      chatHistory.length > 0
        ? (chatHistory.at(-1) as AssistantMessage[])
        : responses;

    for await (const frame of iterateStreamResponse(
      chatWrapper({
        key: chatKey,
        message,
        endpoints: endpointsToUse,
        parameters,
        prevResponses,
      })
    )) {
      const { key, endpoint, delta, error, done } = frame;

      setChatKey(key);

      const responseIdx = endpointsToUse.findIndex(
        (ep) =>
          ep.code === endpoint.code && ep.provider === endpoint.provider
      );

      if (responseIdx === -1) {
        console.error("Received response from an endpoint not in the list");
        continue;
      }

      if (error) {
        responses[responseIdx] = {
          content: "An error occurred",
          role: "assistant",
          thinking: false,
          endpoint: endpointsToUse[responseIdx],
          error: true,
        };
        setChatHistory([...newChatHistory, responses]);
        continue;
      }

      responses[responseIdx] = {
        content: responses[responseIdx].content + delta,
        thinking: !done,
        role: "assistant",
        endpoint: endpointsToUse[responseIdx],
        metrics: frame.metrics,
      };
      setChatHistory([...newChatHistory, responses]);
    }
  };

  // Function to toggle pinning
  const handlePinToggle = (endpoint: Endpoint) => {
    const isPinned = isEndpointPinned(endpoint);
    if (isPinned) {
      setPinnedEndpoints(
        pinnedEndpoints.filter(
          (ep) =>
            !(
              ep.code === endpoint.code && ep.provider === endpoint.provider
            )
        )
      );
    } else {
      setPinnedEndpoints([...pinnedEndpoints, endpoint]);
    }
  };

  // Function to deselect an endpoint
  const handleUnselectEndpoint = (endpoint: Endpoint) => {
    setSelectedEndpoints((prev) =>
      prev.filter(
        (ep) =>
          !(
            ep.code === endpoint.code && ep.provider === endpoint.provider
          )
      )
    );
  };

  // Clear chat
  const handleClearChat = async () => {
    setChatHistory([]);
    if (!chatKey) return;
    clearChat(chatKey);
    setChatKey(undefined);
  };

  // Message handler
  const handleMessageSent = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (message.trim().length === 0) return;
    if (complete) {
      sendMessage();
    }
  };

  // Phone Handler
  const [device, setDevice] = useState<Device | null>(null);
  const setupTwilioDevice = async () => {
    const res = await fetch('/api/phone/token');
    const { token } = await res.json();

    const twilioDevice = new Device(token);

    twilioDevice.on('ready', () => {
      console.log('Twilio Device is ready!');
    });

    twilioDevice.on('error', (error) => {
      console.error('Twilio Device error:', error);
    });

    twilioDevice.on('disconnect', () => {
      console.log('Call disconnected');
    });

    setDevice(twilioDevice);
  };
  
  const handleTwilioVoice = async (e?: React.FormEvent) => {
    if (!device) {
      await setupTwilioDevice();
    }

    const params = {
      To: `${process.env.LIVEKIT_SIP_URI}`,
    };

    device?.connect({ params });
  };

  // Function to check if an endpoint is pinned
  const isEndpointPinned = (endpoint: Endpoint) => {
    return pinnedEndpoints.some(
      (ep) => ep.code === endpoint.code && ep.provider === endpoint.provider
    );
  };

  // Reference to the textarea element
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // Reset the height
      const maxHeight = 400; // 12rem in pixels
      const newHeight = Math.min(
        textareaRef.current.scrollHeight,
        maxHeight
      );
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  return (
    <div className="relative w-full h-full bg-background tutorial-chat-interface">
      {/* Header */}
      <div className="absolute top-0 w-full p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">Chat</h2>
      </div>

      {/* Chat Messages */}
      <div className="absolute bottom-0 w-full pb-4">
        <div className="h-[70vh] mt-16">
          <ChatMessageList
            className="text-sm overflow-y-auto"
            ref={chatRef}
          >
            {chatHistory.map((chat, index) => {
              if (Array.isArray(chat)) {
                // It's an array of assistant responses
                const responses = chat as AssistantMessage[];
                // Filter responses to only include those from pinned endpoints
                const visibleResponses = responses.filter((ch) =>
                  isEndpointPinned(ch.endpoint)
                );
                if (visibleResponses.length === 0) return null; // No pinned responses to display

                if (viewMode === "side-by-side") {
                  return (
                    <div key={index}>
                      <div className="flex flex-wrap gap-4 w-full">
                        {visibleResponses.map((ch, idx) => {
                          const model = ch.endpoint.code;
                          const provider = ch.endpoint.provider;

                          return (
                            <ChatBubble
                              variant="received"
                              key={idx}
                              className="flex-1 min-w-[30%]"
                            >
                              <ChatBubbleMessage
                                variant="received"
                                isLoading={ch.content.length === 0}
                              >
                                <MessageHeader
                                  model={model}
                                  provider={provider}
                                  content={ch.content}
                                  cost={ch.metrics?.cost}
                                />
                                <MarkdownRender content={ch.content} />
                              </ChatBubbleMessage>
                            </ChatBubble>
                          );
                        })}
                      </div>
                    </div>
                  );
                } else if (viewMode === "tabbed") {
                  return (
                    <div className="w-full" key={index}>
                      <Tabs
                        defaultValue={`${visibleResponses[0].endpoint.provider}-${visibleResponses[0].endpoint.code}`}
                      >
                        <TabsList>
                          {visibleResponses.map((ch) => {
                            const tabValue = `${ch.endpoint.provider}-${ch.endpoint.code}`;
                            return (
                              <TabsTrigger
                                key={tabValue}
                                value={tabValue}
                              >
                                {ch.endpoint.code}
                              </TabsTrigger>
                            );
                          })}
                        </TabsList>
                        {visibleResponses.map((ch) => {
                          const tabValue = `${ch.endpoint.provider}-${ch.endpoint.code}`;
                          return (
                            <TabsContent
                              key={tabValue}
                              value={tabValue}
                            >
                              <ChatBubble
                                variant="received"
                                className="w-full"
                              >
                                <ChatBubbleMessage
                                  variant="received"
                                  isLoading={ch.content.length === 0}
                                >
                                  <MessageHeader
                                    model={ch.endpoint.code}
                                    provider={ch.endpoint.provider}
                                    content={ch.content}
                                    cost={ch.metrics?.cost}
                                  />
                                  <MarkdownRender
                                    content={ch.content}
                                  />
                                </ChatBubbleMessage>
                              </ChatBubble>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </div>
                  );
                }
              } else {
                // It's a user message
                const userMessage = chat as UserMessage;
                return (
                  <div key={index} className="flex justify-end">
                    <ChatBubble variant="sent">
                    <ChatBubbleMessage variant="sent">
                        <MessageHeader
                        model={"You"}
                        content={userMessage.content}
                        />
                        <MarkdownRender
                        content={userMessage.content}
                        />
                    </ChatBubbleMessage>
                    </ChatBubble>
                  </div>
                );
              }
            })}
          </ChatMessageList>
        </div>

        {/* Chat Pinning Components and Control Buttons */}
        {selectedEndpoints.length > 0 && (
          <div className="bg-background my-2 flex items-center justify-between px-5">
            <ChatPinning
              endpoints={selectedEndpoints}
              handlePinToggle={handlePinToggle}
              handleUnselectEndpoint={handleUnselectEndpoint}
              isEndpointPinned={isEndpointPinned}
            />
            <div className="flex gap-2">
              {/* View Mode Button */}
              <Tooltip content="Toggle view mode">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setViewMode(
                      viewMode === "side-by-side"
                        ? "tabbed"
                        : "side-by-side"
                    )
                  }
                  className="transition-colors"
                >
                  {viewMode === "side-by-side" ? (
                    <GalleryHorizontalEnd className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="sr-only">Toggle view mode</span>
                </Button>
              </Tooltip>

              {/* Trash Button */}
              {chatHistory.length > 0 && (
                <Tooltip content="Clear chat">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleClearChat}
                    className="transition-colors hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash className="h-5 w-5 text-muted-foreground" />
                    <span className="sr-only">Clear chat</span>
                  </Button>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        {/* Chat Input */}
        <div className="mx-4">
          <form
            className="flex items-center h-fit rounded-lg border bg-background p-1 mt-auto"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleMessageSent(e);
            }}
          >
            <textarea
              ref={textareaRef}
              placeholder={
                selectedEndpoints.length === 0
                  ? "Please select an endpoint..."
                  : "Type your message here..."
              }
              className="flex-1 resize-none rounded-lg bg-background border-0 p-3 shadow-none focus:outline-none focus-visible:ring-0 focus:ring-0 max-h-300 overflow-y-auto"
              onChange={handleInputChange}
              value={message}
              disabled={selectedEndpoints.length === 0}
              style={{ height: "auto" }}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleMessageSent}
              disabled={
                !complete ||
                selectedEndpoints.length === 0 ||
                message.trim().length === 0
              }
              className={`mr-2 transition-colors ${
                !complete || selectedEndpoints.length === 0
                  ? ""
                  : "hover:bg-primary group"
              }`}
            >
              <SendHorizontal
                className={`h-4 w-4 transition-colors ${
                  !complete || selectedEndpoints.length === 0
                    ? "text-muted-foreground"
                    : "text-primary group-hover:text-primary-foreground"
                }`}
              />
              <span className="sr-only">Send message</span>
            </Button>
            <Button
              onClick={handleTwilioVoice}>
              <Phone className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Select Endpoints Icon */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 z-50 opacity-50 hover:opacity-100 "
          >
            <Settings2 className="w-6 h-6" />
            <span className="sr-only">Select Endpoints</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right">
          <EndpointsTable
            endpoints={endpoints}
            selectedEndpoints={selectedEndpoints}
            setSelectedEndpoints={setSelectedEndpoints}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Messaging;
