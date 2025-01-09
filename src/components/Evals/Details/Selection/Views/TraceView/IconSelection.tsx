import { ChevronsLeftRightEllipsis, Cpu, Cloud, Database, Code2, Radio, Send, FileCode } from "lucide-react";


/**
 * A small helper that determines the icon to use based on span.type.
 * Adjust as needed for your environment.
 */
export default function getIconForSpanType(type?: string) {
    if (!type) return ChevronsLeftRightEllipsis;
    switch (type.toLowerCase()) {
      case "model":
        return Cpu;
      case "api":
        return Cloud;
      case "db":
        return Database;
      case "code":
        return Code2;
      case "radio":
        return Radio;
      case "send":
        return Send;
      case "file":
        return FileCode;
      default:
        return ChevronsLeftRightEllipsis; // fallback
    }
  }