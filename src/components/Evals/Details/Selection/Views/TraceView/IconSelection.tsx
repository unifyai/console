import { ChevronsLeftRightEllipsis, FileCode, MessageSquare, MessageSquareDashed, Wrench, Cable, CloudCog } from "lucide-react";

/**
 * A small helper that determines the icon to use based on span.type.
 * Adjust as needed for your environment.
 */
export default function getIconForSpanType(type?: string) {
    if (!type) return ChevronsLeftRightEllipsis;
    switch (type.toLowerCase()) {
      case "llm":
        return MessageSquare;
      case "retrieval":
        return FileCode;
      case "tool call":
        return Wrench;
      case "io":
        return Cable;
      case "api":
        return CloudCog;
      case "llm-cached":
        return MessageSquareDashed;
      default:
        return ChevronsLeftRightEllipsis; // fallback
    }
  }