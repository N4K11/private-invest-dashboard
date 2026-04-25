import type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from "@/lib/notifications/email/types";

type ResendEmailProviderOptions = {
  apiKey: string;
  from: string;
  replyTo?: string;
};

export class ResendEmailProvider implements EmailProvider {
  readonly id = "resend";

  constructor(private readonly options: ResendEmailProviderOptions) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.options.apiKey || !this.options.from) {
      return {
        status: "skipped",
        provider: this.id,
        error: "Resend provider is not configured.",
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.replyTo ?? this.options.replyTo
            ? { reply_to: message.replyTo ?? this.options.replyTo }
            : {}),
        }),
      });

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        return {
          status: "failed",
          provider: this.id,
          error: details || `Resend returned ${response.status}`,
        };
      }

      const payload = (await response.json().catch(() => null)) as { id?: string } | null;
      return {
        status: "delivered",
        provider: this.id,
        messageId: payload?.id,
      };
    } catch (error) {
      return {
        status: "failed",
        provider: this.id,
        error: error instanceof Error ? error.message : "Email delivery failed.",
      };
    }
  }
}
