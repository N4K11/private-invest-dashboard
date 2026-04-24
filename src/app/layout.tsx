import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Приватный инвестиционный терминал",
    template: "%s | Приватный инвестиционный терминал",
  },
  description:
    "Приватный инвестиционный терминал для цифровых активов на Google Sheets с live-оценкой крипты и CS2.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}

