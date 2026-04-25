import "server-only";

import type { EmailProvider } from "@/lib/notifications/email/types";
import { getEnv } from "@/lib/env";
import { NoopEmailProvider } from "@/lib/notifications/email/providers/noop-email-provider";
import { ResendEmailProvider } from "@/lib/notifications/email/providers/resend-email-provider";

let cachedProvider: EmailProvider | null = null;

export function getEmailProvider() {
  if (cachedProvider) {
    return cachedProvider;
  }

  const env = getEnv();
  cachedProvider =
    env.ALERT_EMAIL_PROVIDER === "resend"
      ? new ResendEmailProvider({
          apiKey: env.RESEND_API_KEY ?? "",
          from: env.ALERT_EMAIL_FROM ?? "",
          replyTo: env.ALERT_EMAIL_REPLY_TO,
        })
      : new NoopEmailProvider();

  return cachedProvider;
}
