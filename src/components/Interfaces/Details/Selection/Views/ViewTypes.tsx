import { Waypoints, CurlyBraces, Brackets, ImageIcon, Grid, Hash, Clock, MessagesSquare, Text, FileText } from "lucide-react";
import { isTrace, isDict, isList, isImage, isMatrix, isNumber, isTimestamp, isChat, isPdf } from "@/utils/evals/selection";

export function getTypeIcon(valueType: string) {
    switch (valueType) {
      case "trace":
        return <Waypoints className="h-4 w-4 text-primary" />;
      case "dict":
        return <CurlyBraces className="h-4 w-4 text-primary" />;
      case "list":
        return <Brackets className="h-4 w-4 text-primary" />;
      case "image":
        return <ImageIcon className="h-4 w-4 text-primary" />;
      case "matrix":
        return <Grid className="h-4 w-4 text-primary" />;
      case "number":
        return <Hash className="h-4 w-4 text-primary" />;
      case "timestamp":
        return <Clock className="h-4 w-4 text-primary" />;
      case "chat":
        return <MessagesSquare className="h-4 w-4 text-primary" />;
      case "pdf":
        return <FileText className="h-4 w-4 text-primary" />;
      default:
        return <Text className="h-4 w-4 text-primary" />;
    }
  }

  
export function getValueType(value: any):
  "trace" | "dict" | "list" | "image" | "matrix" | "string" | "number" | "timestamp" | "chat" | "pdf"
{
  if (isTrace(value))   return "trace";
  if (isDict(value))    return "dict";
  if (isList(value))    return "list";
  if (isPdf(value))     return "pdf";
  if (isImage(value))   return "image";
  if (isMatrix(value))  return "matrix";
  if (isNumber(value))  return "number";
  if (isTimestamp(value)) return "timestamp";
  if (isChat(value))    return "chat";
  return "string";
}
