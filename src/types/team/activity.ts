import { ResponseProps } from "../common";
import { LogsResponseProps } from "../evals/logs";

export enum MessageMedium {
    SMS_MESSAGE = "sms_message",
    EMAIL = "email",
    WHATSAPP_MSG = "whatsapp_message",
    PHONE_CALL = "phone_call",
    WHATSAPP_CALL = "whatsapp_call",
}

export interface MessageLogEntry {
    medium: MessageMedium;
    sender_id: string;
    receiver_id: string;
    timestamp: string;
    content: string;
    exchange_id: number;
}

export interface MessageLog extends MessageLogEntry {
    log_id: number;
    senderName: string;
    receiverName: string;
}

export interface ActivityLogActions {
  get: (filterExpression: string | null, limit: number | null, offset: number | null) => Promise<LogsResponseProps | ResponseProps>;
}