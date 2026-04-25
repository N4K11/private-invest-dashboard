export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type EmailSendResult = {
  status: "delivered" | "failed" | "skipped";
  provider: string;
  messageId?: string;
  error?: string;
};

export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
