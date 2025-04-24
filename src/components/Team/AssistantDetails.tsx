import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/UI/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { Mail, Phone, User } from "lucide-react";
import type { Assistant } from "@/types/team/assistant";

interface AssistantDetailsCardProps {
  assistant: Assistant;
}

export function AssistantDetailsCard({ assistant }: AssistantDetailsCardProps) {
  return (
    <Card className="my-2 mx-4 border-primary border-2 shadow-md">
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <Avatar className="h-10 w-10">
          <AvatarImage src={assistant.avatarUrl} alt={assistant.name} />
          <AvatarFallback>{assistant.name.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <CardTitle className="text-lg">{assistant.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground pl-16">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <a href={`mailto:${assistant.email}`} className="hover:underline">
            {assistant.email}
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          <span>{assistant.phone}</span>
        </div>
      </CardContent>
    </Card>
  );
}