import type {
  EmailProvider,
  EmailSendResult,
} from "@/lib/notifications/email/types";

export class NoopEmailProvider implements EmailProvider {
  readonly id = "noop";

  async send(): Promise<EmailSendResult> {
    return {
      status: "skipped",
      provider: this.id,
    };
  }
}
